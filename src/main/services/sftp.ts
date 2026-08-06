import Client from 'ssh2-sftp-client';
import { Client as SSHClient } from 'ssh2';
import fs from 'fs/promises';
import path from 'path';
import type { ServerConfig, UploadProgress, UploadFolderOptions } from '../../shared/types';
import { logger } from '../logger';
import { logDeploymentCommand, logDeploymentResult } from './deploymentLog';

/** 日志级别 */
type LogType = 'info' | 'error' | 'warning' | 'success' | 'config';

/** 统一日志出口：消息 + 级别 */
type LogSink = (message: string, type?: LogType) => void;

/**
 * 仅写入文件的兜底日志（electron-log）。
 * 当调用方未提供 onLog（如脱离上传流程单独调用清理方法）时回退使用，保证不丢日志。
 */
const fileOnlyLog: LogSink = (message, type = 'info') => {
  if (type === 'error') {
    logger.error(message);
  } else if (type === 'warning') {
    logger.warn(message);
  } else {
    logger.info(message);
  }
};

export class SFTPService {
  private sftpClient: InstanceType<typeof Client>;
  private sshClient: SSHClient;
  private connected: boolean = false;

  constructor() {
    this.sftpClient = new Client();
    this.sshClient = new SSHClient();
  }

  async connect(config: ServerConfig): Promise<void> {
    const connectConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username
    };

    if (config.password) {
      connectConfig.password = config.password;
    } else if (config.privateKey) {
      connectConfig.privateKey = config.privateKey;
    }

    await this.sftpClient.connect(connectConfig);
    
    // 同时建立 SSH 连接用于执行命令
    await new Promise<void>((resolve, reject) => {
      this.sshClient.connect(connectConfig).on('ready', () => {
        resolve();
      }).on('error', (err: Error) => {
        reject(err);
      });
    });
    
