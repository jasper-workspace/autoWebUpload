import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * Maven命令执行服务
 * 负责在Windows本地对指定微服务执行Maven命令
 */
export class MavenExecutor {
  private currentProcess: ChildProcess | null = null;
  private isCanceled = false;

  /**
   * 执行Maven命令
   * @param microservicePath 微服务本地路径（绝对路径）
   * @param command Maven命令类型
   * @param skipTests 是否跳过测试
   * @param onProgress 进度回调函数
   * @returns 执行结果
   */
  async executeCommand(
    microservicePath: string,
    command: 'clean' | 'compile' | 'package' | 'install' | 'deploy',
    skipTests: boolean = true,
    onProgress?: (output: string) => void
  ): Promise<{ success: boolean; output: string; error?: string }> {
    this.isCanceled = false;
    let output = '';

    // 构建Maven命令
    let mavenCmd = `mvn ${command}`;
    if (skipTests && (command === 'package' || command === 'install' || command === 'deploy')) {
      mavenCmd += ' -DskipTests';
    }

    return new Promise((resolve) => {
      // 使用PowerShell执行Maven命令
      this.currentProcess = spawn(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `cd '${microservicePath}'; ${mavenCmd}`,
        ],
        {
          shell: false,
          windowsHide: true,
        }
      );

      const process = this.currentProcess;

      process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        onProgress?.(text);
      });

      process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Maven的错误输出有时候会写到stderr，这是正常的
        output += text;
        onProgress?.(text);
      });

      process.on('close', (code: number | null) => {
        this.currentProcess = null;

        if (this.isCanceled) {
          resolve({
            success: false,
            output,
            error: '命令已被用户取消',
          });
          return;
        }

        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? `Maven命令执行失败，退出码: ${code}` : undefined,
        });
      });

      process.on('error', (err: Error) => {
        this.currentProcess = null;
        resolve({
          success: false,
          output,
          error: `执行Maven命令失败: ${err.message}`,
        });
      });
    });
  }

  /**
   * 取消当前执行的命令
   */
  cancelExecution(): void {
    this.isCanceled = true;
    if (this.currentProcess) {
      // 杀死进程树
      try {
        process.kill(-this.currentProcess.pid!, 'SIGTERM');
      } catch {
        // 如果无法杀死进程树，直接kill主进程
        this.currentProcess.kill('SIGTERM');
      }
    }
  }

  /**
   * 检测Maven是否安装
   */
  async checkMavenInstalled(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      execSync('mvn --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取Maven版本
   */
  async getMavenVersion(): Promise<string | null> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('mvn --version', { encoding: 'utf-8' });
      const match = output.match(/Apache Maven (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * 检测Maven构建产物目录
   * @param microservicePath 微服务本地路径
   * @returns 产物目录路径，如果不存在返回null
   */
  async detectOutputDir(microservicePath: string): Promise<string | null> {
    const targetPath = path.join(microservicePath, 'target');

    try {
      await fs.access(targetPath);

      // 检测可能的产物
      const entries = await fs.readdir(targetPath);

      // 查找JAR包
      const jarFiles = entries.filter(
        (f) => f.endsWith('.jar') && !f.includes('original')
      );

      if (jarFiles.length > 0) {
        return targetPath;
      }

      // 如果target目录存在但没有jar，可能是正在进行构建
      return targetPath;
    } catch {
      return null;
    }
  }

  /**
   * 获取构建产物信息
   * @param microservicePath 微服务本地路径
   * @returns 产物列表
   */
  async getBuildArtifacts(
    microservicePath: string
  ): Promise<{ type: string; path: string; size: number }[]> {
    const artifacts: { type: string; path: string; size: number }[] = [];
    const targetPath = path.join(microservicePath, 'target');

    try {
      await fs.access(targetPath);
    } catch {
      return artifacts;
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(targetPath, entry.name);

        if (entry.isFile() && entry.name.endsWith('.jar') && !entry.name.includes('original')) {
          const stats = await fs.stat(fullPath);
          artifacts.push({
            type: 'jar',
            path: fullPath,
            size: stats.size,
          });
        } else if (entry.isDirectory()) {
          // 检查是否是可部署的目录结构
          const stats = await fs.stat(fullPath);
          artifacts.push({
            type: 'dir',
            path: fullPath,
            size: stats.size,
          });
        }
      }
    } catch (error) {
      console.error(`[MavenExecutor] 获取构建产物失败: ${targetPath}`, error);
    }

    return artifacts;
  }
}

// 导出单例
export const mavenExecutor = new MavenExecutor();
