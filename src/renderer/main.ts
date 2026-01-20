import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';
import pinia from './stores';
import { logger } from './utils/logger';

logger.info('渲染进程启动');

const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount('#app');

// 加载主题配置
async function loadThemeConfig() {
  try {
    if (window.electronAPI && window.electronAPI.getThemeConfig) {
      const theme = await window.electronAPI.getThemeConfig();
      document.documentElement.setAttribute('data-theme', theme);
      logger.info('主题配置加载成功', { theme });
    } else {
      logger.warn('electronAPI 未初始化，无法获取主题配置');
      // 默认使用系统主题
      document.documentElement.setAttribute('data-theme', 'system');
    }
  } catch (error) {
    logger.error('加载主题配置失败', error);
    // 出错时默认使用系统主题
    document.documentElement.setAttribute('data-theme', 'system');
  }
}

// 设置窗口标题 - 在应用挂载后执行，确保 electronAPI 已初始化
setTimeout(() => {
  if (window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then((version: string) => {
      document.title = `Linux 服务器自动部署工具 v${version}`;
    }).catch((error: Error) => {
      logger.error('获取应用版本失败', error);
    });
  } else {
    logger.warn('electronAPI 未初始化，无法获取应用版本');
  }
  
  // 加载主题配置
  loadThemeConfig();
}, 100);


