import { Client as SSHClient, ClientChannel } from 'ssh2';
import { BrowserWindow } from 'electron';
import type { ServerConfig } from '../../shared/types';

export class TerminalService {
  private sshClient: SSHClient | null = null;
  private shellStream: ClientChannel | null = null;
  private connected: boolean = false;
  private currentServerId: string | null = null;

  /**
   * 连接到服务器并创建交互式Shell会话
   */
  async connect(
    config: ServerConfig,
    cols: number,
    rows: number,
    onData: (data: string) => void,
    onClose: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (this.connected) {
      await this.disconnect();
    }

    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient();

      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 20000,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      }

      this.sshClient.on('ready', () => {
        console.log('[Terminal] SSH连接就绪');

        // 创建交互式shell会话
        this.sshClient!.shell(
          { term: 'xterm-256color', cols, rows },
          (err, stream) => {
            if (err) {
              console.error('[Terminal] 创建Shell失败:', err);
              reject(err);
              return;
            }

            console.log('[Terminal] Shell会话已建立');
            this.shellStream = stream;
            this.connected = true;
            this.currentServerId = config.id;

            // 接收服务器输出
            stream.on('data', (data: Buffer) => {
              onData(data.toString());
            });

            // stderr 输出
            stream.stderr.on('data', (data: Buffer) => {
              onData(data.toString());
            });

            // 会话关闭
            stream.on('close', () => {
              console.log('[Terminal] Shell会话已关闭');
              this.connected = false;
              this.shellStream = null;
              onClose();
            });

            stream.on('error', (err: Error) => {
              console.error('[Terminal] Shell错误:', err);
              onError(err.message);
            });

            resolve();
          }
        );
      });

      this.sshClient.on('error', (err) => {
        console.error('[Terminal] SSH连接错误:', err);
        onError(err.message);
        reject(err);
      });

      this.sshClient.on('close', () => {
        console.log('[Terminal] SSH连接已关闭');
        this.connected = false;
        this.shellStream = null;
        onClose();
      });

      this.sshClient.connect(connectConfig);
    });
  }

  /**
   * 发送数据到Shell会话
   */
  write(data: string): void {
    if (this.shellStream && this.connected) {
      this.shellStream.write(data);
    }
  }

  /**
   * 调整终端尺寸
   */
  resize(cols: number, rows: number): void {
    if (this.shellStream && this.connected) {
      this.shellStream.setWindow(rows, cols, 0, 0);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.shellStream) {
        this.shellStream.end();
        this.shellStream = null;
      }

      if (this.sshClient) {
        this.sshClient.end();
        this.sshClient = null;
      }

      this.connected = false;
      this.currentServerId = null;
      resolve();
    });
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取当前服务器ID
   */
  getCurrentServerId(): string | null {
    return this.currentServerId;
  }
}

// 导出单例实例
export const terminalService = new TerminalService();
