import { ipcMain, dialog, BrowserWindow, app, shell, nativeTheme } from 'electron';
import Store from 'electron-store';
import { SFTPService } from '../services/sftp';
import { UpdateService } from '../services/update';
import { createLogger } from '../logger';
import type { ServerConfig, UploadProgress } from '../../shared/types';

const store = new Store({ name: 'server-configs' });
const appStore = new Store({ name: 'app-configs' });
let sftpService: SFTPService | null = null;
let isUploading = false;
const logger = createLogger('IPC');
const updateService = new UpdateService(app.getVersion());

// 主题配置类型
type ThemeMode = 'dark' | 'light' | 'system';

// 更新配置类型
interface UpdateConfig {
  ignoreVersion?: string;
  lastCheck?: number;
}

export function setupIpcHandlers() {
  // 实时日志流相关变量
  let logStreamSftp: SFTPService | null = null;
  let logStreamActive = false;

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
    // 基本验证，确保配置对象有效
    if (!config || !config.id) {
      throw new Error('无效的配置对象');
    }

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

  // 获取主题配置
  ipcMain.handle('get-theme-config', () => {
    const theme = appStore.get('theme', 'system') as ThemeMode;
    return theme;
  });

  // 保存主题配置
  ipcMain.handle('save-theme-config', (_, theme: ThemeMode) => {
    appStore.set('theme', theme);

    // 更新窗口主题
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      const backgroundColor = theme === 'light'
        ? '#FAFAFA'
        : (theme === 'system' ? (nativeTheme.shouldUseDarkColors ? '#1E1E1E' : '#FAFAFA') : '#1E1E1E');
      const titleBarColor = backgroundColor;
      const titleBarSymbolColor = backgroundColor === '#FAFAFA' ? '#000000' : '#FFFFFF';

      // 更新窗口背景色和标题栏
      win.setBackgroundColor(backgroundColor);
      win.setTitleBarOverlay({
        color: titleBarColor,
        symbolColor: titleBarSymbolColor
      });
    }

    return theme;
  });

  // 获取更新配置
  ipcMain.handle('get-update-config', () => {
    const updateConfig = appStore.get('update', {}) as UpdateConfig;
    return updateConfig;
  });

  // 保存更新配置
  ipcMain.handle('save-update-config', (_, config: UpdateConfig) => {
    appStore.set('update', config);
    return config;
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

      await sftpService.uploadFolder(localPath, config.remotePath!, onProgress);

      // 执行后续命令
      if (config.postUploadCommand) {
        const commandResult = await sftpService.executeCommand(config.postUploadCommand);

        if (commandResult.success) {
          win?.webContents.send('upload-progress', {
            message: `命令执行成功`
          });

          // 如果有错误输出，也发送提示
          if (commandResult.error) {
            win?.webContents.send('upload-progress', {
              message: `警告: 命令执行时有错误输出: ${commandResult.error}`,
              type: 'warning'
            });
          }
        } else {
          // 命令执行失败
          const errorMessage = commandResult.error || commandResult.output;
          win?.webContents.send('upload-progress', {
            status: 'error',
            message: `命令执行失败: ${errorMessage}`
          });
          throw new Error(`命令执行失败: ${errorMessage}`);
        }
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

  // 获取服务器日志
  ipcMain.handle('fetch-server-logs', async (event, config: ServerConfig, command: string) => {
    logger.info('fetch-server-logs IPC处理程序被调用');
    logger.info(`接收到的参数 - config: ${JSON.stringify(config)}`);
    logger.info(`接收到的参数 - command: ${command}`);

    const sftpService = new SFTPService();

    try {
      logger.info(`尝试SSH连接到 ${config.host}:${config.port || 22}`);

      // 连接服务器
      await sftpService.connect(config);
      logger.info('SSH连接成功');

      // 执行获取日志命令（SFTPService 内部会处理 tail -f 的情况）
      logger.info('开始执行日志命令');

      const output = await Promise.race([
        sftpService.fetchLogs(command),
        // 60秒超时
        new Promise<string>((_, reject) => {
          setTimeout(() => {
            console.error('日志获取超时');
            logger.error('日志获取超时');
            reject(new Error('日志获取超时（60秒）'));
          }, 60000);
        })
      ]);

      logger.info(`日志获取成功，输出长度: ${output.length}`);

      // 断开连接
      await sftpService.disconnect();

      return output;
    } catch (error: any) {
      logger.error('获取日志失败:', error);
      console.error('获取日志失败:', error);
      try {
        await sftpService.disconnect();
      } catch (e) {
        console.error('断开连接时出错:', e);
      }
      return `ERROR: ${error.message || '获取日志失败'}`;
    }
  });

  // 启动实时日志流
  ipcMain.handle('start-log-stream', async (event, config: ServerConfig, command: string) => {
    logger.info('start-log-stream IPC处理程序被调用');

    const win = BrowserWindow.getAllWindows()[0];

    // 如果已有日志流在运行，直接拒绝
    if (logStreamSftp && logStreamActive) {
      logger.warn('已有日志流在运行，拒绝启动请求');
      throw new Error('日志流已在运行中');
    }

    logStreamSftp = new SFTPService();
    logStreamActive = true;

    try {
      logger.info(`连接到 ${config.host}:${config.port || 22}`);
      await logStreamSftp.connect(config);
      logger.info('SSH连接成功，开始实时日志流');
      win?.webContents.send('log-stream-data', '[系统] 连接成功，开始接收日志...');

      // 在后台执行实时日志流命令，不等待其完成
      logStreamSftp.executeLogStream(command, (data: string) => {
        if (logStreamActive && win) {
          win.webContents.send('log-stream-data', data);
        }
      }).catch((error) => {
        logger.error('日志流执行出错:', error);
        if (win && logStreamActive) {
          win.webContents.send('log-stream-error', error.message || '日志流出错');
        }
        // 出错时清理资源
        logStreamActive = false;
        if (logStreamSftp) {
          logStreamSftp.disconnect().catch((e) => {
            console.error('清理连接时出错:', e);
          });
          logStreamSftp = null;
        }
      });

      // 立即返回，不等待日志流结束
      logger.info('日志流已启动，返回');
      return { success: true };

    } catch (error: any) {
      logger.error('启动日志流出错:', error);
      console.error('启动日志流出错:', error);
      if (win && logStreamActive) {
        win.webContents.send('log-stream-error', error.message || '日志流出错');
      }
      logStreamActive = false;
      if (logStreamSftp) {
        try {
          await logStreamSftp.disconnect();
        } catch (e) {
          console.error('断开连接时出错:', e);
        }
        logStreamSftp = null;
      }
      throw error;
    }
  });

  // 停止实时日志流
  ipcMain.handle('stop-log-stream', async () => {
    logger.info('stop-log-stream IPC处理程序被调用');

    logStreamActive = false;

    if (logStreamSftp) {
      try {
        await logStreamSftp.disconnect();
        logger.info('日志流已停止');
      } catch (e) {
        logger.error('停止日志流出错:', e);
      }
      logStreamSftp = null;
    }

    return { success: true };
  });

  // 显示消息框
  ipcMain.handle('show-message-box', async (_, options) => {
    const { type, title, message, buttons } = options;

    const result = await dialog.showMessageBox({
      type: type as any,
      title,
      message,
      buttons: buttons || ['确定'],
      defaultId: 0
    });

    return result;
  });

  // 检查更新
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await updateService.checkForUpdates();

      // 获取不再提示的版本号
      const updateConfig = appStore.get('update', {}) as UpdateConfig;
      const ignoreVersion = updateConfig.ignoreVersion;

      // 如果当前最新版本是用户选择不再提示的版本，则不显示更新
      if (ignoreVersion && result.latestVersion === ignoreVersion) {
        return {
          ...result,
          hasUpdate: false,
          ignored: true
        };
      }

      return result;
    } catch (error: any) {
      logger.error('检查更新失败', error);
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        latestVersion: app.getVersion(),
        error: error.message || '检查更新失败'
      };
    }
  });

  // 打开更新链接
  ipcMain.handle('open-update-url', async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      logger.error('打开更新链接失败', error);
      return { success: false, error: error.message };
    }
  });

  // 保存不再提示的版本号
  ipcMain.handle('save-ignore-version', async (_, version: string) => {
    try {
      const updateConfig = appStore.get('update', {}) as UpdateConfig;
      const newConfig = {
        ...updateConfig,
        ignoreVersion: version,
        lastCheck: Date.now()
      };
      appStore.set('update', newConfig);
      return { success: true };
    } catch (error: any) {
      logger.error('保存不再提示版本号失败', error);
      return { success: false, error: error.message };
    }
  });
}
