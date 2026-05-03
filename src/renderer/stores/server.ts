import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { ServerConfig, DeployTargetConfig, BuildConfig } from '../../shared/types';

// 创建默认构建配置
function createDefaultBuildConfig(type: 'frontend' | 'backend'): BuildConfig {
  return {
    type,
    localPath: '',
    buildCommand: '',
    envVars: {},
    outputDir: '',
    stopOnBuildFailure: true
  };
}

// 创建默认部署目标配置
function createDefaultDeployTarget(type: 'frontend' | 'backend'): DeployTargetConfig {
  return {
    type,
    remotePath: '',
    postUploadCommand: '',
    logCommand: '',
    enabled: false,
    buildConfig: createDefaultBuildConfig(type)
  };
}

// 迁移旧配置到新结构
function migrateConfig(server: any): ServerConfig {
  // 创建一个完整的前端配置
  const frontendConfig: DeployTargetConfig = {
    type: 'frontend',
    remotePath: '',
    postUploadCommand: '',
    logCommand: '',
    enabled: false,
    buildConfig: undefined,
    ...(server.frontend || {})  // 合并已有数据
  };

  // 如果没有 buildConfig，创建一个默认的
  if (!frontendConfig.buildConfig) {
    frontendConfig.buildConfig = {
      type: 'frontend',
      localPath: '',
      buildCommand: '',
      envVars: {},
      outputDir: '',
      stopOnBuildFailure: true
    };
  }

  // 创建一个完整的后端配置（使用any以支持微服务扩展）
  const backendConfig: any = {
    type: 'backend',
    remotePath: '',
    postUploadCommand: '',
    logCommand: '',
    enabled: false,
    buildConfig: undefined,
    microservices: [],
    rootPath: '',
    ...(server.backend || {})  // 合并已有数据
  };

  // 如果没有 buildConfig，创建一个默认的
  if (!backendConfig.buildConfig) {
    backendConfig.buildConfig = {
      type: 'backend',
      localPath: '',
      buildCommand: '',
      envVars: {},
      outputDir: '',
      stopOnBuildFailure: true
    };
  }

  // 合并旧字段到新结构（如果存在）
  if (!frontendConfig.remotePath) {
    frontendConfig.remotePath = server.frontendPath || server.remotePath || '';
  }
  if (!frontendConfig.postUploadCommand) {
    frontendConfig.postUploadCommand = server.frontendPostUploadCommand || server.postUploadCommand || '';
  }
  if (!frontendConfig.logCommand) {
    frontendConfig.logCommand = server.frontendLogCommand || '';
  }
  if (!frontendConfig.enabled) {
    frontendConfig.enabled = !!(server.frontendPath || server.remotePath || server.frontendPostUploadCommand || server.buildConfig);
  }
  // 如果 buildConfig 没有 type，设置它
  if (frontendConfig.buildConfig && !frontendConfig.buildConfig.type) {
    frontendConfig.buildConfig.type = 'frontend';
  }

  if (!backendConfig.remotePath) {
    backendConfig.remotePath = server.backendPath || '';
  }
  if (!backendConfig.postUploadCommand) {
    backendConfig.postUploadCommand = server.backendPostUploadCommand || '';
  }
  if (!backendConfig.logCommand) {
    backendConfig.logCommand = server.backendLogCommand || '';
  }
  if (!backendConfig.enabled) {
    backendConfig.enabled = !!(server.backendPath || server.backendPostUploadCommand || server.buildConfig?.type === 'backend');
  }
  // 如果 buildConfig 没有 type，设置它
  if (backendConfig.buildConfig && !backendConfig.buildConfig.type) {
    backendConfig.buildConfig.type = 'backend';
  }

  // 构建最终配置
  const migrated: ServerConfig = {
    id: server.id,
    name: server.name || '',
    host: server.host || '',
    port: server.port || 22,
    username: server.username || '',
    password: server.password,
    privateKey: server.privateKey,
    retryCount: server.retryCount || 3,
    frontend: frontendConfig,
    backend: backendConfig
  };

  return migrated;
}

