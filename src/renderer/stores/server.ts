import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ServerConfig } from '../../shared/types';

export const useServerStore = defineStore('server', () => {
  // 服务器列表
  const servers = ref<ServerConfig[]>([]);
  
  // 当前选中的服务器ID
  const selectedServerId = ref<string>('');
  
  // 当前选中的服务器对象（计算属性）
  const selectedServer = computed(() => 
    servers.value.find(s => s.id === selectedServerId.value) || null
  );
  
  // 加载服务器列表
  async function loadServers() {
    try {
      servers.value = await window.electronAPI.getConfigs();
    } catch (error) {
      console.error('加载服务器列表失败:', error);
    }
  }
  
  // 设置选中的服务器ID
  function setSelectedServerId(id: string) {
    selectedServerId.value = id;
  }
  
  // 清除选中的服务器
  function clearSelectedServer() {
    selectedServerId.value = '';
  }
  
  return { 
    servers, 
    selectedServerId, 
    selectedServer,
    loadServers, 
    setSelectedServerId,
    clearSelectedServer
  };
});
