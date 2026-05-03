import { ipcMain, dialog, BrowserWindow, app, shell, nativeTheme } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import fsPromises from 'fs/promises';
import https from 'https';
import http from 'http';
import path from 'path';
import { SFTPService } from '../services/sftp';
import { UpdateService } from '../services/update';
import { terminalService } from '../services/terminal';
import { LocalBuildService } from '../services/localBuild';
import { DeployOrchestrator } from '../services/deployOrchestrator';
import { createLogger } from '../logger';
import type { ServerConfig, UploadProgress, TerminalConnectOptions, TerminalResizeOptions, BuildConfig } from '../../shared/types';

// 获取 electron-store 的存储路径
function getStorePath(): string {
  // electron-store 8.x 使用 electron-store 的 getPath 方法
  const store = new Store({ name: 'server-configs' });
  return (store as any).path || '';
}

const store = new Store({ name: 'server-configs' });
const appStore = new Store({ name: 'app-configs' });
let sftpService: SFTPService | null = null;
let isUploading = false;
let downloadProgressCallback: ((received: number, total: number) => void) | null = null;
let isDownloadCanceled = false; // 下载取消标志
const logger = createLogger('IPC');
const updateService = new UpdateService(app.getVersion());

// 一键部署相关服务
let localBuildService: LocalBuildService | null = null;
let deployOrchestrator: DeployOrchestrator | null = null;
let isDeploying = false;

/**
 * 下载文件到本地（支持进度报告和取消）
 * @param url 文件下载URL
 * @param destPath 保存路径
 * @param onProgress 进度回调函数 (received: number, total: number) => void
 */