// 迁移服务器列表
function migrateServers(servers: any[]): ServerConfig[] {
  return servers.map(server => migrateConfig(server));
}

export const useServerStore = defineStore('server', () => {
  // 服务器列表
  const servers = ref<ServerConfig[]>([]);
  
  // 当前选中的服务器ID
  const selectedServerId = ref<string>('');
  
  // 当前选中的服务器对象（计算属性）
  const selectedServer = computed(() => 
    servers.value.find(s => s.id === selectedServerId.value) || null
  );
  
  // 最后更新时间戳，用于检测配置是否需要刷新
  const lastUpdateTime = ref<number>(0);
  
  // 加载服务器列表
  async function loadServers() {
    try {
      const rawConfigs = await window.electronAPI.getConfigs();
      servers.value = migrateServers(rawConfigs);
      lastUpdateTime.value = Date.now();
      console.log('服务器配置已更新，时间戳:', lastUpdateTime.value);
    } catch (error) {
      console.error('加载服务器列表失败:', error);
    }
  }
  
  // 保存配置并更新缓存
  async function saveConfig(config: ServerConfig) {
    try {
      const updatedServers = await window.electronAPI.saveConfig(config);
      servers.value = migrateServers(updatedServers);
      lastUpdateTime.value = Date.now();
      console.log('配置已保存并更新缓存，时间戳:', lastUpdateTime.value);
      return updatedServers;
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  }
  
  // 检查并刷新配置（如果需要）
  async function refreshIfNeeded() {
    // 如果从未加载过配置，直接加载
    if (lastUpdateTime.value === 0) {
      return loadServers();
    }

    // 获取最新配置时间戳（通过获取配置数量来判断是否有更新）
    try {
      const latestConfigs = await window.electronAPI.getConfigs();
      if (latestConfigs.length !== servers.value.length) {
        console.log('检测到配置数量变化，刷新缓存');
        servers.value = migrateServers(latestConfigs);
        lastUpdateTime.value = Date.now();
        return;
      }

      // 检查每个配置的最后修改时间（如果API支持）
      // 这里简化处理，实际可以通过比较配置内容来判断
      const hasChanges = latestConfigs.some((config, index) => {
        const currentConfig = servers.value[index];
        if (!currentConfig) return true;
        return JSON.stringify(config) !== JSON.stringify(currentConfig);
      });

      if (hasChanges) {
        console.log('检测到配置内容变化，刷新缓存');
        servers.value = migrateServers(latestConfigs);
        lastUpdateTime.value = Date.now();
      }
    } catch (error) {
      console.error('检查配置更新失败:', error);
    }
  }
  
  // 设置选中的服务器ID
  function setSelectedServerId(id: string) {
    // 如果切换到不同的服务器，断开所有连接
    if (id && id !== selectedServerId.value) {
      disconnectAll();
    }
    selectedServerId.value = id;
  }

  // 清除选中的服务器
  function clearSelectedServer() {
    selectedServerId.value = '';
  }

  // 断开所有连接（终端和日志流）
  async function disconnectAll() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.disconnectAll) {
        await window.electronAPI.disconnectAll();
        console.log('服务器切换，所有连接已断开');
      }
    } catch (error) {
      console.error('断开所有连接失败:', error);
    }
  }

  // 监听服务器切换，自动断开所有连接
  let previousServerId = selectedServerId.value;
  watch(selectedServerId, (newId) => {
    // 只有当切换到不同服务器时才断开连接
    if (newId && newId !== previousServerId) {
      disconnectAll();
    }
    previousServerId = newId;
  });
  
  return {
    servers,
    selectedServerId,
    selectedServer,
    lastUpdateTime,
    loadServers,
    saveConfig,
    refreshIfNeeded,
    setSelectedServerId,
    clearSelectedServer,
    disconnectAll
  };
});
