import { ipcMain, dialog, BrowserWindow, app, shell, nativeTheme, Notification } from 'electron';
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
import { microserviceScanner } from '../services/microserviceScanner';
import { mavenExecutor } from '../services/mavenExecutor';
import { multiMicroserviceOrchestrator } from '../services/multiMicroserviceOrchestrator';
import { ServerValidator } from '../services/serverValidator';
import { createLogger } from '../logger';
import type { ServerConfig, UploadProgress, TerminalConnectOptions, TerminalResizeOptions, BuildConfig, MicroserviceConfig, MicroserviceBuildProgress, ServerValidationResult, ConfigTemplate, ImportConfigOptions, ImportConfigResult, DeploymentOptions, UploadFolderOptions } from '../../shared/types';
import { DEFAULT_DEPLOYMENT_OPTIONS } from '../../shared/types';
import crypto from 'crypto';

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
 * 构造上传选项：合并全局「部署选项」
 */
function buildUploadOptions(): UploadFolderOptions {
  const deployment = appStore.get('deployment', {}) as Partial<DeploymentOptions>;
  return {
    uploadSourcemap: deployment.uploadSourcemap ?? DEFAULT_DEPLOYMENT_OPTIONS.uploadSourcemap,
    keepDeployedJar: deployment.keepDeployedJar ?? DEFAULT_DEPLOYMENT_OPTIONS.keepDeployedJar,
    keepJarCount: Math.min(9, Math.max(0, Math.floor(Number(deployment.keepJarCount) || 0))),
    deleteBesFiles: deployment.deleteBesFiles ?? DEFAULT_DEPLOYMENT_OPTIONS.deleteBesFiles,
  };
}

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

  // ==================== 全局部署选项 ====================

  // 获取部署选项
  ipcMain.handle('get-deployment-config', () => {
    const deployment = appStore.get('deployment', {}) as Partial<DeploymentOptions>;
    return {
      uploadSourcemap: deployment.uploadSourcemap ?? DEFAULT_DEPLOYMENT_OPTIONS.uploadSourcemap,
      keepDeployedJar: deployment.keepDeployedJar ?? DEFAULT_DEPLOYMENT_OPTIONS.keepDeployedJar,
      keepJarCount: Math.min(9, Math.max(0, Math.floor(Number(deployment.keepJarCount) || 0))),
      deleteBesFiles: deployment.deleteBesFiles ?? DEFAULT_DEPLOYMENT_OPTIONS.deleteBesFiles,
    } as DeploymentOptions;
  });

  // 保存部署选项（校验 keepJarCount 范围 0-9）
  ipcMain.handle('save-deployment-config', (_, config: DeploymentOptions) => {
    const normalized: DeploymentOptions = {
      uploadSourcemap: !!config?.uploadSourcemap,
      keepDeployedJar: config?.keepDeployedJar !== false,
      keepJarCount: Math.min(9, Math.max(0, Math.floor(Number(config?.keepJarCount) || 0))),
      deleteBesFiles: !!config?.deleteBesFiles,
    };
    appStore.set('deployment', normalized);
    return normalized;
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

  // 验证服务器（连接 + 磁盘空间 + 路径检查）
  ipcMain.handle('validate-server', async (_, config: ServerConfig) => {
    const validator = new ServerValidator();
    try {
      const result = await validator.validateServer(config);
      return result;
    } catch (error: any) {
      return {
        success: false,
        connection: { success: false, message: error.message || '验证失败' }
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

      // 部署步骤日志回传：经专用通道发往渲染端「操作日志」面板（同时仍写文件）
      const options = buildUploadOptions();
      options.onLog = (message: string, type?: 'info' | 'error' | 'warning' | 'success' | 'config') => {
        win?.webContents.send('upload-log', { message, type: type ?? 'info' });
      };

      await sftpService.uploadFolder(localPath, config.remotePath!, onProgress, options);

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

  // 显示桌面通知（使用系统托盘气泡通知）
  ipcMain.handle('show-notification', async (_, options: { title: string; body: string; icon?: string }) => {
    try {
      // 检查是否支持通知
      if (!app.isReady()) {
        await app.whenReady();
      }

      // 获取图标路径（兼容开发和打包后的路径）
      let iconPath = options.icon;
      if (!iconPath) {
        const possiblePaths = [
          path.join(__dirname, '../../favicon.png'),
          path.join(__dirname, '../favicon.png'),
          path.join(app.getAppPath(), 'favicon.png'),
          path.join(__dirname, 'favicon.png'),
          path.join(process.cwd(), 'favicon.png')
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            iconPath = p;
            break;
          }
        }
      }

      logger.info(`显示系统通知: ${options.title} - ${options.body}, 图标路径: ${iconPath}`);

      // 使用系统托盘显示通知（在 Windows 上更可靠）
      const { Tray, Menu } = await import('electron');
      
      // 创建一个临时托盘图标
      const tray = new Tray(iconPath || path.join(__dirname, '../../favicon.png'));
      
      // 设置托盘菜单（空菜单）
      tray.setContextMenu(Menu.buildFromTemplate([]));
      
      // 在 Windows 上使用 showBalloon 显示气泡通知
      if (process.platform === 'win32') {
        tray.displayBalloon({
          title: options.title,
          content: options.body,
          icon: iconPath || undefined
        });
      } else {
        // macOS 使用 Notification API
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: iconPath
        });
      }

      // 3秒后移除托盘图标
      setTimeout(() => {
        tray.destroy();
      }, 3000);

      logger.info('系统通知已触发');
      return { success: true, type: 'tray' };
      
    } catch (error: any) {
      logger.error('显示系统通知失败', error);
      return { success: false, error: error.message };
    }
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

      const result = await deployOrchestrator!.executeOneClickDeploy(config, buildConfig, buildUploadOptions());
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

  // ==================== 微服务相关handlers ====================

  // 扫描微服务
  ipcMain.handle('microservice:scan', async (_, rootPath: string) => {
    let microservices: any[] = [];
    try {
      logger.info(`[microservice:scan] 开始扫描目录: ${rootPath}`);
      const result = await microserviceScanner.scanMicroservices(rootPath);
      logger.info(`[microservice:scan] 扫描完成，找到 ${result.length} 个微服务`);

      // 确保返回的是纯 JSON 可序列化的数据（去除可能的不可序列化属性）
      microservices = result.map(ms => ({
        id: ms.id,
        name: ms.name,
        artifactId: ms.artifactId,
        localPath: ms.localPath,
        remotePath: ms.remotePath,
        postUploadCommand: ms.postUploadCommand || '',
        enabled: ms.enabled,
        order: ms.order || 0,
      }));

      return { success: true, data: microservices };
    } catch (error: any) {
      logger.error('扫描微服务失败', error);
      logger.info(`扫描微服务失败 - 当前microservices数量: ${microservices.length}`);
      return { success: false, error: error.message || '扫描失败' };
    }
  });

  // 检测Maven是否安装
  ipcMain.handle('microservice:check-maven', async (_, mavenPath?: string) => {
    try {
      const installed = await mavenExecutor.checkMavenInstalled(mavenPath);
      const version = installed ? await mavenExecutor.getMavenVersion(mavenPath) : null;
      return { success: true, installed, version };
    } catch (error: any) {
      return { success: false, installed: false, version: null };
    }
  });

  // 获取微服务列表
  ipcMain.handle('microservice:get-list', async (_, serverId: string) => {
    try {
      const configs = store.get('servers', []) as ServerConfig[];
      logger.info(`[microservice:get-list] 从store读取到 ${configs.length} 个服务器配置`);
      logger.info(`[microservice:get-list] 查找的serverId: ${serverId}`);
      if (configs.length > 0) {
        logger.info(`[microservice:get-list] 第一个配置的id: ${configs[0].id}, name: ${configs[0].name}`);
      }
      const config = configs.find((c: ServerConfig) => c.id === serverId);
      if (!config) {
        logger.info(`[microservice:get-list] 服务器配置不存在, serverId: ${serverId}`);
        return { success: false, error: '服务器配置不存在' };
      }
      logger.info(`[microservice:get-list] 找到服务器: ${config.name}, backend:`, JSON.stringify(config.backend).substring(0, 200));
      const microservices = config.backend?.microservices || [];
      logger.info(`[microservice:get-list] 获取到 ${microservices.length} 个微服务, serverId: ${serverId}`);
      return { success: true, data: microservices };
    } catch (error: any) {
      logger.error('获取微服务列表失败', error);
      return { success: false, error: error.message || '获取失败' };
    }
  });

  // 保存微服务配置
  ipcMain.handle('microservice:save-config', async (_, serverId: string, config: { microservices: MicroserviceConfig[], rootPath?: string }) => {
    try {
      const configs = store.get('servers', []) as ServerConfig[];
      const index = configs.findIndex((c: ServerConfig) => c.id === serverId);
      if (index === -1) {
        return { success: false, error: '服务器配置不存在' };
      }

      // 更新后端配置的微服务列表和根路径
      if (!configs[index].backend) {
        configs[index].backend = {
          type: 'backend',
          remotePath: '',
          microservices: [],
          rootPath: '',
        };
      }
      configs[index].backend!.microservices = config.microservices;
      if (config.rootPath !== undefined) {
        (configs[index].backend as any).rootPath = config.rootPath;
      }

      store.set('configs', configs);
      return { success: true };
    } catch (error: any) {
      logger.error('保存微服务配置失败', error);
      return { success: false, error: error.message || '保存失败' };
    }
  });

  // 启用/禁用微服务
  ipcMain.handle('microservice:toggle', async (_, serverId: string, microserviceId: string, enabled: boolean) => {
    try {
      const configs = store.get('servers', []) as ServerConfig[];
      const configIndex = configs.findIndex((c: ServerConfig) => c.id === serverId);
      if (configIndex === -1) {
        return { success: false, error: '服务器配置不存在' };
      }

      const microservices = configs[configIndex].backend?.microservices || [];
      const msIndex = microservices.findIndex((ms: MicroserviceConfig) => ms.id === microserviceId);
      if (msIndex === -1) {
        return { success: false, error: '微服务不存在' };
      }

      microservices[msIndex].enabled = enabled;
      configs[configIndex].backend!.microservices = microservices;
      store.set('configs', configs);

      return { success: true };
    } catch (error: any) {
      logger.error('切换微服务状态失败', error);
      return { success: false, error: error.message || '操作失败' };
    }
  });

  // 执行Maven构建（单个微服务）
  ipcMain.handle('microservice:build', async (_, microservicePath: string, command: string, skipTests: boolean = true, mavenPath?: string, javaPath?: string) => {
    try {
      const result = await mavenExecutor.executeCommand(
        microservicePath,
        command as 'clean' | 'compile' | 'package' | 'install' | 'deploy',
        skipTests,
        (output) => {
          // 可以通过webContents发送进度
        },
        mavenPath,
        javaPath
      );
      return result;
    } catch (error: any) {
      logger.error('Maven构建失败', error);
      return { success: false, output: '', error: error.message || '构建失败' };
    }
  });

  // 多微服务一键部署（跳过构建，直接上传jar包）
  ipcMain.handle('microservice:deploy-all', async (event, serverId: string, selectedIds: string[]) => {
    console.log('[handlers] microservice:deploy-all 开始', { serverId, selectedIds });
    try {
      const configs = store.get('servers', []) as ServerConfig[];
      const config = configs.find((c: ServerConfig) => c.id === serverId);
      console.log('[handlers] 找到配置', { configExists: !!config });
      if (!config) {
        return { success: false, error: '服务器配置不存在' };
      }

      // 获取后端根目录（微服务模式使用 rootPath）
      const backendRootPath = config.backend?.rootPath;
      console.log('[handlers] 后端根目录', { backendRootPath });
      if (!backendRootPath) {
        return { success: false, error: '后端工作目录未配置' };
      }

      // 获取webContents用于发送进度
      const webContents = BrowserWindow.fromWebContents(event.sender);
      console.log('[handlers] 开始调用 orchestrator.deployAll');

      const result = await multiMicroserviceOrchestrator.deployAll(
        config,
        backendRootPath,
        selectedIds || [],
        (progress: MicroserviceBuildProgress) => {
          // 发送进度到渲染进程
          webContents?.webContents.send('microservice:build-progress', progress);
        },
        buildUploadOptions()
      );

      console.log('[handlers] orchestrator.deployAll 返回', { result });
      return result;
    } catch (error: any) {
      logger.error('微服务部署失败', error);
      console.log('[handlers] 捕获到异常', { error: error.message });
      return {
        success: false,
        results: [],
        totalDuration: 0,
        failedCount: 0,
        successCount: 0,
        error: error.message || '部署失败',
      };
    }
  });

  // 取消微服务部署
  ipcMain.handle('microservice:cancel-deploy', async () => {
    multiMicroserviceOrchestrator.cancelDeploy();
    return { success: true };
  });

  // ==================== 服务器验证 ====================

  /**
   * 服务器验证
   * 验证服务器连接、磁盘空间、目标路径
   */
  ipcMain.handle('server:validate', async (_, serverId: string): Promise<ServerValidationResult> => {
    const servers = store.get('servers', []) as ServerConfig[];
    const config = servers.find(s => s.id === serverId);

    if (!config) {
      return {
        success: false,
        error: '服务器配置未找到',
        connection: { status: 'error', message: '配置不存在' },
        disk: { status: 'unknown', message: '未检测' },
        path: { status: 'unknown', message: '未检测' }
      };
    }

    const result: ServerValidationResult = {
      success: true,
      connection: { status: 'unknown', message: '连接中...' },
      disk: { status: 'unknown', message: '检测中...' },
      path: { status: 'unknown', message: '检测中...' }
    };

    const sftp = new SFTPService();

    try {
      // 1. 测试SSH连接
      await sftp.connect(config);
      result.connection = { status: 'success', message: '连接成功' };

      // 2. 检查磁盘空间（获取根目录磁盘使用情况）
      try {
        const diskInfo = await sftp.executeCommand('df -h /');
        const match = diskInfo.output.match(/(\d+)%/);
        if (match) {
          const usedPercent = parseInt(match[1]);
          result.disk = {
            status: usedPercent >= 90 ? 'warning' : 'success',
            used: `${usedPercent}%`,
            message: usedPercent >= 90 ? `磁盘空间不足（已用${usedPercent}%）` : `磁盘空间充足（已用${usedPercent}%）`
          };
        } else {
          result.disk = { status: 'success', message: '磁盘空间正常' };
        }
      } catch {
        result.disk = { status: 'success', message: '磁盘空间检测跳过' };
      }

      // 3. 检查目标路径（前端的远程路径）
      const targetPath = config.frontend?.remotePath || config.remotePath || '';
      if (targetPath) {
        try {
          const pathCheck = await sftp.executeCommand(`test -d "${targetPath}" && echo "exists" || echo "not_found"`);
          if (pathCheck.output.includes('exists')) {
            result.path = { status: 'success', message: '路径存在' };
          } else {
            result.path = { status: 'warning', message: '路径不存在，将自动创建' };
          }
        } catch {
          result.path = { status: 'warning', message: '路径检测失败' };
        }
      } else {
        result.path = { status: 'warning', message: '未配置远程路径' };
      }

      await sftp.disconnect();
    } catch (error: any) {
      result.success = false;
      result.connection = { status: 'error', message: error.message || '连接失败' };
    }

    return result;
  });

  // ==================== 配置模板管理 ====================

  const TEMPLATES_KEY = 'configTemplates';
  const MAX_TEMPLATES = 20;

  /**
   * 获取模板列表
   */
  ipcMain.handle('config:template:list', async () => {
    const templates = store.get(TEMPLATES_KEY, []) as ConfigTemplate[];
    return { success: true, templates };
  });

  /**
   * 保存模板
   */
  ipcMain.handle('config:template:save', async (_, template: Omit<ConfigTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const templates = store.get(TEMPLATES_KEY, []) as ConfigTemplate[];

    // 检查模板数量限制
    if (templates.length >= MAX_TEMPLATES) {
      return {
        success: false,
        error: `模板数量已达上限（${MAX_TEMPLATES}个），请删除不需要的模板`
      };
    }

    // 检查名称重复
    if (templates.some(t => t.name === template.name)) {
      return {
        success: false,
        error: '模板名称已存在，请使用其他名称'
      };
    }

    const newTemplate: ConfigTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    templates.push(newTemplate);
    store.set(TEMPLATES_KEY, templates);

    return { success: true, template: newTemplate };
  });

  /**
   * 加载模板
   */
  ipcMain.handle('config:template:load', async (_, templateId: string) => {
    const templates = store.get(TEMPLATES_KEY, []) as ConfigTemplate[];
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return { success: false, error: '模板不存在' };
    }

    return { success: true, template };
  });

  /**
   * 删除模板
   */
  ipcMain.handle('config:template:delete', async (_, templateId: string) => {
    const templates = store.get(TEMPLATES_KEY, []) as ConfigTemplate[];
    const index = templates.findIndex(t => t.id === templateId);

    if (index === -1) {
      return { success: false, error: '模板不存在' };
    }

    templates.splice(index, 1);
    store.set(TEMPLATES_KEY, templates);

    return { success: true };
  });

  // ==================== 配置导入导出 ====================

  // 加密密码
  function encryptPassword(password: string): string {
    const key = crypto.scryptSync('auto-deploy-tool-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // 解密密码
  function decryptPassword(encrypted: string): string {
    try {
      const key = crypto.scryptSync('auto-deploy-tool-key', 'salt', 32);
      const parts = encrypted.split(':');
      if (parts.length !== 2) return encrypted;
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encrypted;
    }
  }

  /**
   * 导出配置
   */
  ipcMain.handle('config:export', async () => {
    const servers = store.get('servers', []) as ServerConfig[];

    // 加密敏感信息
    const exportData = servers.map(server => ({
      ...server,
      password: server.password ? encryptPassword(server.password) : undefined,
      privateKey: server.privateKey ? encryptPassword(server.privateKey) : undefined
    }));

    return {
      success: true,
      data: exportData,
      json: JSON.stringify(exportData, null, 2)
    };
  });

  /**
   * 导入配置
   */
  ipcMain.handle('config:import', async (_, importData: ServerConfig[], options: ImportConfigOptions): Promise<ImportConfigResult> => {
    const currentServers = store.get('servers', []) as ServerConfig[];
    const conflicts: { server: ServerConfig; existing: ServerConfig }[] = [];
    const newServers: ServerConfig[] = [];

    for (const imported of importData) {
      // 解密敏感信息
      if (imported.password?.includes(':')) {
        imported.password = decryptPassword(imported.password);
      }
      if (imported.privateKey?.includes(':')) {
        imported.privateKey = decryptPassword(imported.privateKey);
      }

      // 为导入的服务器生成新ID
      imported.id = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const existing = currentServers.find(s => s.name === imported.name);

      if (existing) {
        conflicts.push({ server: imported, existing });

        switch (options.mergeType) {
          case 'replace':
            const replaceIndex = currentServers.findIndex(s => s.name === imported.name);
            currentServers[replaceIndex] = imported;
            break;
          case 'merge':
            Object.assign(existing, imported);
            break;
          case 'skip':
            break;
        }
      } else {
        newServers.push(imported);
      }
    }

    // 保存配置
    const finalServers = [...currentServers.filter(s =>
      !conflicts.some(c => c.existing.name === s.name && options.mergeType === 'replace')
    ), ...newServers];

    store.set('servers', finalServers);

    return {
      success: true,
      importedCount: newServers.length + conflicts.filter(c => options.mergeType !== 'skip').length,
      conflictCount: conflicts.length,
      conflicts: conflicts.map(c => ({
        name: c.server.name,
        existingId: c.existing.id,
        importedId: c.server.id
      }))
    };
  });

  // ==================== 文件对话框和读取 ====================

  /**
   * 打开文件选择对话框
   */
  ipcMain.handle('dialog:showOpen', async (_, options: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options.title,
        filters: options.filters,
        properties: options.properties || ['openFile']
      });
      return result;
    } catch (error: any) {
      logger.error('打开文件对话框失败', error);
      return { canceled: true, filePaths: [] };
    }
  });

  /**
   * 读取文件内容
   */
  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      logger.error('读取文件失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 写入文件内容
   */
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    try {
      await fsPromises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      logger.error('写入文件失败', error);
      return { success: false, error: error.message };
    }
  });
}
