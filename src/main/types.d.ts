declare module 'ssh2-sftp-client' {
  import { ConnectConfig } from 'ssh2';

  interface SFTPConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    readyTimeout?: number;
    retries?: number;
    retry_factor?: number;
    retry_min_timeout?: number;
  }

  interface WatchEvent {
    type: string;
    file: string;
  }

  class SFTPClient {
    constructor();
    connect(config: SFTPConfig): Promise<void>;
    end(): Promise<void>;
    fastPut(localPath: string, remotePath: string, options?: any): Promise<string>;
    fastGet(remotePath: string, localPath: string, options?: any): Promise<string>;
    put(data: Buffer | string, remotePath: string, options?: any): Promise<void>;
    get(remotePath: string, options?: any): Promise<Buffer>;
    delete(remotePath: string, options?: any): Promise<void>;
    mkdir(path: string, recursive?: boolean): Promise<string>;
    list(path: string): Promise<any[]>;
    rmdir(path: string, recursive?: boolean): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<any>;
    cwd(path: string): Promise<string>;
    posixRename(oldPath: string, newPath: string): Promise<void>;
    uploadDir(localDir: string, remoteDir: string, options?: any): Promise<void>;
    downloadDir(remoteDir: string, localDir: string, options?: any): Promise<void>;
    connectStatus(): string;
  }

  const SFTPClient: SFTPClient;
  export = SFTPClient;
}
