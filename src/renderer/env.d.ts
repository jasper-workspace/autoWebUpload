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
      showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => Promise<any>;
      
      // 更新相关
      checkForUpdates: () => Promise<any>;
      openUpdateUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
      saveIgnoreVersion: (version: string) => Promise<{ success: boolean; error?: string }>;
      getUpdateConfig: () => Promise<any>;
      saveUpdateConfig: (config: any) => Promise<any>;
    };
    isUploading?: () => boolean;
    cancelUpload?: () => void;
    uploadProgressListenerSet?: boolean;
    currentUploadConfig?: any;
  }
}
