export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  frontendPath: string;
  backendPath: string;
  remotePath?: string;
  postUploadCommand?: string;
  retryCount?: number;
  frontendLogCommand?: string;
  backendLogCommand?: string;
  frontendPostUploadCommand?: string;
  backendPostUploadCommand?: string;
}

export interface UploadProgress {
  totalFiles: number;
  uploadedFiles: number;
  currentFile: string;
  percentage: number;
  status: 'uploading' | 'success' | 'error' | 'canceled';
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  time?: number;
}

// ==================== 终端类型 ====================

export interface TerminalState {
  isConnected: boolean;
  currentServerId: string | null;
  commandHistory: string[];
  historyIndex: number;
  prompt: string;
}

export interface TerminalConnectOptions {
  serverId: string;
  cols: number;
  rows: number;
}

export interface TerminalResizeOptions {
  cols: number;
  rows: number;
}
