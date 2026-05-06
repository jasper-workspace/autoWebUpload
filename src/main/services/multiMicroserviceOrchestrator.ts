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
 * 辅助函数：按换行符截取日志，保证行的完整性
 * @param output 原始日志输出
 * @param maxLines 最大行数
 * @returns 截取后的日志
 */
function trimLogOutput(output: string, maxLines: number): string {
  if (!output) return output;
  const lines = output.split('\n').filter(l => l.trim());
  if (lines.length <= maxLines) {
    return lines.join('\n');
  }
  // 保留最后 maxLines 行
  return lines.slice(-maxLines).join('\n');
}

/**
 * 多微服务部署编排器
 * 协调多个微服务的构建、上传、部署流程
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
   * 部署单个微服务
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

    // 构建Maven命令（用于显示）
    const mvnCmdName = 'mvn';
    let mavenCmd = `${mvnCmdName} package -DskipTests`;
    if (backendRootPath) {
      const relativePomPath = path.relative(backendRootPath, microservicePath);
      const modulePath = relativePomPath.replace(/[/\\]pom\.xml$/, '');
      mavenCmd += ` -pl ${modulePath} -am`;
    }
    const mvnDisplayCmd = `cd ${backendRootPath || microservicePath} && ${mavenCmd}`;

    // ==================== 阶段0: Maven 构建 ====================
    console.log('[MultiMicroserviceOrchestrator] 开始Maven构建', microservice.name);
    onProgress({
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      phase: 'building',
      percentage: 0,
      output: `[命令] ${mvnDisplayCmd}`,
      startTime,
    });

    let buildSuccess = false;
    let buildOutput = '';

    try {
      // 使用 mavenExecutor 执行 Maven 构建
      // 传入 backendRootPath 作为 reactorPath，启用 Maven Reactor Build 模式
      const buildResult = await mavenExecutor.executeCommand(
        microservicePath,
        'package', // Maven命令类型
        true, // skipTests
        (output) => {
          // 进度回调 - 按换行符截取保证行的完整性
          const trimmedOutput = trimLogOutput(output, 100);
          onProgress({
            microserviceId: microservice.id,
            microserviceName: microservice.name,
            phase: 'building',
            percentage: 50, // 模拟进度
            output: trimmedOutput,
            startTime,
          });
        },
        undefined, // mavenPath
        undefined, // javaPath
        backendRootPath // reactorPath - 启用 Reactor Build 模式
      );

      buildSuccess = buildResult.success;
      buildOutput = buildResult.output;

      if (!buildResult.success) {
        onProgress({
          microserviceId: microservice.id,
          microserviceName: microservice.name,
          phase: 'error',
          percentage: 0,
          output: '构建失败',
          error: buildResult.error,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        });
        result.error = `构建失败: ${buildResult.error}`;
        return result;
      }

      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'building',
        percentage: 100,
        output: '构建完成',
        startTime,
      });
    } catch (error) {
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'error',
        percentage: 0,
        output: '构建失败',
        error: error instanceof Error ? error.message : String(error),
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      });
      result.error = `构建异常: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }

    // ==================== 阶段1: SFTP上传jar包产物 ====================
    console.log('[MultiMicroserviceOrchestrator] 发送 uploading 进度', microservice.name);
    onProgress({
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      phase: 'uploading',
      percentage: 10,
      output: `[命令] SFTP上传 jar包到 ${microservice.remotePath}`,
      startTime,
    });

    const uploadStartTime = Date.now();
    let uploadError: string | undefined;

    // 检测构建产物（target/*.jar）
    console.log('[MultiMicroserviceOrchestrator] 开始检测jar包产物', microservicePath);
    let artifacts: { type: string; path: string; size: number }[] = [];
    try {
      artifacts = await mavenExecutor.getBuildArtifacts(microservicePath);
      console.log('[MultiMicroserviceOrchestrator] jar包检测完成', { count: artifacts.length, artifacts });
    } catch (error) {
      uploadError = `检测jar包产物失败: ${error instanceof Error ? error.message : String(error)}`;
    }

    // 如果检测失败或没有产物
    if (uploadError || artifacts.length === 0) {
      result.uploadResult = {
        success: false,
        duration: Date.now() - uploadStartTime,
        uploadedFiles: 0,
        error: uploadError || '未找到jar包产物，请确保已执行Maven构建',
      };
      result.error = result.uploadResult.error;
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'error',
        percentage: 10,
        output: result.error || '检测jar包产物失败',
        error: result.error,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      });
      return result;
    }

    // 上传产物
    let uploadedFiles = 0;
    try {
      // 创建SFTP服务实例
      console.log('[MultiMicroserviceOrchestrator] 创建SFTP服务并连接...');
      const sftpService = new SFTPService();
      await sftpService.connect(serverConfig);
      console.log('[MultiMicroserviceOrchestrator] SFTP连接成功');

      // 上传每个产物
      for (const artifact of artifacts) {
        // 直接传 remotePath 作为目录，uploadFolder 内部会自己提取文件名
        const remoteDir = microservice.remotePath;
        console.log('[MultiMicroserviceOrchestrator] 开始上传', { local: artifact.path, remote: remoteDir });

        await sftpService.uploadFolder(artifact.path, remoteDir, () => {});
        uploadedFiles++;

        onProgress({
          microserviceId: microservice.id,
          microserviceName: microservice.name,
          phase: 'uploading',
          percentage: 30 + Math.floor((uploadedFiles / artifacts.length) * 40),
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
        uploadedFiles,
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
    if (microservice.postUploadCommand) {
      // 如果命令是相对路径（如 ./xxx.sh），需要先 cd 到远程目录
      let actualCommand = microservice.postUploadCommand;
      if (microservice.postUploadCommand.startsWith('./')) {
        actualCommand = `cd ${microservice.remotePath} && ${microservice.postUploadCommand}`;
      }
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'deploying',
        percentage: 80,
        output: `[命令] ${actualCommand}`,
        startTime,
      });

      console.log('[MultiMicroserviceOrchestrator] 开始执行部署命令', microservice.postUploadCommand);
      try {
        const sftpService = new SFTPService();
        await sftpService.connect(serverConfig);

        const deployResult = await sftpService.executeCommand(actualCommand);
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
      onProgress({
        microserviceId: microservice.id,
        microserviceName: microservice.name,
        phase: 'deploying',
        percentage: 80,
        output: `[命令]（无部署命令）`,
        startTime,
      });
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
    // 杀死正在运行的 Maven 进程
    mavenExecutor.cancelExecution();
    if (this.currentMicroserviceId) {
      this.currentMicroserviceId = null;
    }
  }
}

// 导出单例
export const multiMicroserviceOrchestrator = new MultiMicroserviceOrchestrator();
