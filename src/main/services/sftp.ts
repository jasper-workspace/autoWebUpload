import Client from 'ssh2-sftp-client';
import { Client as SSHClient } from 'ssh2';
import fs from 'fs/promises';
import path from 'path';
import type { ServerConfig, UploadProgress, UploadFolderOptions } from '../../shared/types';

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
    
    if (stats.isFile()) {
      // 处理单个文件上传
      const fileName = path.basename(localPath);
      const remoteFilePath = path.posix.join(remotePath, fileName);

      // sourcemap 过滤：开关关闭时跳过 .map 文件
      if (this.isSourcemapFile(fileName) && options?.uploadSourcemap !== true) {
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
        // jar 备份：上传前重命名远程同名 jar
        if (this.isJarFile(fileName) && options?.keepDeployedJar !== false) {
          if (await this.sftpClient.exists(remoteFilePath)) {
            await this.backupRemoteJar(remoteFilePath);
          }
        }

        // 上传单个文件
        await this.sftpClient.put(localPath, remoteFilePath);
        
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
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(localPath, file);
      const remoteFilePath = path.posix.join(remotePath, relativePath.replace(/\\/g, '/'));
      const fileName = path.basename(file);

      // sourcemap 过滤：开关关闭时跳过 .map 文件
      if (this.isSourcemapFile(fileName) && options?.uploadSourcemap !== true) {
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

      // jar 备份：上传前重命名远程同名 jar
      if (this.isJarFile(fileName) && options?.keepDeployedJar !== false) {
        if (await this.sftpClient.exists(remoteFilePath)) {
          await this.backupRemoteJar(remoteFilePath);
        }
      }

      // 上传文件
      await this.sftpClient.fastPut(file, remoteFilePath);

      onProgress({
        totalFiles: files.length,
        uploadedFiles: i + 1,
        currentFile: relativePath,
        percentage: Math.round(((i + 1) / files.length) * 100),
        status: 'uploading'
      });
    }

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
  private async backupRemoteJar(remoteFilePath: string): Promise<void> {
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
}
