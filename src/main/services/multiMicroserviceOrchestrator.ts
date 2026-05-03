import path from 'path';
import { app } from 'electron';
import {
  MicroserviceConfig,
  MicroserviceBuildProgress,
  MicroserviceDeployResult,
  MultiMicroserviceDeployResult,
  ServerConfig,
} from '../../shared/types';
import { mavenExecutor } from './mavenExecutor';
import { SFTPService } from './sftp';

/**
 * 多微服务部署编排器
 * 协调多个微服务的上传、部署流程（跳过构建阶段）
 */
export class MultiMicroserviceOrchestrator {
  private isCanceled = false;
  private currentMicroserviceId: string | null = null;

  /**
   * 一键部署全部启用的微服务
   * @param serverConfig 服务器配置
   * @param backendRootPath 后端根目录
   * @param selectedIds 用户选择的微服务ID列表
   * @param onProgress 进度回调
   * @returns 部署结果
   */
  async deployAll(
    serverConfig: ServerConfig,
    backendRootPath: string,
    selectedIds: string[],
    onProgress: (progress: MicroserviceBuildProgress) => void
  ): Promise<MultiMicroserviceDeployResult> {
    this.isCanceled = false;
    const startTime = Date.now();
    const results: MicroserviceDeployResult[] = [];

    // 获取用户选择且启用的微服务列表
    const microservices = serverConfig.backend?.microservices?.filter(
      (ms) => ms.enabled && selectedIds.includes(ms.id)
    ) || [];

    console.log('[MultiMicroserviceOrchestrator] deployAll', {
      selectedIds,
      microservices: microservices.map(ms => ({ id: ms.id, name: ms.name, enabled: ms.enabled }))
    });

    if (microservices.length === 0) {
      return {
        success: false,
        results: [],
        totalDuration: 0,
        failedCount: 0,
        successCount: 0,
      };
    }

    // 创建SFTP服务实例
    const sftpService = new SFTPService();

    try {
      // 连接服务器（传递完整的serverConfig）
      console.log('[MultiMicroserviceOrchestrator] 开始SFTP连接', {
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username
      });
      await sftpService.connect(serverConfig);
      console.log('[MultiMicroserviceOrchestrator] SFTP连接成功');
    } catch (error) {
      console.log('[MultiMicroserviceOrchestrator] SFTP连接失败', { error });
      return {
        success: false,
        results: microservices.map((ms) => ({
          microserviceId: ms.id,
          microserviceName: ms.name,
          success: false,
          error: `连接服务器失败: ${error instanceof Error ? error.message : String(error)}`,
        })),
        totalDuration: Date.now() - startTime,
        failedCount: microservices.length,
        successCount: 0,
      };
    }

    // 遍历每个微服务进行部署
    for (const microservice of microservices) {
      if (this.isCanceled) {
        break;
      }

      this.currentMicroserviceId = microservice.id;

      // 发送pending状态
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'pending',
        percentage: 0,
        output: '',
        startTime: Date.now(),
      });

      // 执行单个微服务部署
      const result = await this.deployOneMicroservice(
        serverConfig,
        microservice,
        backendRootPath,
        (progress) => onProgress(progress)
      );

