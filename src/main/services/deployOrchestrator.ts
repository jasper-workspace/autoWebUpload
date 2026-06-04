import { LocalBuildService } from './localBuild';
import { SFTPService } from './sftp';
import { BuildConfig, DeployResult, ServerConfig } from '../../shared/types';
import { BrowserWindow } from 'electron';

export class DeployOrchestrator {
  private localBuildService: LocalBuildService | null = null;
  private sftpService: SFTPService | null = null;
  private mainWindow: BrowserWindow | null = null;

  setLocalBuildService(service: LocalBuildService): void {
    this.localBuildService = service;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 外部进度上报接口（供 handlers.ts 调用）
   */
  reportProgress(
    phase: 'building' | 'uploading' | 'deploying' | 'completed',
    step: string,
    percentage: number,
    status: 'building' | 'success' | 'error' | 'canceled',
    output?: string
  ): void {
    this.reportDeployProgress(phase, step, percentage, status, output);
  }

  /**
   * 一键部署流程
   */
  async executeOneClickDeploy(
    serverConfig: ServerConfig,
    buildConfig: BuildConfig
  ): Promise<DeployResult> {
    const result: DeployResult = {
      success: false,
      type: buildConfig.type,
      totalDuration: 0,
    };

    const startTime = Date.now();

    // 如果没有外部传入的 localBuildService，则创建一个
    const buildService = this.localBuildService || new LocalBuildService();

    // ===== 阶段1: 构建 =====
    this.reportDeployProgress('building', `执行构建命令: ${buildConfig.buildCommand}`, 0, 'building');

    const buildResult = await buildService.executeBuild(buildConfig);
    result.build = {
      success: buildResult.success,
      duration: buildResult.duration,
      output: buildResult.output,
      error: buildResult.error,
    };

    if (!buildResult.success) {
      if (buildConfig.stopOnBuildFailure) {
        result.error = buildResult.error; // 去掉前缀，前端会加"一键部署失败:"
        result.totalDuration = Date.now() - startTime;
        this.reportDeployProgress('building', '构建失败', 0, 'error');
        return result;
      }
    }

    // ===== 阶段2: 上传 =====
    const uploadStartTime = Date.now();
    const remotePath = buildConfig.type === 'frontend'
      ? (serverConfig.frontend?.remotePath || serverConfig.remotePath || '')
      : (serverConfig.backend?.remotePath || serverConfig.backendPath || '');
    const localPath = `${buildConfig.localPath}/${buildResult.detectedOutputDir || buildConfig.outputDir}`;
    this.reportDeployProgress('uploading', `上传文件: ${localPath} -> ${remotePath}`, 0, 'building');

    this.sftpService = new SFTPService();
    try {
      await this.sftpService.connect(serverConfig);

      const remotePath = buildConfig.type === 'frontend'
        ? (serverConfig.frontend?.remotePath || serverConfig.remotePath || '')
        : (serverConfig.backend?.remotePath || serverConfig.backendPath || '');

      const localPath = `${buildConfig.localPath}/${buildResult.detectedOutputDir || buildConfig.outputDir}`;

      await this.uploadWithProgress(localPath, remotePath);

      result.upload = {
        success: true,
        duration: Date.now() - uploadStartTime,
      };
    } catch (error: any) {
      result.upload = {
        success: false,
        duration: Date.now() - uploadStartTime,
        error: error.message,
      };
      result.error = `上传失败: ${error.message}`;
      result.totalDuration = Date.now() - startTime;
      this.reportDeployProgress('uploading', '上传失败', 0, 'error');
      return result;
    } finally {
      if (this.sftpService) {
        await this.sftpService.disconnect();
        this.sftpService = null;
      }
    }

    // ===== 阶段3: 远程部署命令 =====
    const postCommand = buildConfig.type === 'frontend'
      ? serverConfig.frontend?.postUploadCommand
      : serverConfig.backend?.postUploadCommand;

    this.reportDeployProgress('deploying', `执行部署命令: ${postCommand || '(无)'}`, 0, 'building');

    if (postCommand) {
      this.sftpService = new SFTPService();
      try {
        await this.sftpService.connect(serverConfig);
        const deployResult = await this.sftpService.executeCommand(postCommand);

        result.deploy = {
          success: deployResult.success,
          output: deployResult.output,
          error: deployResult.error,
        };

        if (!deployResult.success) {
          result.error = `部署命令执行失败: ${deployResult.error}`;
        }
      } finally {
        if (this.sftpService) {
          await this.sftpService.disconnect();
          this.sftpService = null;
        }
      }
    } else {
      result.deploy = {
        success: true,
        output: '(无部署命令)',
      };
    }

    result.totalDuration = Date.now() - startTime;
    result.success = !result.error && result.upload.success && result.deploy.success;

    this.reportDeployProgress('completed', '部署完成', 100, result.success ? 'success' : 'error');

    return result;
  }

  /**
   * 带进度上报的上传
   */
  private async uploadWithProgress(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sftpService) {
        reject(new Error('SFTP服务未初始化'));
        return;
      }
      this.sftpService.uploadFolder(
        localPath,
        remotePath,
        (progress) => {
          this.reportDeployProgress('uploading', `正在上传: ${progress.currentFile}`, progress.percentage, 'building');
        }
      ).then(() => resolve()).catch(reject);
    });
  }

  /**
   * 取消部署
   */
  cancelDeploy(): void {
    if (this.localBuildService) {
      this.localBuildService.cancelBuild();
    }
    if (this.sftpService) {
      this.sftpService.disconnect().catch(() => {});
      this.sftpService = null;
    }
  }

  /**
   * 进度上报 - 转换为整体进度
   */
  private reportDeployProgress(
    phase: 'building' | 'uploading' | 'deploying' | 'completed',
    step: string,
    phasePercentage: number,
    status: 'building' | 'success' | 'error' | 'canceled',
    output?: string
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // 整体进度计算: 构建 0-30%, 上传 30-80%, 部署 80-100%
      let overallPercentage = 0;
      switch (phase) {
        case 'building':
          overallPercentage = Math.round(phasePercentage * 0.3); // 0-30
          break;
        case 'uploading':
          overallPercentage = 30 + Math.round(phasePercentage * 0.5); // 30-80
          break;
        case 'deploying':
          overallPercentage = 80 + Math.round(phasePercentage * 0.2); // 80-100
          break;
        case 'completed':
          overallPercentage = 100;
          break;
      }
      this.mainWindow.webContents.send('deploy:progress', { phase, step, percentage: overallPercentage, status, output });
    }
  }
}
