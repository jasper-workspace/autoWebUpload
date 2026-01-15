export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
  postUploadCommand?: string;
  retryCount?: number;
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
