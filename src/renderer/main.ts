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
}, 100);


