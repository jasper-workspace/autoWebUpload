
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

  // 构建进度报告节流：最小间隔(ms)
  private readonly REPORT_THROTTLE_MS = 500;
  private lastReportTime = 0;

  /**
   * 执行Maven命令
   * @param microservicePath 微服务本地路径（绝对路径）
   * @param command Maven命令类型
   * @param skipTests 是否跳过测试
   * @param onProgress 进度回调函数
   * @param mavenPath 自定义Maven路径（可选，留空使用系统PATH中的mvn）
   * @param javaPath 自定义Java路径（可选，留空使用系统默认Java）
   * @returns 执行结果
   */
  async executeCommand(
    microservicePath: string,
    command: 'clean' | 'compile' | 'package' | 'install' | 'deploy',
    skipTests: boolean = true,
    onProgress?: (output: string) => void,
    mavenPath?: string,
    javaPath?: string,
    reactorPath?: string
  ): Promise<{ success: boolean; output: string; error?: string }> {
    this.isCanceled = false;
    let output = '';

    // 构建Maven命令
    const mvnCmdName = mavenPath ? `${mavenPath}\\bin\\mvn.cmd` : 'mvn';
    let mavenCmd = `${mvnCmdName} ${command}`;
    if (skipTests && (command === 'package' || command === 'install' || command === 'deploy')) {
      mavenCmd += ' -DskipTests';
    }

    // 确定执行目录和命令
    let execDir = microservicePath;
    let finalCommand = mavenCmd;

    // 如果提供了reactorPath，使用 reactor build 模式
    if (reactorPath) {
      // 计算相对于 reactorPath 的模块路径（相对于reactor根目录）
      const relativePomPath = path.relative(reactorPath, microservicePath);
      // 去掉末尾的 pom.xml
      const modulePath = relativePomPath.replace(/[/\\]pom\.xml$/, '');

      execDir = reactorPath;
      // 在 reactor 根目录执行，使用 -pl 指定模块，-am 同时构建依赖
      // 不使用引号，Windows cmd 对路径格式的处理可能有问题
      finalCommand = `${mavenCmd} -pl ${modulePath} -am`;
      console.log(`[MavenExecutor] Reactor Build: ${finalCommand} (执行目录: ${execDir})`);
    }

    // 构建PowerShell命令，设置UTF-8编码
    // 关键修复：JAVA_TOOL_OPTIONS 强制 JVM 使用 UTF-8 编码输出，解决 Java 编译器中文警告乱码问题
    const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $env:JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8"; $env:MAVEN_OPTS="-Dmdep.outputFile=target/maven-media.properties"; chcp 65001 > $null; cd '${execDir}'; ${finalCommand}`;

    return new Promise((resolve) => {
      // 使用PowerShell执行Maven命令
      // 修复spawn powershell ENOENT问题：使用绝对路径确保在所有Windows环境中都能找到powershell
      const powershellPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      
      this.currentProcess = spawn(
        powershellPath,
        [
          '-NoProfile',
          '-NoLogo',
          '-Command',
          psCommand,
        ],
        {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      const mavenProcess = this.currentProcess;
      console.log('[MavenExecutor] Maven进程已启动, PID:', this.currentProcess.pid);

      // 输出缓冲区，用于累积不完整的行尾
      let buffer = '';

      // 发送单行日志的辅助函数
      const sendLine = (line: string) => {
        if (line) {
          onProgress?.(line + '\n');
        }
      };

      // 处理累积的文本，按换行符分割并逐行发送
      const flushBuffer = () => {
        if (!this.isCanceled) {
          const now = Date.now();
          if (now - this.lastReportTime >= this.REPORT_THROTTLE_MS) {
            if (buffer) {
              const lines = buffer.split('\n');
              // 保留最后一行（可能不完整）
              for (let i = 0; i < lines.length - 1; i++) {
                sendLine(lines[i]);
              }
              buffer = lines[lines.length - 1];
            }
            this.lastReportTime = now;
          }
        }
      };

      process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        buffer += text;

        // 达到节流时间则发送
        flushBuffer();
      });

      process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Maven的错误输出有时候会写到stderr，这是正常的
        output += text;
        buffer += text;

        // 达到节流时间则发送
        flushBuffer();
      });

      process.on('close', (code: number | null) => {
        this.currentProcess = null;

        // 发送剩余的所有完整行
        if (buffer) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            sendLine(line);
          }
          buffer = '';
        }

        if (this.isCanceled) {
          resolve({
            success: false,
            output,
            error: '命令已被用户取消',
          });
          return;
        }

        // 构建失败时，提取错误信息
        let errorMsg: string | undefined;
        if (code !== 0) {
          // 提取最后几行错误信息（通常错误在最后）
          const lines = output.split('\n').filter(l => l.trim());
          const errorLines = lines.filter(l =>
            l.toLowerCase().includes('error') ||
            l.toLowerCase().includes('failed') ||
            l.toLowerCase().includes('exception') ||
            l.toLowerCase().includes('fail') ||
            l.toLowerCase().includes('compilation failure')
          );
          // 取最后10行错误相关内容
          const lastErrors = errorLines.slice(-10).join('\n');
          errorMsg = lastErrors
            ? `Maven构建失败，退出码: ${code}\n${lastErrors}`
            : `Maven构建失败，退出码: ${code}`;
        }

        resolve({
          success: code === 0,
          output,
          error: errorMsg,
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
   * @param mavenPath 自定义Maven路径（可选，留空使用系统PATH中的mvn）
   */
  async checkMavenInstalled(mavenPath?: string): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const mvnCmd = mavenPath ? `${mavenPath}\\bin\\mvn.cmd` : 'mvn';
      execSync(`${mvnCmd} --version`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取Maven版本
   * @param mavenPath 自定义Maven路径（可选，留空使用系统PATH中的mvn）
   */
  async getMavenVersion(mavenPath?: string): Promise<string | null> {
    try {
      const { execSync } = require('child_process');
      const mvnCmd = mavenPath ? `${mavenPath}\\bin\\mvn.cmd` : 'mvn';
      const output = execSync(`${mvnCmd} --version`, { encoding: 'utf-8' });
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

        // 只上传 jar 包文件，排除 original 文件（Spring Boot repackage 生成的文件）和 sources.jar（源码包）
        if (entry.isFile() && entry.name.endsWith('.jar') && !entry.name.includes('original') && !entry.name.endsWith('-sources.jar')) {
          const stats = await fs.stat(fullPath);
          artifacts.push({
            type: 'jar',
            path: fullPath,
            size: stats.size,
          });
        }
        // 不上传目录
      }
    } catch (error) {
      console.error(`[MavenExecutor] 获取构建产物失败: ${targetPath}`, error);
    }

    return artifacts;
  }
}

// 导出单例
export const mavenExecutor = new MavenExecutor();
