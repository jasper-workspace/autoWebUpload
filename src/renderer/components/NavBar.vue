<template>
  <header
    class="h-16 flex-shrink-0 bg-[var(--header-bg)] border-b border-[var(--header-border)] flex items-center px-6 z-50">
    <!-- 左侧：服务器选择器 -->
    <div v-if="showServerSelector" class="flex items-center flex-shrink-0">
      <ServerSelector v-model="serverStore.selectedServerId" />
    </div>

    <!-- 右侧：导航按钮 -->
    <div class="flex gap-2 ml-auto">
      <router-link to="/" :class="[
        'px-6 py-2 rounded-lg font-medium transition-all duration-200',
        isRouteActive('/')
          ? 'bg-[#409EFF] text-white'
          : 'text-[var(--muted-text)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
      ]">
        文件部署
      </router-link>
      <router-link to="/logs" :class="[
        'px-6 py-2 rounded-lg font-medium transition-all duration-200',
        isRouteActive('/logs')
          ? 'bg-[#409EFF] text-white'
          : 'text-[var(--muted-text)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
      ]">
        终端
      </router-link>
      <router-link to="/config" :class="[
        'px-6 py-2 rounded-lg font-medium transition-all duration-200',
        isRouteActive('/config')
          ? 'bg-[#409EFF] text-white'
          : 'text-[var(--muted-text)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
      ]">
        服务器配置
      </router-link>
      <router-link to="/settings" :class="[
        'p-2 rounded-lg transition-all duration-200 flex items-center justify-center',
        isRouteActive('/settings')
          ? 'bg-[#409EFF] text-white'
          : 'text-[var(--muted-text)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]'
      ]" title="系统设置">
        <Settings class="w-5 h-5" />
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Settings } from 'lucide-vue-next';
import { useServerStore } from '../stores/server';
import ServerSelector from './ServerSelector.vue';

const route = useRoute();
const serverStore = useServerStore();

// 判断当前路由是否是某个tab
function isRouteActive(path: string): boolean {
  return route.path === path;
}

// 判断是否显示服务器选择器
const showServerSelector = computed(() => {
  return route.path === '/' || route.path === '/logs';
});
</script>

<style scoped>
/* 导航链接和按钮保持可点击 */
header a,
header button {
  -webkit-app-region: no-drag;
}
</style>
