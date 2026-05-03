import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  deleteConfig: (id: string) => ipcRenderer.invoke('delete-config', id),
  getConfigs: () => ipcRenderer.invoke('get-configs'),

  // 主题配置
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config'),
  saveThemeConfig: (theme: string) => ipcRenderer.invoke('save-theme-config', theme),

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
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // 显示消息框
  showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => 
    ipcRenderer.invoke('show-message-box', options),

  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openUpdateUrl: (url: string) => ipcRenderer.invoke('open-update-url', url),
  downloadUpdate: (downloadUrl: string, version: string) => ipcRenderer.invoke('download-update', downloadUrl, version),
  onDownloadProgress: (callback: (progress: { received: number; total: number; percentage: number }) => void) => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  saveIgnoreVersion: (version: string) => ipcRenderer.invoke('save-ignore-version', version),
  getUpdateConfig: () => ipcRenderer.invoke('get-update-config'),
  saveUpdateConfig: (config: any) => ipcRenderer.invoke('save-update-config', config),

  // 配置导入导出
  exportConfigs: (configs: any) => ipcRenderer.invoke('export-configs', configs),
  importConfigs: (mergeMode?: 'merge' | 'replace') => ipcRenderer.invoke('import-configs', mergeMode),

  // ==================== 终端相关 ====================

  // 连接终端
  terminalConnect: (options: { serverId: string; cols: number; rows: number }) =>
    ipcRenderer.invoke('terminal:connect', options),

  // 断开终端
  terminalDisconnect: () => ipcRenderer.invoke('terminal:disconnect'),

  // 断开所有连接（终端和日志流）
  disconnectAll: () => ipcRenderer.invoke('disconnect-all'),

  // 发送数据到终端
  terminalWrite: (data: string) => ipcRenderer.send('terminal:write', data),

  // 调整终端尺寸
  terminalResize: (options: { cols: number; rows: number }) =>
    ipcRenderer.send('terminal:resize', options),

  // 监听终端数据
  onTerminalData: (callback: (data: string) => void) => {
    ipcRenderer.on('terminal:data', (_, data) => callback(data));
  },

  // 监听终端关闭
  onTerminalClose: (callback: () => void) => {
    ipcRenderer.on('terminal:close', () => callback());
  },

  // 监听终端错误
  onTerminalError: (callback: (error: string) => void) => {
    ipcRenderer.on('terminal:error', (_, error) => callback(error));
  },

  // 移除终端监听器
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal:data');
    ipcRenderer.removeAllListeners('terminal:close');
    ipcRenderer.removeAllListeners('terminal:error');
  },

  // ==================== 一键部署相关 ====================

  // 执行本地构建
  executeBuild: (config: any) =>
    ipcRenderer.invoke('local-build:execute', config),

  // 取消构建
  cancelBuild: () => ipcRenderer.invoke('local-build:cancel'),

  // 监听构建进度
  onBuildProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('local-build:progress', (_, data) => callback(data));
  },
  removeBuildProgressListener: () => {
    ipcRenderer.removeAllListeners('local-build:progress');
  },

  // 执行一键部署
  executeOneClickDeploy: (serverId: string, deployType: 'frontend' | 'backend') =>
    ipcRenderer.invoke('deploy:one-click', serverId, deployType),

  // 取消部署
  cancelDeploy: () => ipcRenderer.invoke('deploy:cancel'),

  // 监听部署进度 (包含构建+上传+部署)
  onDeployProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('deploy:progress', (_, data) => callback(data));
  },
  removeDeployProgressListener: () => {
    ipcRenderer.removeAllListeners('deploy:progress');
  },

  // 调试用：读取原始配置文件
  readRawConfig: () => ipcRenderer.invoke('read-raw-config'),

  // ==================== 微服务部署相关 ====================

  // 扫描微服务
  scanMicroservices: (rootPath: string) =>
    ipcRenderer.invoke('microservice:scan', rootPath),

  // 检测Maven是否安装
  checkMavenInstalled: (mavenPath?: string) =>
    ipcRenderer.invoke('microservice:check-maven', mavenPath),

  // 获取微服务列表
  getMicroserviceList: (serverId: string) =>
    ipcRenderer.invoke('microservice:get-list', serverId),

  // 保存微服务配置
  saveMicroserviceConfig: (serverId: string, config: { microservices: any[], rootPath?: string }) =>
    ipcRenderer.invoke('microservice:save-config', serverId, config),

  // 启用/禁用微服务
  toggleMicroservice: (serverId: string, microserviceId: string, enabled: boolean) =>
    ipcRenderer.invoke('microservice:toggle', serverId, microserviceId, enabled),

  // 执行Maven构建（单个微服务）
  buildMicroservice: (microservicePath: string, command: string, skipTests?: boolean, mavenPath?: string, javaPath?: string) =>
    ipcRenderer.invoke('microservice:build', microservicePath, command, skipTests, mavenPath, javaPath),

  // 多微服务一键部署（跳过构建，直接上传jar包）
  deployAllMicroservices: (serverId: string, selectedIds: string[]) =>
    ipcRenderer.invoke('microservice:deploy-all', serverId, selectedIds),

  // 取消微服务部署
  cancelMicroserviceDeploy: () =>
    ipcRenderer.invoke('microservice:cancel-deploy'),

  // 监听微服务构建进度
  onMicroserviceBuildProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('microservice:build-progress', (_, data) => callback(data));
  },
  removeMicroserviceBuildProgressListener: () => {
    ipcRenderer.removeAllListeners('microservice:build-progress');
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