      results.push(result);
      this.currentMicroserviceId = null;
    }

    // 断开SFTP连接
    sftpService.disconnect();

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      success: failedCount === 0,
      results,
      totalDuration,
      failedCount,
      successCount,
    };
  }

  /**
   * 部署单个微服务（跳过构建阶段，直接上传jar包）
   */
  private async deployOneMicroservice(
    serverConfig: ServerConfig,
    microservice: MicroserviceConfig,
    backendRootPath: string,
    onProgress: (progress: MicroserviceBuildProgress) => void
  ): Promise<MicroserviceDeployResult> {
    const microservicePath = path.join(backendRootPath, microservice.localPath);
    console.log('[MultiMicroserviceOrchestrator] deployOneMicroservice 开始', {
      microservice: microservice.name,
      microservicePath,
      remotePath: microservice.remotePath,
    });
    const result: MicroserviceDeployResult = {
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      success: false,
    };

    const startTime = Date.now();

    // ==================== 阶段1: SFTP上传jar包产物 ====================
    console.log('[MultiMicroserviceOrchestrator] 发送 uploading 进度', microservice.name);
    onProgress({
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      phase: 'uploading',
      percentage: 10,
      output: '开始上传jar包...',
      startTime,
    });

    const uploadStartTime = Date.now();

    try {
      // 检测构建产物（target/*.jar）
      console.log('[MultiMicroserviceOrchestrator] 开始检测jar包产物', microservicePath);
      const artifacts = await mavenExecutor.getBuildArtifacts(microservicePath);
      console.log('[MultiMicroserviceOrchestrator] jar包检测完成', { count: artifacts.length, artifacts });

      if (artifacts.length === 0) {
        result.uploadResult = {
          success: false,
          duration: Date.now() - uploadStartTime,
          uploadedFiles: 0,
          error: '未找到jar包产物，请确保已执行Maven构建',
        };
        result.error = result.uploadResult.error;
        onProgress({
          microserviceId: microservice.id,
          microserviceName: microservice.name,
          phase: 'error',
          percentage: 10,
          output: '未找到jar包产物',
          error: result.error,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        });
        return result;
      }

      // 创建SFTP服务实例
      console.log('[MultiMicroserviceOrchestrator] 创建SFTP服务并连接...');
      const sftpService = new SFTPService();
      await sftpService.connect(serverConfig);
      console.log('[MultiMicroserviceOrchestrator] SFTP连接成功');

      let uploadedFiles = 0;

      // 上传每个产物
      for (const artifact of artifacts) {
        const remotePath = path.posix.join(microservice.remotePath, path.basename(artifact.path));
        console.log('[MultiMicroserviceOrchestrator] 开始上传', { local: artifact.path, remote: remotePath });

        // uploadFolder可以处理文件和目录
        await sftpService.uploadFolder(artifact.path, remotePath, () => {});
        uploadedFiles++;

        onProgress({
          microserviceId: microservice.id,
          microserviceName: microservice.name,
          phase: 'uploading',
          percentage: 50,
          output: `已上传 ${uploadedFiles}/${artifacts.length} 个产物`,
          startTime,
        });
      }

      console.log('[MultiMicroserviceOrchestrator] 上传完成，断开SFTP连接');
      sftpService.disconnect();

      result.uploadResult = {
        success: true,
        duration: Date.now() - uploadStartTime,
        uploadedFiles,
      };
    } catch (error) {
      result.uploadResult = {
        success: false,
        duration: Date.now() - uploadStartTime,
        uploadedFiles: 0,
        error: `上传失败: ${error instanceof Error ? error.message : String(error)}`,
      };
      result.error = result.uploadResult.error;
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'error',
        percentage: 50,
        output: '',
        error: result.error,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      });
      return result;
    }

    // ==================== 阶段2: 执行部署后命令 ====================
    onProgress({
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      phase: 'deploying',
      percentage: 80,
      output: '执行部署后命令...',
      startTime,
    });

    if (microservice.postUploadCommand) {
      console.log('[MultiMicroserviceOrchestrator] 开始执行部署命令', microservice.postUploadCommand);
      try {
        const sftpService = new SFTPService();
        await sftpService.connect(serverConfig);

        const deployResult = await sftpService.executeCommand(microservice.postUploadCommand);
        console.log('[MultiMicroserviceOrchestrator] 部署命令执行完成', { success: deployResult.success });

        result.deployResult = {
          success: deployResult.success,
          output: deployResult.output,
          error: deployResult.error,
        };

        sftpService.disconnect();

        if (!deployResult.success) {
          result.error = `部署命令执行失败: ${deployResult.error}`;
        }
      } catch (error) {
        result.deployResult = {
          success: false,
          output: '',
          error: `部署命令异常: ${error instanceof Error ? error.message : String(error)}`,
        };
        result.error = result.deployResult.error;
      }
    } else {
      result.deployResult = {
        success: true,
        output: '(无部署命令)',
      };
    }

    // ==================== 完成 ====================
    result.success = !result.error;
    onProgress({
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      phase: result.success ? 'completed' : 'error',
      percentage: 100,
      output: result.success ? '部署完成' : result.error || '部署失败',
      error: result.error,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * 取消当前部署
   */
  cancelDeploy(): void {
    this.isCanceled = true;
    if (this.currentMicroserviceId) {
      this.currentMicroserviceId = null;
    }
  }
}

// 导出单例
export const multiMicroserviceOrchestrator = new MultiMicroserviceOrchestrator();
