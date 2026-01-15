import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import Store from 'electron-store';
import { SFTPService } from '../services/sftp';
import { createLogger } from '../logger';
import type { ServerConfig, UploadProgress } from '../../shared/types';

const store = new Store({ name: 'server-configs' });
let sftpService: SFTPService | null = null;
let isUploading = false;
const logger = createLogger('IPC');

export function setupIpcHandlers() {
  // 处理来自渲染进程的日志
  ipcMain.on('log-message', (_, logEntry) => {
    const { level, category, message, data } = logEntry;
    switch (level) {
      case 'DEBUG':
        logger.debug(`[${category}] ${message}`, data);
        break;
      case 'INFO':
        logger.info(`[${category}] ${message}`, data);
        break;
      case 'WARN':
        logger.warn(`[${category}] ${message}`, data);
        break;
      case 'ERROR':
        logger.error(`[${category}] ${message}`, data);
        break;
      default:
        logger.info(`[${category}] ${message}`, data);
    }
  });

  // 获取所有配置
  ipcMain.handle('get-configs', () => {
    logger.debug('获取所有配置');
    return store.get('servers', []);
  });

  // 保存配置
  ipcMain.handle('save-config', (_, config: ServerConfig) => {
    const servers = store.get('servers', []) as ServerConfig[];
    const index = servers.findIndex(s => s.id === config.id);
    
    if (index >= 0) {
      servers[index] = config;
    } else {
      servers.push(config);
    }
    
    store.set('servers', servers);
    return servers;
  });

  // 获取单个配置
  ipcMain.handle('get-config', (_, id: string) => {
    const servers = store.get('servers', []) as ServerConfig[];
    return servers.find(s => s.id === id);
  });

  // 获取应用版本号
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 删除配置
  ipcMain.handle('delete-config', (_, id: string) => {
    const servers = store.get('servers', []) as ServerConfig[];
    const filtered = servers.filter(s => s.id !== id);
    store.set('servers', filtered);
    return filtered;
  });

  // 测试连接
  ipcMain.handle('test-connection', async (_, config: ServerConfig) => {
    const sftp = new SFTPService();
    try {
      const startTime = Date.now();
      await sftp.connect(config);
      const time = Date.now() - startTime;
      await sftp.disconnect();
      return { 
        success: true, 
        message: '连接成功', 
        time: time 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || '连接失败',
        time: 0
      };
    }
  });

  // 上传文件夹
  ipcMain.handle('upload-folder', async (event, config: ServerConfig, localPath: string) => {
    if (isUploading) {
      throw new Error('已有上传任务正在进行');
    }

    isUploading = true;
    sftpService = new SFTPService();
    const win = BrowserWindow.getAllWindows()[0];

    try {
      await sftpService.connect(config);

      // 发送进度回调
      const onProgress = (progress: UploadProgress) => {
        win?.webContents.send('upload-progress', progress);
      };

      await sftpService.uploadFolder(localPath, config.remotePath, onProgress);

      // 执行后续命令
      if (config.postUploadCommand) {
        const commandOutput = await sftpService.executeCommand(config.postUploadCommand);
        win?.webContents.send('upload-progress', {
          message: `命令执行结果: 执行完成!`
        });
      }

      await sftpService.disconnect();
      return { success: true };
    } catch (error: any) {
      win?.webContents.send('upload-progress', {
        status: 'error',
        error: error.message || '上传失败'
      });
      throw error;
    } finally {
      isUploading = false;
      sftpService = null;
    }
  });

  // 取消上传
  ipcMain.handle('cancel-upload', async () => {
    if (sftpService) {
      await sftpService.disconnect();
    }
    isUploading = false;
    sftpService = null;
    return { success: true };
  });

  // 选择文件夹
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });
}
