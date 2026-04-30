<template>
  <div class="h-screen flex flex-col bg-[var(--background)]">
    <!-- 自定义标题栏 -->
    <div class="custom-titlebar h-8 flex items-center px-4" style="padding-right: 120px;">
      <span class="text-sm font-medium" style="color: var(--foreground);">
        Linux 服务器自动部署工具 v{{ appVersion }}
      </span>
    </div>

    <!-- 导航栏和内容区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <NavBar ref="navbarRef" />

      <!-- 主内容区 - 路由出口 -->
      <div class="flex-1 px-6 py-4 overflow-hidden">
        <router-view v-slot="{ Component }">
          <keep-alive include="Log">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>

      <!-- 全局通知组件 -->
      <NotificationDialog ref="notificationRef" />

      <!-- 更新提示弹窗 -->
      <UpdateDialog
        :update-info="updateInfo"
        @close="updateInfo = undefined"
        @update="handleUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './components/NavBar.vue';
import ServerSelector from './components/ServerSelector.vue';
import NotificationDialog from './components/NotificationDialog.vue';
import UpdateDialog from './components/UpdateDialog.vue';
import { useServerStore } from './stores/server';
import { registerNotification, type NotificationComponent } from './utils/notification';
import { logger } from './utils/logger';

const navbarRef = ref<InstanceType<typeof NavBar> | null>(null);
const notificationRef = ref<NotificationComponent | null>(null);
const route = useRoute();
const serverStore = useServerStore();

// 应用版本号
const appVersion = ref('1.0.0');

// 获取应用版本号
async function loadAppVersion() {
  try {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      appVersion.value = await window.electronAPI.getAppVersion();
    }
  } catch (error) {
    console.error('获取版本号失败:', error);
  }
}

// 更新信息
interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  published_at: string;
  assets: ReleaseAsset[];
}

interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_url: string;
  browser_download_url: string;
}

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
  ignored?: boolean;
}

const updateInfo = ref<UpdateInfo | undefined>();

// 监听路由变化，确保导航状态正确
watch(() => route.path, (newPath) => {
  if (navbarRef.value) {
    // 触发导航栏更新
    const navBar = navbarRef.value as any;
    if (navBar.$forceUpdate) {
      navBar.$forceUpdate();
    }
  }
});

// 初始化时加载服务器列表
onMounted(async () => {
  try {
    await serverStore.loadServers();
  } catch (error) {
    console.error('加载服务器列表失败:', error);
  }
});

// 注册通知组件
onMounted(() => {
  // 使用nextTick确保DOM已完全渲染
  nextTick(() => {
    if (notificationRef.value) {
      registerNotification(notificationRef.value);
    }
  });
});

// 检查更新
async function checkForUpdates() {
  try {
    logger.info('开始检查更新...');
    
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      const result = await window.electronAPI.checkForUpdates();
      logger.debug('更新检查结果', result);
      
      if (result.hasUpdate) {
        updateInfo.value = result;
      }
    } else {
      logger.warn('electronAPI 未初始化，无法检查更新');
    }
  } catch (error: any) {
    logger.error('检查更新失败', error);
  }
}

// 处理更新
function handleUpdate(url: string) {
  logger.info('用户点击了更新按钮，跳转到:', url);
  // 更新逻辑已在UpdateDialog组件中处理
}

onMounted(async () => {
  try {
    await serverStore.loadServers();
    await loadAppVersion();
    
    // 使用setTimeout确保应用初始化完成后再检查更新
    setTimeout(() => {
      checkForUpdates();
    }, 1000);
  } catch (error) {
    console.error('加载服务器列表失败:', error);
  }
});

onActivated(() => {
  // 应用激活时，检查并刷新配置
  serverStore.refreshIfNeeded();
});
</script>

<style scoped>
/* 自定义标题栏样式 - 支持拖拽 */
.custom-titlebar {
  -webkit-app-region: drag;
}
</style>

