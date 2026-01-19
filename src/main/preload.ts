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

  // 获取服务器日志
  fetchServerLogs: (config: any, command: string) => ipcRenderer.invoke('fetch-server-logs', config, command),
  
  // 实时日志流
  startLogStream: (config: any, command: string) => ipcRenderer.invoke('start-log-stream', config, command),
  stopLogStream: () => ipcRenderer.invoke('stop-log-stream'),
  onLogStream: (callback: (log: string) => void) => {
    ipcRenderer.on('log-stream-data', (_, data) => callback(data));
  },
  onLogStreamError: (callback: (error: string) => void) => {
    ipcRenderer.on('log-stream-error', (_, error) => callback(error));
  },
  removeLogStreamListeners: () => {
    ipcRenderer.removeAllListeners('log-stream-data');
    ipcRenderer.removeAllListeners('log-stream-error');
  },

  // 日志相关
  sendLog: (logEntry: any) => ipcRenderer.send('log-message', logEntry),

  // 获取版本号
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 显示消息框
  showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => 
    ipcRenderer.invoke('show-message-box', options),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
