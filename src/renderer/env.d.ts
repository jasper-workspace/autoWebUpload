/// <reference types="vite/client" />

import type { ServerConfig } from '../shared/types';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare global {
  interface Window {
    electronAPI: {
      // 配置相关
      getConfigs: () => Promise<ServerConfig[]>;
      saveConfig: (config: ServerConfig) => Promise<ServerConfig[]>;
      getConfig: (id: string) => Promise<ServerConfig | undefined>;
      deleteConfig: (id: string) => Promise<ServerConfig[]>;
      
      // 主题配置
      getThemeConfig: () => Promise<string>;
      saveThemeConfig: (theme: string) => Promise<string>;
      
      // SFTP相关
      testConnection: (config: any) => Promise<{ success: boolean; message: string; time: number }>;
      uploadFolder: (config: any, localPath: string) => Promise<{ success: boolean }>;
      cancelUpload: () => Promise<{ success: boolean }>;
      selectFolder: () => Promise<string | null>;
      
      // 进度监听
      onUploadProgress: (callback: (data: any) => void) => void;
      removeUploadProgressListener: () => void;
      
      // 日志相关
      fetchServerLogs: (config: any, command: string) => Promise<string>;
      startLogStream: (config: any, command: string) => Promise<void>;
      stopLogStream: () => Promise<void>;
      onLogStream: (callback: (log: string) => void) => void;
      onLogStreamError: (callback: (error: string) => void) => void;
      removeLogStreamListeners: () => void;
      sendLog: (logEntry: any) => void;
      
      // 应用信息
      getAppVersion: () => Promise<string>;
      getAppInfo: () => Promise<{ version: string; author: string }>;
      showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => Promise<any>;
      
      // 更新相关
      checkForUpdates: () => Promise<any>;
      openUpdateUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
      downloadUpdate: (downloadUrl: string, version: string) => Promise<{ success: boolean; filePath?: string; error?: string; message?: string }>;
      onDownloadProgress: (callback: (progress: { received: number; total: number; percentage: number }) => void) => void;
      removeDownloadProgressListener: () => void;
      cancelDownload: () => Promise<{ success: boolean }>;
      saveIgnoreVersion: (version: string) => Promise<{ success: boolean; error?: string }>;
      getUpdateConfig: () => Promise<any>;
      saveUpdateConfig: (config: any) => Promise<any>;

      // 配置导入导出
      exportConfigs: (configs: ServerConfig[]) => Promise<{ success: boolean; filePath?: string; error?: string; message?: string }>;
      importConfigs: (mergeMode?: 'merge' | 'replace') => Promise<{ success: boolean; count?: number; configs?: ServerConfig[]; error?: string; message?: string }>;

      // ==================== 终端相关 ====================
      terminalConnect: (options: { serverId: string; cols: number; rows: number }) => Promise<{ success: boolean; error?: string }>;
      terminalDisconnect: () => Promise<{ success: boolean; error?: string }>;
      disconnectAll: () => Promise<{ success: boolean; error?: string }>;
      terminalWrite: (data: string) => void;
      terminalResize: (options: { cols: number; rows: number }) => void;
      onTerminalData: (callback: (data: string) => void) => void;
      onTerminalClose: (callback: () => void) => void;
      onTerminalError: (callback: (error: string) => void) => void;
      removeTerminalListeners: () => void;
    };
    isUploading?: () => boolean;
    cancelUpload?: () => void;
    uploadProgressListenerSet?: boolean;
    currentUploadConfig?: any;
  }
}
