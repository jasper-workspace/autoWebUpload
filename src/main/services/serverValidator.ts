import { Client as SSHClient } from 'ssh2';
import type { ServerConfig } from '../../shared/types';

export interface ValidationResult {
  success: boolean;
  connection: ConnectionResult;
  diskSpace?: DiskSpaceResult;
  remotePath?: PathResult;
  message?: string;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
}

export interface DiskSpaceResult {
  success: boolean;
  total: number;
  used: number;
  free: number;
  freePercentage: number;
  warning: boolean;
  message: string;
}

export interface PathResult {
  success: boolean;
  exists: boolean;
  writable: boolean;
  message: string;
}

export class ServerValidator {
  private sshClient: SSHClient;

  constructor() {
    this.sshClient = new SSHClient();
  }

  async validateServer(config: ServerConfig): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: false,
      connection: { success: false, message: '' },
    };

    try {
      result.connection = await this.checkConnection(config);
      if (!result.connection.success) {
        result.message = '服务器连接失败';
        return result;
      }

      result.diskSpace = await this.checkDiskSpace(config);
      result.remotePath = await this.checkRemotePath(config);

      result.success = result.connection.success && 
                      (!result.diskSpace || result.diskSpace.success) && 
                      (!result.remotePath || result.remotePath.success);

      if (result.success) {
        result.message = '服务器验证通过';
      } else if (result.diskSpace?.warning) {
        result.message = '服务器验证通过，但磁盘空间不足';
      } else {
        result.message = '服务器验证未完全通过';
      }

      return result;
    } finally {
      if ((this.sshClient as any)._eventsCount > 0) {
        try {
          this.sshClient.end();
        } catch {
          // 忽略关闭错误
        }
      }
    }
  }

  async checkConnection(config: ServerConfig): Promise<ConnectionResult> {
    return new Promise((resolve) => {
      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 10000,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      }

      this.sshClient = new SSHClient();

      this.sshClient.on('ready', () => {
        resolve({ success: true, message: 'SSH连接成功' });
      });

      this.sshClient.on('error', (err: Error) => {
        resolve({ success: false, message: `SSH连接失败: ${err.message}` });
      });

      this.sshClient.on('timeout', () => {
        resolve({ success: false, message: 'SSH连接超时' });
      });

      this.sshClient.connect(connectConfig);
    });
  }

  async checkDiskSpace(config: ServerConfig): Promise<DiskSpaceResult> {
    if (!(this.sshClient as any)._sock) {
      return {
        success: false,
        total: 0,
        used: 0,
        free: 0,
        freePercentage: 0,
        warning: false,
        message: '未建立SSH连接',
      };
    }

    return new Promise((resolve) => {
      this.sshClient.exec('df -h /', (err: any, stream: any) => {
        if (err) {
          resolve({
            success: false,
            total: 0,
            used: 0,
            free: 0,
            freePercentage: 0,
            warning: false,
            message: `执行命令失败: ${err.message}`,
          });
          return;
        }

        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.on('close', (code: number) => {
          if (code !== 0) {
            resolve({
              success: false,
              total: 0,
              used: 0,
              free: 0,
              freePercentage: 0,
              warning: false,
              message: '命令执行失败',
            });
            return;
          }

          try {
            const lines = output.trim().split('\n');
            if (lines.length < 2) {
              resolve({
                success: false,
                total: 0,
                used: 0,
                free: 0,
                freePercentage: 0,
                warning: false,
                message: '无法解析磁盘信息',
              });
              return;
            }

            const parts = lines[1].split(/\s+/);
            if (parts.length < 5) {
              resolve({
                success: false,
                total: 0,
                used: 0,
                free: 0,
                freePercentage: 0,
                warning: false,
                message: '磁盘信息格式错误',
              });
              return;
            }

            const total = this.parseSize(parts[1]);
            const used = this.parseSize(parts[2]);
            const available = this.parseSize(parts[3]);
            const freePercentage = parts[4].replace('%', '');
            const freePercentNum = parseFloat(freePercentage);
            const warning = freePercentNum < 10;

            resolve({
              success: true,
              total,
              used,
              free: available,
              freePercentage: freePercentNum,
              warning,
              message: warning 
                ? `警告：可用空间仅 ${freePercentNum}% (约 ${this.formatSize(available)})`
                : `可用空间 ${freePercentNum}% (约 ${this.formatSize(available)})`,
            });
          } catch (e) {
            resolve({
              success: false,
              total: 0,
              used: 0,
              free: 0,
              freePercentage: 0,
              warning: false,
              message: `解析磁盘信息失败: ${(e as Error).message}`,
            });
          }
        });
      });
    });
  }

  async checkRemotePath(config: ServerConfig): Promise<PathResult> {
    if (!(this.sshClient as any)._sock) {
      return {
        success: false,
        exists: false,
        writable: false,
        message: '未建立SSH连接',
      };
    }

    const remotePath = config.remotePath || '/tmp';

    return new Promise((resolve) => {
      this.sshClient.exec(`test -d "${remotePath}" && echo "exists" || echo "not exists"`, (err: any, stream: any) => {
        if (err) {
          resolve({
            success: false,
            exists: false,
            writable: false,
            message: `检查路径失败: ${err.message}`,
          });
          return;
        }

        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.on('close', (code: number) => {
          const exists = output.trim() === 'exists';

          if (!exists) {
            this.sshClient.exec(`mkdir -p "${remotePath}" && echo "created"`, (mkdirErr: any, mkdirStream: any) => {
              if (mkdirErr) {
                resolve({
                  success: false,
                  exists: false,
                  writable: false,
                  message: `无法创建路径 ${remotePath}: ${mkdirErr.message}`,
                });
                return;
              }

              mkdirStream.on('close', (mkdirCode: number) => {
                if (mkdirCode === 0) {
                  resolve({
                    success: true,
                    exists: true,
                    writable: true,
                    message: `路径 ${remotePath} 已创建`,
                  });
                } else {
                  resolve({
                    success: false,
                    exists: false,
                    writable: false,
                    message: `创建路径 ${remotePath} 失败`,
                  });
                }
              });
            });
            return;
          }

          this.sshClient.exec(`test -w "${remotePath}" && echo "writable" || echo "not writable"`, (writeErr: any, writeStream: any) => {
            if (writeErr) {
              resolve({
                success: true,
                exists: true,
                writable: false,
                message: `无法检查写入权限: ${writeErr.message}`,
              });
              return;
            }

            let writeOutput = '';
            writeStream.on('data', (data: Buffer) => {
              writeOutput += data.toString();
            });

            writeStream.on('close', (writeCode: number) => {
              const writable = writeOutput.trim() === 'writable';
              resolve({
                success: writable,
                exists: true,
                writable,
                message: writable 
                  ? `路径 ${remotePath} 存在且可写`
                  : `路径 ${remotePath} 存在但不可写`,
              });
            });
          });
        });
      });
    });
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)([KMGTP])/i);
    if (!match) return parseFloat(sizeStr) * 1024 * 1024;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024,
      'P': 1024 * 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}