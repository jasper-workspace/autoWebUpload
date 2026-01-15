import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { logger } from './utils/logger';

logger.info('渲染进程启动');

// 设置窗口标题
window.electronAPI.getAppVersion().then((version: string) => {
  document.title = `Linux 服务器自动部署工具 v${version}`;
});

createApp(App).mount('#app');
