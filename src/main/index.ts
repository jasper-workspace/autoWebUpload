import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { setupIpcHandlers } from './ipc/handlers';
import { logger, logDir } from './logger';

const appStore = new Store({ name: 'app-configs' });

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // 获取主题配置，默认使用深色主题
  const theme = appStore.get('theme', 'system') as 'dark' | 'light' | 'system';
  
  // 确定窗口背景色和标题栏颜色
  const backgroundColor = theme === 'light' 
    ? '#FAFAFA' 
    : (theme === 'system' ? (nativeTheme.shouldUseDarkColors ? '#1E1E1E' : '#FAFAFA') : '#1E1E1E');
  const titleBarColor = backgroundColor;
  const titleBarSymbolColor = backgroundColor === '#FAFAFA' ? '#000000' : '#FFFFFF';
  
  mainWindow = new BrowserWindow({
    title: `Linux 服务器自动部署工具 v${app.getVersion()}`,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    icon: path.join(process.cwd(), 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    backgroundColor: backgroundColor,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: titleBarColor,
      symbolColor: titleBarSymbolColor,
      height: 32
    }
  });

  // 监听窗口事件
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('页面加载失败', { errorCode, errorDescription });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('页面加载完成');
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelMap = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    logger.debug(`渲染进程控制台 [${levelMap[level] || 'UNKNOWN'}]`, { message, line, sourceId });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    logger.info('开发环境，加载开发服务器');
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // 在打包环境中，使用 file:// 协议加载 HTML 文件
    const htmlPath = path.join(__dirname, '../../dist/index.html');
    logger.info('生产环境，加载本地文件', { htmlPath });

    try {
      mainWindow.loadFile(htmlPath);
      logger.info('HTML 文件加载成功');
      // 临时打开开发者工具以诊断问题
      mainWindow.webContents.openDevTools();
    } catch (error) {
      logger.error('HTML 文件加载失败', error);
    }

    // 确保资源文件正确加载
    mainWindow.webContents.session.protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substr(6); // 去掉 'app://' 前缀
      const filePath = path.join(__dirname, '../../dist', url);
      logger.debug('协议处理', { url, filePath });
      callback({ path: filePath });
    });
  }

  mainWindow.on('closed', () => {
    logger.info('窗口已关闭');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logger.info('应用启动', { 
    version: app.getVersion(), 
    platform: process.platform, 
    arch: process.arch,
    logDir 
  });
  
  setupIpcHandlers();
  createWindow();

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    const theme = appStore.get('theme', 'system') as 'dark' | 'light' | 'system';
    
    // 只有在 "system" 模式下才响应系统主题变化
    if (theme === 'system') {
      const backgroundColor = nativeTheme.shouldUseDarkColors ? '#1E1E1E' : '#FAFAFA';
      const titleBarColor = backgroundColor;
      const titleBarSymbolColor = backgroundColor === '#FAFAFA' ? '#000000' : '#FFFFFF';
      const win = BrowserWindow.getAllWindows()[0];
      
      if (win) {
        win.setBackgroundColor(backgroundColor);
        win.setTitleBarOverlay({
          color: titleBarColor,
          symbolColor: titleBarSymbolColor
        });
      }
    }
  });

  app.on('activate', () => {
    logger.info('应用激活事件');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('所有窗口已关闭');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', { reason, promise });
});

export { mainWindow };
