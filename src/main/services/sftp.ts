import Client from 'ssh2-sftp-client';
import { Client as SSHClient } from 'ssh2';
import fs from 'fs/promises';
import path from 'path';
import type { ServerConfig, UploadProgress } from '../../shared/types';

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
    onProgress: (progress: UploadProgress) => void
  ): Promise<void> {
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

      // 确保远程目录存在
      const remoteDir = path.posix.dirname(remoteFilePath);
      await this.sftpClient.mkdir(remoteDir, true);

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

  async executeCommand(command: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      this.sshClient.exec(command, (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${output}`));
          } else {
            resolve(output);
          }
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
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return { files, dirs };
  }
}
