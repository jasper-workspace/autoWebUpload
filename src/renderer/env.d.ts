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
      getConfigs: () => Promise<ServerConfig[]>;
      saveConfig: (config: ServerConfig) => Promise<ServerConfig[]>;
      getConfig: (id: string) => Promise<ServerConfig | undefined>;
      deleteConfig: (id: string) => Promise<ServerConfig[]>;
      testConnection: (config: any) => Promise<{ success: boolean; message: string; time: number }>;
      uploadFolder: (config: any, localPath: string) => Promise<{ success: boolean }>;
      cancelUpload: () => Promise<{ success: boolean }>;
      selectFolder: () => Promise<string | null>;
      onUploadProgress: (callback: (data: any) => void) => void;
      removeUploadProgressListener: () => void;
      sendLog: (logEntry: any) => void;
      getAppVersion: () => Promise<string>;
    };
  }
}
