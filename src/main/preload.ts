import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  deleteConfig: (id: string) => ipcRenderer.invoke('delete-config', id),
  getConfigs: () => ipcRenderer.invoke('get-configs'),

  // SFTP 相关
  testConnection: (config: any) => ipcRenderer.invoke('test-connection', config),
  uploadFolder: (config: any, localPath: string) => ipcRenderer.invoke('upload-folder', config, localPath),
  cancelUpload: () => ipcRenderer.invoke('cancel-upload'),

  // 监听上传进度
  onUploadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('upload-progress', (_, data) => callback(data));
  },
  removeUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('upload-progress');
  },

  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 日志相关
  sendLog: (logEntry: any) => ipcRenderer.send('log-message', logEntry),

  // 获取版本号
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
