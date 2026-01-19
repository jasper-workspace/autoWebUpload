<template>
  <div class="h-screen flex flex-col bg-[#1E1E1E]">
    <NavBar ref="navbarRef" />

    <!-- 服务器选择器 - 仅在需要显示的页面显示 -->
    <div v-if="showServerSelector" class="px-6 py-3 border-b border-[#3C3C3C] bg-[#252525]">
      <ServerSelector v-model="serverStore.selectedServerId" />
    </div>

    <!-- 主内容区 - 路由出口 -->
    <div class="flex-1 px-6 py-4 overflow-auto">
      <router-view />
    </div>
    
    <!-- 全局通知组件 -->
    <NotificationDialog ref="notificationRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './components/NavBar.vue';
import ServerSelector from './components/ServerSelector.vue';
import NotificationDialog from './components/NotificationDialog.vue';
import { useServerStore } from './stores/server';
import { registerNotification, type NotificationComponent } from './utils/notification';

const navbarRef = ref<InstanceType<typeof NavBar> | null>(null);
const notificationRef = ref<NotificationComponent | null>(null);
const route = useRoute();
const serverStore = useServerStore();

// 根据路由元信息判断是否显示服务器选择器
const showServerSelector = computed(() => {
  return route.meta.showServerSelector === true;
});

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

onActivated(() => {
  // 应用激活时，检查并刷新配置
  serverStore.refreshIfNeeded();
});
</script>