function downloadFile(url: string, destPath: string, onProgress?: (received: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const cleanup = () => {
      isDownloadCanceled = false;
    };

    const request = protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fsPromises.unlink(destPath).catch(() => { }); // 删除已创建的文件
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        cleanup();
        fsPromises.unlink(destPath).catch(() => { }).finally(() => {
          reject(new Error(`下载失败，HTTP状态码: ${response.statusCode}`));
        });
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;

      // 在 pipe 之前监听 data 事件以便获取进度
      response.on('data', (chunk: Buffer) => {
        // 检查是否已取消
        if (isDownloadCanceled) {
          response.destroy();
          file.close();
          cleanup();
          fsPromises.unlink(destPath).catch(() => { });
          reject(new Error('下载已取消'));
          return;
        }

        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          onProgress(downloadedSize, totalSize);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        cleanup();
        resolve();
      });
    });

    request.on('error', (error) => {
      file.close();
      cleanup();
      fsPromises.unlink(destPath).catch(() => { });
      reject(error);
    });

    request.setTimeout(300000, () => { // 5分钟超时
      request.destroy();
      file.close();
      cleanup();
      fsPromises.unlink(destPath).catch(() => { });
      reject(new Error('下载超时'));
    });
  });
}

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

  // ==================== 终端相关处理器 ====================

  // 连接终端
  ipcMain.handle('terminal:connect', async (event, options: TerminalConnectOptions) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      throw new Error('窗口未找到');
    }

    // 获取服务器配置
    const servers = store.get('servers', []) as ServerConfig[];
    const config = servers.find(s => s.id === options.serverId);

    if (!config) {
      throw new Error('服务器配置未找到');
    }

    try {
      await terminalService.connect(
        config,
        options.cols,
        options.rows,
        // onData callback
        (data: string) => {
          win.webContents.send('terminal:data', data);
        },
        // onClose callback
        () => {
          win.webContents.send('terminal:close', null);
        },
        // onError callback
        (error: string) => {
          win.webContents.send('terminal:error', error);
        }
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 断开终端连接
  ipcMain.handle('terminal:disconnect', async () => {
    try {
      await terminalService.disconnect();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 断开所有连接（终端和日志流）
  ipcMain.handle('disconnect-all', async () => {
    logger.info('disconnect-all IPC处理程序被调用');

    // 停止日志流
    logStreamActive = false;
    if (logStreamSftp) {
      try {
        await logStreamSftp.disconnect();
        logger.info('日志流连接已断开');
      } catch (e) {
        logger.error('断开日志流连接时出错:', e);
      }
      logStreamSftp = null;
    }

    // 断开终端连接
    try {
      await terminalService.disconnect();
      logger.info('终端连接已断开');
    } catch (e) {
      logger.error('断开终端连接时出错:', e);
    }

    return { success: true };
  });

  // 发送数据到终端
  ipcMain.on('terminal:write', (_, data: string) => {
    terminalService.write(data);
  });

  // 调整终端尺寸
  ipcMain.on('terminal:resize', (_, options: TerminalResizeOptions) => {
    terminalService.resize(options.cols, options.rows);
  });

  // ==================== 日志相关处理器 ====================

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
    const configs = store.get('servers', []) as ServerConfig[];
    logger.info('读取配置数据:', JSON.stringify(configs, null, 2));

    // 调试：打印配置数量和内容
    console.log('=== 配置数据调试 ===');
    console.log('配置数量:', configs.length);
    configs.forEach((config, index) => {
      console.log(`配置 ${index + 1}:`, JSON.stringify(config, null, 2));
    });
    console.log('====================');

    return configs;
  });

  // 调试用：读取原始配置文件
  ipcMain.handle('read-raw-config', () => {
    const storePath = (store as any).path;
    logger.info('配置文件路径:', storePath);
    try {
      const rawData = fs.readFileSync(storePath, 'utf-8');
      return { path: storePath, content: rawData };
    } catch (error: any) {
      return { path: storePath, error: error.message };
    }
  });

  // 保存配置
  ipcMain.handle('save-config', (_, config: ServerConfig) => {
    // 基本验证，确保配置对象有效
    if (!config || !config.id) {
      throw new Error('无效的配置对象');
    }

    logger.info('保存配置数据:', JSON.stringify(config, null, 2));

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

  // 获取应用信息（版本号和作者）
  ipcMain.handle('get-app-info', async () => {
    try {
      const packagePath = app.isPackaged
        ? process.resourcesPath + '/app/package.json'
        : require.resolve('../../package.json');
      const packageContent = await fsPromises.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(packageContent);
      return {
        version: pkg.version || app.getVersion(),
        author: pkg.author || ''
      };
    } catch (error) {
      logger.error('获取应用信息失败', error);
      return {
        version: app.getVersion(),
        author: ''
      };
    }
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

  // 下载更新文件
  ipcMain.handle('download-update', async (_, downloadUrl: string, version: string) => {
    try {
      // 从下载URL提取文件名（需要解码URL编码的中文字符）
      const urlObj = new URL(downloadUrl);
      const encodedFileName = urlObj.pathname.split('/').pop() || `autoWebUpload-${version}.exe`;
      const fileName = decodeURIComponent(encodedFileName);

      // 弹出保存对话框，让用户选择保存位置
      const result = await dialog.showSaveDialog({
        title: '保存更新文件',
        defaultPath: fileName,
        filters: [
          { name: '可执行文件', extensions: ['exe'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: '用户取消下载' };
      }

      const filePath = result.filePath;
      const win = BrowserWindow.getAllWindows()[0];

      logger.info('开始下载更新文件', { downloadUrl, filePath });

      // 上一次发送进度的时间，用于节流
      let lastProgressTime = 0;

      // 创建进度回调，通过 IPC 发送到渲染进程
      const onProgress = (received: number, total: number) => {
        if (!win) return;

        const now = Date.now();
        // 节流：每 100ms 更新一次进度
        if (now - lastProgressTime < 100 && received < total) return;
        lastProgressTime = now;

        const percentage = Math.round((received / total) * 100);
        win.webContents.send('download-progress', {
          received,
          total,
          percentage
        });
      };

      // 下载文件
      await downloadFile(downloadUrl, filePath, onProgress);

      logger.info('更新文件下载完成', { filePath });
      return { success: true, filePath };
    } catch (error: any) {
      logger.error('下载更新文件失败', error);
      return { success: false, error: error.message || '下载失败' };
    }
  });

  // 取消下载
  ipcMain.handle('cancel-download', async () => {
    isDownloadCanceled = true;
    return { success: true };
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

  // 导出服务器配置
  ipcMain.handle('export-configs', async (_, configs: ServerConfig[]) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '导出服务器配置',
        defaultPath: `server-configs-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: '用户取消导出' };
      }

      // 直接导出配置（包括密码和私钥）
      const exportData = configs.map(config => ({ ...config }));

      await fsPromises.writeFile(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      logger.info('配置导出成功', { filePath: result.filePath, count: configs.length });
      return { success: true, filePath: result.filePath };
    } catch (error: any) {
      logger.error('导出配置失败', error);
      return { success: false, error: error.message };
    }
  });

  // 导入服务器配置
  ipcMain.handle('import-configs', async (_, mergeMode: 'merge' | 'replace' = 'merge') => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入服务器配置',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: '用户取消导入' };
      }

      const filePath = result.filePaths[0];
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const importedConfigs = JSON.parse(content) as ServerConfig[];

      if (!Array.isArray(importedConfigs)) {
        return { success: false, error: '文件格式错误：期望 JSON 数组' };
      }

      // 验证配置对象
      for (const config of importedConfigs) {
        if (!config.id || !config.host || !config.username) {
          return { success: false, error: '配置数据不完整，缺少必要字段' };
        }
      }

      const currentConfigs = store.get('servers', []) as ServerConfig[];
      let finalConfigs: ServerConfig[];

      if (mergeMode === 'replace') {
        finalConfigs = importedConfigs;
      } else {
        // 合并模式：导入的配置不覆盖已有配置，而是添加新配置
        const existingIds = new Set(currentConfigs.map(c => c.id));
        const newConfigs = importedConfigs.filter(c => !existingIds.has(c.id));
        finalConfigs = [...currentConfigs, ...newConfigs];
      }

      store.set('servers', finalConfigs);
      logger.info('配置导入成功', { filePath, count: importedConfigs.length, mode: mergeMode });
      return { success: true, count: importedConfigs.length, configs: finalConfigs };
    } catch (error: any) {
      logger.error('导入配置失败', error);
      return { success: false, error: error.message || '导入失败' };
    }
  });

  // ==================== 一键部署相关处理器 ====================

  // 初始化部署服务
  function initDeployServices() {
    if (!localBuildService) {
      localBuildService = new LocalBuildService();
    }
    if (!deployOrchestrator) {
      deployOrchestrator = new DeployOrchestrator();
    }
    // 始终设置 mainWindow 和 localBuildService
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      deployOrchestrator.setMainWindow(win);
    }
    deployOrchestrator.setLocalBuildService(localBuildService);
  }

  // 执行本地构建
  ipcMain.handle('local-build:execute', async (_, config: BuildConfig) => {
    initDeployServices();
    const win = BrowserWindow.getAllWindows()[0];

    try {
      // 监听构建进度
      localBuildService!.on('progress', (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('local-build:progress', progress);
        }
      });

      const result = await localBuildService!.executeBuild(config);
      return result;
    } catch (error: any) {
      logger.error('本地构建失败', error);
      return { success: false, output: '', error: error.message || '构建失败', duration: 0 };
    }
  });

  // 取消本地构建
  ipcMain.handle('local-build:cancel', async () => {
    if (localBuildService) {
      localBuildService.cancelBuild();
    }
    return { success: true };
  });

  // 执行一键部署
  ipcMain.handle('deploy:one-click', async (_, serverId: string, deployType: 'frontend' | 'backend') => {
    if (isDeploying) {
      throw new Error('已有部署任务正在进行');
    }

    initDeployServices();
    isDeploying = true;
    const win = BrowserWindow.getAllWindows()[0];

    try {
      // 获取服务器配置
      const servers = store.get('servers', []) as ServerConfig[];
      const config = servers.find(s => s.id === serverId);

      if (!config) {
        throw new Error('服务器配置未找到');
      }

      // 根据部署类型选择对应的构建配置
      const deployConfig = deployType === 'frontend' ? config.frontend : config.backend;
      const buildConfig = deployConfig?.buildConfig;

      if (!buildConfig || !buildConfig.localPath || !buildConfig.buildCommand) {
        throw new Error(`请先配置${deployType === 'frontend' ? '前端' : '后端'}构建命令`);
      }

      // 确保构建类型匹配
      if (buildConfig.type !== deployType) {
        throw new Error(`构建配置类型(${buildConfig.type})与部署类型(${deployType})不匹配`);
      }

      // 监听构建进度，转发给 deployOrchestrator 统一处理
      localBuildService!.on('progress', (progress) => {
        if (win && !win.isDestroyed()) {
          deployOrchestrator!.reportProgress(progress.phase, progress.step, progress.percentage, progress.status, progress.output);
        }
      });

      const result = await deployOrchestrator!.executeOneClickDeploy(config, buildConfig);
      return result;
    } catch (error: any) {
      logger.error('一键部署失败', error);
      return {
        success: false,
        totalDuration: 0,
        error: error.message || '部署失败'
      };
    } finally {
      isDeploying = false;
    }
  });

  // 取消部署
  ipcMain.handle('deploy:cancel', async () => {
    if (deployOrchestrator) {
      deployOrchestrator.cancelDeploy();
    }
    isDeploying = false;
    return { success: true };
  });
}
