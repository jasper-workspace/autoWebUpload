import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { BuildConfig, BuildProgress } from '../../shared/types';
import fs from 'fs/promises';
import path from 'path';

/**
 * ANSI 颜色码 - 参考 VSCode (前端) / IDEA (后端) 风格
 */
const Colors = {
  reset: '\x1b[0m',
  // 错误/失败 - 红色
  error: '\x1b[31m',
  // 警告 - 黄色
  warning: '\x1b[33m',
  // 成功/完成 - 绿色
  success: '\x1b[32m',
  // 文件路径/目录 - 青色 (VSCode 文件颜色)
  file: '\x1b[36m',
  // 时间戳 - 深灰色
  time: '\x1b[90m',
  // 进度/阶段/插件信息 - 蓝色
  phase: '\x1b[34m',
  // 构建时长 - 紫红色
  duration: '\x1b[35m',
};

/**
 * 日志类型
 */
type LogType = 'error' | 'warning' | 'success' | 'file' | 'time' | 'phase' | 'duration' | 'normal';

/**
 * 识别日志类型
 */
function detectLogType(line: string): LogType {
  // 先移除 ANSI 转义序列 (\x1b 或 \u241b)，只用干净文本检测类型
  const cleanLine = line.replace(/[\x1b\u241b]\[[0-9;]*[a-zA-Z]/g, '');
  const upperLine = cleanLine.toLowerCase();
  if (upperLine.includes('error') || upperLine.includes('failed') || upperLine.includes('fail to')) return 'error';
  if (upperLine.includes('warning') || upperLine.includes('warn')) return 'warning';
  if (cleanLine.includes('✓') || upperLine.includes('success') || upperLine.includes('complete')) return 'success';
  if (/dist\/|build\/|out\/|target\//.test(cleanLine)) return 'file';
  if (/^\[\d{2}:\d{2}:\d{2}\]/.test(cleanLine)) return 'time';
  if (cleanLine.includes('built in') || upperLine.includes('duration')) return 'duration';
  if (/\[\w+:\w+\]/.test(cleanLine) || cleanLine.includes('computing')) return 'phase';
  return 'normal';
}

/**
 * 为日志添加颜色
 */
function colorizeLine(line: string): string {
  if (!line.trim()) return line;
  // 清理原始 ANSI 序列 (\x1b 或 \u241b)，防止叠加乱码
  const cleanLine = line.replace(/[\x1b\u241b]\[[0-9;]*[a-zA-Z]/g, '');
  const type = detectLogType(cleanLine);
  const colorMap: Record<LogType, string> = {
    error: Colors.error,
    warning: Colors.warning,
    success: Colors.success,
    file: Colors.file,
    time: Colors.time,
    phase: Colors.phase,
    duration: Colors.duration,
    normal: '',
  };
  const color = colorMap[type];
  return color ? `${color}${cleanLine}${Colors.reset}` : cleanLine;
}

/**
 * 过滤构建输出 - 清理 ANSI 乱码，过滤文件列表
 */
function filterBuildOutput(text: string): string {
  const lines = text.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    // 跳过文件列表（dist/ 开头且包含 kB 和 │）
    if (/^dist\//.test(line) && line.includes('kB') && line.includes('\u2502')) {
      continue;
    }
    // 跳过 Vite 警告（动态导入与静态导入冲突）
    if (line.includes('dynamically imported') && line.includes('statically imported')) {
      continue;
    }
    // 跳过 Vite reporter 插件的重复信息
    if (/\[[\w\s]+:[\w\s]+\]/.test(line) && line.toLowerCase().includes('reporter')) {
      continue;
    }
    // 跳过 computing gzip size
    if (line.includes('computing gzip size')) {
      continue;
    }
    // 跳过空行（连续的）
    if (line.trim() === '') {
      const lastLine = filteredLines[filteredLines.length - 1];
      if (lastLine !== undefined && lastLine.trim() !== '') {
        filteredLines.push(line);
      }
      continue;
    }
    filteredLines.push(line);
  }

  return filteredLines.join('\n');
}

/**
 * 过滤 ANSI 转义序列
 * \x1b 是标准 ANSI ESC, \u241b 是 Unicode 表示 (Vite/某些终端使用)
 */
function stripAnsi(text: string): string {
  return text.replace(/[\x1b\u241b]\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * 处理构建输出：移除原始 ANSI + 过滤冗余信息（不添加颜色，颜色由前端控制）
 */
function processBuildOutput(text: string): string {
  // 1. 先移除原始 ANSI 颜色（Vite 自带的乱码颜色）
  let result = stripAnsi(text);
  // 2. 过滤冗余信息
  result = filterBuildOutput(result);
  return result;
}

export class LocalBuildService extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private isCanceled = false;

  // 前端常见产物目录
  private readonly FRONTEND_OUTPUT_DIRS = ['dist', 'build', 'out', 'public'];
  // 后端常见产物目录
  private readonly BACKEND_OUTPUT_DIRS = ['target', 'build', 'out'];

  /**
   * 执行本地构建
   * @param config 构建配置
   */
  async executeBuild(
    config: BuildConfig
  ): Promise<{ success: boolean; output: string; error?: string; duration: number; detectedOutputDir?: string }> {
    this.isCanceled = false;

    const startTime = Date.now();
    const possibleOutputDirs = config.type === 'frontend' ? this.FRONTEND_OUTPUT_DIRS : this.BACKEND_OUTPUT_DIRS;

    // 验证路径和命令
    if (!config.localPath || !config.buildCommand) {
      return {
        success: false,
        output: '',
        error: `缺少${config.type}构建配置：路径或命令未设置`,
        duration: 0,
      };
    }

    // 产物目录自动检测
    let detectedOutputDir: string | undefined = config.outputDir || undefined;
    if (!detectedOutputDir) {
      this.reportProgress(config.type, '正在自动检测产物目录...', 0, 'building');
      const detected = await this.detectOutputDir(config.localPath, possibleOutputDirs);
      if (detected) {
        detectedOutputDir = detected;
        this.reportProgress(config.type, `检测到产物目录: ${detectedOutputDir}`, 10, 'building');
      } else {
        return {
          success: false,
          output: '',
          error: `无法自动检测${config.type}产物目录，请手动配置`,
          duration: 0,
        };
      }
    }

    this.reportProgress(config.type, '正在启动构建...', 10, 'building');

    try {
      // 合并环境变量（过滤掉undefined值）
      const env: Record<string, string> = {};
      Object.entries({ ...process.env, ...config.envVars }).forEach(([key, value]) => {
        if (value !== undefined) {
          env[key] = value;
        }
      });
      const result = await this.runCommand(config.buildCommand, config.localPath, config.type, env);

      if (this.isCanceled) {
        return { success: false, output: '构建已取消', error: 'canceled', duration: 0 };
      }

      return {
        ...result,
        duration: Date.now() - startTime,
        detectedOutputDir,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 自动检测产物目录
   */
  async detectOutputDir(
    projectPath: string,
    possibleDirs: string[]
  ): Promise<string | null> {
    for (const dir of possibleDirs) {
      const fullPath = path.join(projectPath, dir);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          // 检查目录是否非空
          const files = await fs.readdir(fullPath);
          if (files.length > 0) {
            return dir;
          }
        }
      } catch {
        // 目录不存在，继续检查下一个
      }
    }
    return null;
  }

  /**
   * 取消正在执行的构建
   */
  cancelBuild(): void {
    if (this.currentProcess) {
      this.isCanceled = true;
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  /**
   * 执行命令并实时报告进度
   */
  private runCommand(
    command: string,
    cwd: string,
    type: 'frontend' | 'backend',
    env?: Record<string, string>
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      let output = '';
      let lastProgress = 10;

      // Windows 下使用 cmd.exe 执行
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      this.currentProcess = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const text = processBuildOutput(data.toString());
        output += text;

        // 模拟进度 (实际进度需要解析构建工具输出)
        if (!this.isCanceled) {
          lastProgress = Math.min(lastProgress + 3, 95);
          this.reportProgress(type, '构建中...', lastProgress, 'building', output);
        }
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const text = processBuildOutput(data.toString());
        output += text;
        // stderr 同样需要实时报告（如 npm warn 信息）
        if (!this.isCanceled) {
          this.reportProgress(type, '构建中...', lastProgress, 'building', output);
        }
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        this.reportProgress(type, '构建完成', 100, code === 0 ? 'success' : 'error', output);

        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? `构建失败，退出码: ${code}` : undefined,
        });
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        this.reportProgress(type, '构建失败', 0, 'error');
        resolve({ success: false, output, error: error.message });
      });
    });
  }

  /**
   * 报告构建进度
   */
  private reportProgress(
    type: 'frontend' | 'backend',
    step: string,
    percentage: number,
    status: 'building' | 'success' | 'error' | 'canceled',
    output?: string
  ): void {
    const progress: BuildProgress = {
      phase: 'building',
      step: `[${type === 'frontend' ? '前端' : '后端'}] ${step}`,
      percentage,
      status,
      output,
    };
    this.emit('progress', progress);
  }
}