    this.connected = true;
  }

  async uploadFolder(
    localPath: string,
    remotePath: string,
    onProgress: (progress: UploadProgress) => void,
    options?: UploadFolderOptions
  ): Promise<void> {
    // 检查路径是文件还是目录
    const stats = await fs.stat(localPath);
    // 远程目录：目录上传时为 remotePath；单文件上传时取「remotePath + 文件名」所在目录，
    // 这样即使 remotePath 本身是目录也能正确落到文件实际部署的目录（避免多上一层）
    const remoteDir = stats.isFile()
      ? path.posix.dirname(path.posix.join(remotePath, path.basename(localPath)))
      : remotePath;

    // 统一日志出口：同时写入文件并向渲染端操作日志面板（通过 options.onLog）发送，
    // 保证「新增部署设置只扩展描述符」的好处延续到面板（开闭原则）
    const emitLog: LogSink = (message, type = 'info') => {
      fileOnlyLog(message, type);
      options?.onLog?.(message, type);
    };

    // 读取部署配置：每项作为「命令 + 操作结果」完整执行单元就近打印
    emitLog('读取部署配置', 'config');

    // 延迟项打印标记（避免目录上传多 jar / 多文件时重复输出命令行）
    let keepDeployedJarPrinted = false;
    let jarCountOptionPrinted = false;

    // 收尾：对启用但因本次无对应文件而未执行的延迟项，补打「操作结果: 未执行」
    const flushDeferredNoOps = (): void => {
      if (options?.keepDeployedJar !== false && !keepDeployedJarPrinted) {
        logDeploymentCommand(emitLog, options, 'keepDeployedJar');
        logDeploymentResult(emitLog, '未执行（本次上传无 jar 包）');
        keepDeployedJarPrinted = true;
      }
      if ((options?.keepJarCount ?? 0) > 0 && !jarCountOptionPrinted) {
        logDeploymentCommand(emitLog, options, 'keepJarCount');
        logDeploymentResult(emitLog, '未执行（本次上传无 jar 包）');
        jarCountOptionPrinted = true;
      }
    };

    // 是否上传 sourcemap：静态设置，单位完整打印
    logDeploymentCommand(emitLog, options, 'uploadSourcemap');
    logDeploymentResult(
      emitLog,
      options?.uploadSourcemap === true ? '已开启（上传时包含 .map 文件）' : '未执行（已关闭，跳过 .map 文件）'
    );

    // 是否保留已部署 jar 包：关闭时顶部打印未执行；开启时推迟到首次备份时打印命令与结果
    if (options?.keepDeployedJar === false) {
      logDeploymentCommand(emitLog, options, 'keepDeployedJar');
      logDeploymentResult(emitLog, '未执行（已关闭）');
    }

    // 删除远端 bes 文件：立即执行清理，命令与结果相邻
    logDeploymentCommand(emitLog, options, 'deleteBesFiles');
    if (options?.deleteBesFiles) {
      await this.cleanBesFiles(remoteDir, emitLog);
    } else {
      logDeploymentResult(emitLog, '未执行（已关闭）');
    }

    // 远端保留 jar 数量：<=0 时顶部打印未执行；>0 时推迟到清理时打印命令与结果
    if ((options?.keepJarCount ?? 0) <= 0) {
      logDeploymentCommand(emitLog, options, 'keepJarCount');
      logDeploymentResult(emitLog, '未执行（保留数量=0）');
    }

    if (stats.isFile()) {
      // 处理单个文件上传
      const fileName = path.basename(localPath);
      const remoteFilePath = path.posix.join(remotePath, fileName);

      // sourcemap 过滤：开关关闭时跳过 .map 文件
      if (this.isSourcemapFile(fileName) && options?.uploadSourcemap !== true) {
        emitLog(`跳过 sourcemap 文件: ${fileName}（配置未开启上传）`);
        flushDeferredNoOps();
        onProgress({
          totalFiles: 1,
          uploadedFiles: 1,
          currentFile: fileName,
          percentage: 100,
          status: 'success'
        });
        return;
      }

      onProgress({
        totalFiles: 1,
        uploadedFiles: 0,
        currentFile: fileName,
        percentage: 0,
        status: 'uploading'
      });
      
      // 创建一个模拟进度的定时器
      let progressPercentage = 0;
      const progressInterval = setInterval(() => {
        // 每次增加2%，直到95%
        if (progressPercentage < 95) {
          progressPercentage += 2;
          onProgress({
            totalFiles: 1,
            uploadedFiles: 0,
            currentFile: fileName,
            percentage: progressPercentage,
            status: 'uploading'
          });
        }
      }, 1000); // 每1000ms(1秒)更新一次
      
      try {
        // jar 备份：上传前重命名远程同名 jar（keepDeployedJar 开启时，命令与结果就近打印）
        if (this.isJarFile(fileName) && options?.keepDeployedJar !== false) {
          if (await this.sftpClient.exists(remoteFilePath)) {
            if (!keepDeployedJarPrinted) {
              logDeploymentCommand(emitLog, options, 'keepDeployedJar');
              keepDeployedJarPrinted = true;
            }
            logDeploymentResult(emitLog, `备份已部署 jar 包: ${remoteFilePath}`);
            await this.backupRemoteJar(remoteFilePath, emitLog);
          }
        }

        // 上传单个文件
        emitLog('上传中...');
        await this.sftpClient.put(localPath, remoteFilePath);
        emitLog('上传完成');

        // REQ004: 上传成功后按保留数量清理历史同名 jar 备份（keepJarCount>0 时，命令与结果就近打印）
        if (this.isJarFile(fileName) && (options?.keepJarCount ?? 0) > 0) {
          if (!jarCountOptionPrinted) {
            logDeploymentCommand(emitLog, options, 'keepJarCount');
            jarCountOptionPrinted = true;
          }
          await this.pruneOldJars(remoteDir, fileName, options, emitLog);
        }

        // 清除模拟进度定时器
        clearInterval(progressInterval);
        
        // 设置为100%
        onProgress({
          totalFiles: 1,
          uploadedFiles: 0,
          currentFile: fileName,
          percentage: 100,
          status: 'uploading'
        });
        
        onProgress({
          totalFiles: 1,
          uploadedFiles: 1,
          currentFile: fileName,
          percentage: 100,
          status: 'success'
        });
      } catch (error) {
        // 如果上传失败，清除定时器
        clearInterval(progressInterval);
        throw error;
      }
      
      flushDeferredNoOps();
      return;
    }
    
    // 处理目录上传（原有逻辑）
    const result = await this.scanFolder(localPath);
    const files = result.files;
    const dirs = result.dirs;
    const totalItems = files.length + dirs.length;

    onProgress({
      totalFiles: files.length,
      uploadedFiles: 0,
      currentFile: '',
      percentage: 0,
      status: 'uploading'
    });

    // 先创建所有目录
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const relativePath = path.relative(localPath, dir);
      const remoteDirPath = path.posix.join(remotePath, relativePath.replace(/\\/g, '/'));
      
      await this.sftpClient.mkdir(remoteDirPath, true);
    }

    // 再上传所有文件
    emitLog(`开始上传文件（共 ${files.length} 个）...`);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(localPath, file);
      const remoteFilePath = path.posix.join(remotePath, relativePath.replace(/\\/g, '/'));
      const fileName = path.basename(file);

      // sourcemap 过滤：开关关闭时跳过 .map 文件
      if (this.isSourcemapFile(fileName) && options?.uploadSourcemap !== true) {
        emitLog(`跳过 sourcemap 文件: ${relativePath}（配置未开启上传）`);
        onProgress({
          totalFiles: files.length,
          uploadedFiles: i + 1,
          currentFile: relativePath,
          percentage: Math.round(((i + 1) / files.length) * 100),
          status: 'uploading'
        });
        continue;
      }

      // 确保远程目录存在
      const remoteDir = path.posix.dirname(remoteFilePath);
      await this.sftpClient.mkdir(remoteDir, true);

      // jar 备份：上传前重命名远程同名 jar（keepDeployedJar 开启时，命令与结果就近打印）
      if (this.isJarFile(fileName) && options?.keepDeployedJar !== false) {
        if (await this.sftpClient.exists(remoteFilePath)) {
          if (!keepDeployedJarPrinted) {
            logDeploymentCommand(emitLog, options, 'keepDeployedJar');
            keepDeployedJarPrinted = true;
          }
          logDeploymentResult(emitLog, `备份已部署 jar 包: ${remoteFilePath}`);
          await this.backupRemoteJar(remoteFilePath, emitLog);
        }
      }

      // 上传文件
      await this.sftpClient.fastPut(file, remoteFilePath);

      // REQ004: 上传成功后按保留数量清理历史同名 jar 备份（keepJarCount>0 时，命令与结果就近打印）
      if (this.isJarFile(fileName) && (options?.keepJarCount ?? 0) > 0) {
        if (!jarCountOptionPrinted) {
          logDeploymentCommand(emitLog, options, 'keepJarCount');
          jarCountOptionPrinted = true;
        }
        await this.pruneOldJars(remoteDir, fileName, options, emitLog);
      }

      onProgress({
        totalFiles: files.length,
        uploadedFiles: i + 1,
        currentFile: relativePath,
        percentage: Math.round(((i + 1) / files.length) * 100),
        status: 'uploading'
      });
    }

    // 收尾：对启用但因本次无 jar 包而未执行的延迟项，补打「操作结果: 未执行」
    flushDeferredNoOps();

    emitLog('文件上传完成');

    onProgress({
      totalFiles: files.length,
      uploadedFiles: files.length,
      currentFile: '',
      percentage: 100,
      status: 'success'
    });
  }

  async executeCommand(command: string): Promise<{ success: boolean; output: string; error?: string }> {
    return await new Promise((resolve, reject) => {
      // 使用 bash -l 来加载登录 shell 的环境变量
      const fullCommand = `bash -l -c '${command.replace(/'/g, "'\\''")}'`;

      this.sshClient.exec(fullCommand, (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          if (code !== 0) {
            resolve({
              success: false,
              output: output,
              error: errorOutput || `Command failed with code ${code}`
            });
          } else {
            resolve({
              success: true,
              output: output,
              error: errorOutput
            });
          }
        });
      });
    });
  }

  // 新增方法：专门用于获取日志，处理tail命令
  async fetchLogs(command: string): Promise<string> {
    return await new Promise((resolve, reject) => {

      // 处理tail -f命令，转换为普通tail命令
      let modifiedCommand = command || '';
      if (command && command.includes('tail -f')) {
        // 解析命令参数
        const parts = command.split(' ');
        const newParts: string[] = [];

        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === 'tail') {
            newParts.push('tail');
          } else if (parts[i] === '-f') {
            // 跳过 -f 参数
            continue;
          } else {
            newParts.push(parts[i]);
          }
        }

        modifiedCommand = newParts.join(' ');

        // 如果没有行数参数，添加默认值
        if (modifiedCommand && !modifiedCommand.includes('-n')) {
          modifiedCommand = modifiedCommand.replace('tail', 'tail -n 100');
        }

        console.log('fetchLogs: 转换后的命令:', modifiedCommand);
      }

      // 使用 bash -l 来加载登录 shell 的环境变量，并使用单引号避免转义问题
      const fullCommand = `bash -l -c '${modifiedCommand.replace(/'/g, "'\\''")}'`;

      // 执行修改后的命令
      this.sshClient.exec(fullCommand, (err: any, stream: any) => {
        if (err) {
          console.error('fetchLogs: 命令执行失败:', err);
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data: Buffer) => {
          // 确保将Buffer转换为字符串
          const chunk = data.toString();
          output += chunk;
        });

        stream.stderr.on('data', (data: Buffer) => {
          // 确保将Buffer转换为字符串
          const chunk = data.toString();
          errorOutput += chunk;
          console.error('fetchLogs: stderr数据:', chunk);
        });

        stream.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${errorOutput || output}`));
          } else {
            // 确保output是纯字符串
            const finalOutput = errorOutput ? `${output}\n${errorOutput}` : output;
            resolve(typeof finalOutput === 'string' ? finalOutput : String(finalOutput));
          }
        });

        stream.on('error', (err: Error) => {
          console.error('fetchLogs: stream错误:', err);
          reject(err);
        });
      });
    });
  }

  // 执行实时日志流命令
  async executeLogStream(command: string, onData: (data: string) => void): Promise<void> {
    return await new Promise((resolve, reject) => {
      console.log('executeLogStream: 原始命令:', command);

      // 使用 bash -l 来加载登录 shell 的环境变量
      const fullCommand = `bash -l -c '${command.replace(/'/g, "'\\''")}'`;

      this.sshClient.exec(fullCommand, (err: any, stream: any) => {
        if (err) {
          console.error('executeLogStream: 命令执行失败:', err);
          reject(err);
          return;
        }

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString();
          onData(chunk);
        });

        stream.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          onData(chunk);
        });

        stream.on('close', (code: number) => {
          resolve();
        });

        stream.on('error', (err: Error) => {
          console.error('executeLogStream: stream错误:', err);
          reject(err);
        });
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.sftpClient.end();
      this.sshClient.end();
      this.connected = false;
    }
  }

  /**
   * 判断是否为 sourcemap 文件（以 .map 结尾）
   */
  private isSourcemapFile(fileName: string): boolean {
    return fileName.endsWith('.map');
  }

  /**
   * 判断是否为可部署 jar 包（以 .jar 结尾且非 -sources.jar）
   */
  private isJarFile(fileName: string): boolean {
    return fileName.endsWith('.jar') && !fileName.endsWith('-sources.jar');
  }

  /**
   * 生成 MMDD 格式日期串（月+日，4 位）
   * @param date 日期，默认当前时间
   */
  private formatDateMMDD(date: Date = new Date()): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}${day}`;
  }

  /**
   * 上传前备份远程同名 jar 包
   * 备份名中的日期取远程原 jar 包在服务器上的更新时间（modifyTime），而非当前日期；
   * 规则：首个备份为 *.jarMMDD；若该名已存在则追加递增序号 *.jarMMDD_1、*.jarMMDD_2...
   * @param remoteFilePath 远程原始 jar 文件路径
   */
  private async backupRemoteJar(remoteFilePath: string, logFn: LogSink = fileOnlyLog): Promise<void> {
    // 取远程原 jar 的更新时间作为备份日期；获取失败时回退到当前日期
    let backupDate = new Date();
    try {
      const stat = await this.sftpClient.stat(remoteFilePath) as any;
      const modifyTime = stat?.modifyTime ?? stat?.mtime;
      if (modifyTime) {
        backupDate = new Date(modifyTime);
      }
    } catch {
      backupDate = new Date();
    }

    const backupBase = `${remoteFilePath}${this.formatDateMMDD(backupDate)}`;

    // 基础备份名不存在，直接重命名为 *.jarMMDD
    if (!(await this.sftpClient.exists(backupBase))) {
      await this.sftpClient.rename(remoteFilePath, backupBase);
      return;
    }

    // 已存在则追加递增序号，取最小未占用值
    let index = 1;
    let target = `${backupBase}_${index}`;
    while (await this.sftpClient.exists(target)) {
      index++;
      target = `${backupBase}_${index}`;
    }
    await this.sftpClient.rename(remoteFilePath, target);
  }

  private async scanFolder(dir: string): Promise<{ files: string[]; dirs: string[] }> {
    const files: string[] = [];
    const dirs: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 收集所有目录（包括空目录）
        dirs.push(fullPath);
        const subResult = await this.scanFolder(fullPath);
        files.push(...subResult.files);
        dirs.push(...subResult.dirs);
      } else if (entry.isFile() && !entry.name.endsWith('-sources.jar')) {
        files.push(fullPath);
      }
    }

    return { files, dirs };
  }

  /**
   * REQ004: 上传前清理远端「目标目录」下的 bes.* 文件/目录
   * - 仅清理传入的 remoteDir 本身（即本次部署的目标目录），不递归进入其子目录，
   *   避免误删目标目录之外其他子目录里的 bes 文件
   * - 匹配以 bes 开头、后接分隔符（. _ -）的条目，如 bes.5731.9809 / bes.log / bes_domain.log
   * - bes 可能是文件也可能是目录：文件用 delete，目录用 rmdir(fullPath, true) 整目录删除（库内部递归清空内容）
   */
  private async cleanBesFiles(remoteDir: string, logFn: LogSink = fileOnlyLog): Promise<void> {
    try {
      const list = await this.sftpClient.list(remoteDir) as Array<{ type: string; name: string }>;
      const besEntries = list.filter((f) => /^bes[.\-_]/i.test(f.name));
      if (besEntries.length === 0) {
        logFn('操作结果: 未执行（目标目录下不存在 bes 文件）', 'config');
        return;
      }
      for (const f of besEntries) {
        const fullPath = path.posix.join(remoteDir, f.name);
        if (f.type === 'd') {
          await this.sftpClient.rmdir(fullPath, true);
        } else {
          await this.sftpClient.delete(fullPath);
        }
        logFn(`操作结果: 已删除 bes 文件: ${fullPath}`, 'config');
      }
    } catch (error: any) {
      logFn(`操作结果: 清理失败 (${remoteDir}): ${error?.message || error}`, 'error');
    }
  }

  /**
   * 计算 jar 文件的时间排序键（越大越新）
   * - 活动 jar（无后缀）视为最新
   * - 备份 jar 按后缀 MMDD 降序、_n 序号降序
   */
  private jarTimeKey(name: string, activeName: string): number {
    if (name === activeName) {
      return Number.MAX_SAFE_INTEGER;
    }
    const m = name.match(/(\d{4})(?:_(\d+))?$/);
    if (!m) {
      return 0;
    }
    const mmdd = parseInt(m[1], 10);
    const seq = m[2] ? parseInt(m[2], 10) : 0;
    return mmdd * 100 + seq;
  }

  /**
   * REQ004: 上传成功后按保留数量清理历史同名 jar 备份
   * - 活动 jar（无后缀）始终保留，且不占用 keepJarCount 名额
   * - 在备份中按时间降序保留最新 keepJarCount 个，其余删除
   */
  private async pruneOldJars(remoteDir: string, activeFileName: string, options?: UploadFolderOptions, logFn: LogSink = fileOnlyLog): Promise<void> {
    const keep = options?.keepJarCount ?? 0;
    if (keep <= 0) {
      logFn('操作结果: 未执行（保留数量=0，不进行清理）', 'config');
      return;
    }
    try {
      const list = await this.sftpClient.list(remoteDir) as Array<{ type: string; name: string }>;
      const escaped = activeFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}(\\d{4}(_\\d+)?)?$`);
      const matches = list.filter((f) => f.type === '-' && regex.test(f.name));
      logFn(`操作结果: 当前历史 jar 数量: ${matches.length}`, 'config');
      // 活动 jar 始终保留且不计入名额，故仅当「活动 + keep 个备份」之外还有多余时才清理
      if (matches.length <= keep + 1) {
        logFn('操作结果: 未执行（未超过保留数量）', 'config');
        return;
      }
      // 按时间降序排序（最新在前，活动 jar 恒为第一），保留活动 jar + 最新 keep 个备份，删除其余
      const sorted = matches.sort(
        (a, b) => this.jarTimeKey(b.name, activeFileName) - this.jarTimeKey(a.name, activeFileName)
      );
      const toDelete = sorted.slice(keep + 1);
      const names = toDelete.map((f) => f.name);
      for (const name of names) {
        await this.sftpClient.delete(path.posix.join(remoteDir, name));
        logFn(`操作结果: 执行删除历史 jar 包: ${name}`, 'config');
      }
    } catch (error: any) {
      logFn(`操作结果: 清理失败: ${error?.message || error}`, 'error');
    }
  }
}
