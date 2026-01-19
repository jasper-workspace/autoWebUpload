<template>
  <header class="h-16 flex-shrink-0 bg-[#252525] border-b border-[#3C3C3C] flex items-center px-6 z-50">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-semibold text-[#E0E0E0]">Linux 服务器自动部署工具</h1>
    </div>
    <div class="flex gap-2 ml-auto">
      <router-link
        to="/"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          isRouteActive('/')
            ? 'bg-[#409EFF] text-white'
            : 'text-[#B0B0B0] hover:text-[#E0E0E0] hover:bg-[#3C3C3C]'
        ]"
      >
        文件部署
      </router-link>
      <router-link
        to="/logs"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          isRouteActive('/logs')
            ? 'bg-[#409EFF] text-white'
            : 'text-[#B0B0B0] hover:text-[#E0E0E0] hover:bg-[#3C3C3C]'
        ]"
      >
        系统日志
      </router-link>
      <router-link
        to="/config"
        :class="[
          'px-6 py-2 rounded-lg font-medium transition-all duration-200',
          isRouteActive('/config')
            ? 'bg-[#409EFF] text-white'
            : 'text-[#B0B0B0] hover:text-[#E0E0E0] hover:bg-[#3C3C3C]'
        ]"
      >
        服务器配置
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// 判断当前路由是否是某个tab
function isRouteActive(path: string): boolean {
  return route.path === path;
}
</script>

