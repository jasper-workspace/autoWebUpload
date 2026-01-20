import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

// 定义路由元信息类型
declare module 'vue-router' {
  interface RouteMeta {
    requiresUploadCheck?: boolean;
    showServerSelector?: boolean;
  }
}

// 定义路由
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomePage.vue'),
    meta: {
      title: '文件部署',
      showServerSelector: true
    }
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../pages/LogPage.vue'),
    meta: {
      title: '系统日志',
      showServerSelector: true
    }
  },
  {
    path: '/config',
    name: 'Config',
    component: () => import('../pages/ConfigPage.vue'),
    meta: {
      title: '服务器配置',
      showServerSelector: false
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../pages/SettingsPage.vue'),
    meta: {
      title: '系统设置',
      showServerSelector: false
    }
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 初始化全局方法
if (typeof window !== 'undefined') {
  window.isUploading = undefined;
  window.cancelUpload = undefined;
}

// 添加路由守卫
router.beforeEach((to, from, next) => {
  // 移除上传检查，允许页面切换时保持传输
  next();
});

// 导出路由
export default router;

