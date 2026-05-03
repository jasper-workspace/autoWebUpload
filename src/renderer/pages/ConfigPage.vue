<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="flex justify-between items-center mb-4 flex-shrink-0">
      <h2 class="text-lg font-semibold text-[var(--foreground)]">服务器配置</h2>
      <div class="flex items-center gap-2">
        <button @click="importConfigs" class="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm">
          <Download class="w-4 h-4" />
          导入
        </button>
        <button @click="exportConfigs" class="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm">
          <Upload class="w-4 h-4" />
          导出
        </button>
        <button @click="addNewServer" class="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm">
          <Plus class="w-4 h-4" />
          添加服务器
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
      <!-- 服务器列表 -->
      <div class="card p-3 flex flex-col overflow-hidden md:col-span-4">
        <div class="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 class="text-sm font-semibold text-[var(--foreground)]">服务器列表</h2>
          <span class="text-xs text-[var(--muted-text)]">{{ servers.length }} 台服务器</span>
        </div>

        <div class="space-y-3 overflow-y-auto flex-1 pr-2">
          <div v-for="server in servers" :key="server.id" :class="[
            'px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200',
            selectedServerId === server.id
              ? 'border-[#409EFF] bg-[#409EFF]/10'
              : 'border-[var(--card-border)] hover:border-[var(--scrollbar-thumb-hover)] bg-[var(--card-bg)]'
          ]" @click="selectServer(server.id)">
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-[var(--foreground)]">{{ server.name }}</h3>
              </div>
              <button @click.stop="deleteServer(server.id)" class="p-1 hover:bg-red-500/20 rounded transition-colors">
                <Trash2 class="w-4 h-4 text-red-400" />
              </button>
            </div>
            <div class="flex flex-col gap-1 text-xs text-[var(--muted-text)]">
              <div>服务器: {{ server.host }}:{{ server.port }}</div>
              <div>用户: {{ server.username }}</div>
            </div>
          </div>

          <div v-if="servers.length === 0" class="text-center py-8 text-[var(--muted-text)]">
            <Server class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无服务器配置</p>
          </div>
        </div>
      </div>

      <!-- 配置表单 -->
      <div class="card p-5 overflow-y-auto flex flex-col h-full md:col-span-8">
        <h2 class="text-sm font-semibold text-[var(--foreground)] mb-4">
          {{ isEditing ? '编辑服务器' : '添加服务器' }}
        </h2>

        <div class="space-y-6 overflow-y-auto flex-1 pr-2">
          <!-- 1. 服务器信息 -->
          <div class="section">
            <h3 class="text-md font-semibold text-[#409EFF] mb-4 flex items-center gap-2">
              <Server class="w-4 h-4" />
              服务器信息
            </h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">服务器名称</label>
                <input v-model="form.name" type="text" class="input-field" placeholder="例如: 生产环境服务器" />
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">主机地址</label>
                  <input v-model="form.host" type="text" class="input-field" placeholder="192.168.1.100" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">端口</label>
                  <input v-model.number="form.port" type="number" class="input-field" placeholder="22" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">用户名</label>
                <input v-model="form.username" type="text" class="input-field" placeholder="root" />
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">认证方式</label>
                <div class="flex gap-3">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input v-model="authType" type="radio" value="password" class="accent-[#409EFF]" />
                    <span class="text-[var(--foreground)]">密码</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input v-model="authType" type="radio" value="key" class="accent-[#409EFF]" />
                    <span class="text-[var(--foreground)]">私钥</span>
                  </label>
                </div>
              </div>

              <div v-if="authType === 'password'">
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">密码</label>
                <div class="relative">
                  <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="input-field pr-10"
                    placeholder="请输入密码" />
                  <button type="button" @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-text)] hover:text-[var(--foreground)]">
                    <Eye v-if="!showPassword" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div v-if="authType === 'key'">
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">私钥路径</label>
                <input v-model="form.privateKey" type="text" class="input-field" placeholder="/path/to/private/key" />
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">错误重试次数</label>
                <input v-model.number="form.retryCount" type="number" class="input-field" placeholder="3" />
              </div>
            </div>
          </div>

          <!-- 2. 前端配置 -->
          <div class="section">
            <h3 class="text-md font-semibold mb-4 flex items-center gap-2">
              <div class="w-4 h-4 rounded bg-gradient-to-br from-blue-400 to-blue-600"></div>
              前端部署配置
            </h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">部署路径</label>
                <input v-model="form.frontend.remotePath" type="text" class="input-field" placeholder="/var/www/html" />
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  上传后命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <textarea v-model="form.frontend.postUploadCommand" class="input-field h-20 resize-none"
                  placeholder="chmod -R 755 /var/www/html"></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  日志命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <input v-model="form.frontend.logCommand" type="text" class="input-field"
                  placeholder="tail -f /var/log/nginx/error.log" />
              </div>

              <!-- 前端构建配置 -->
              <div class="border-t border-[var(--card-border)] pt-4 mt-4">
                <h4 class="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <Package class="w-4 h-4" />
                  前端构建配置
                </h4>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">项目路径</label>
                    <div class="flex gap-2">
                      <input v-model="form.frontend.buildConfig!.localPath" type="text" class="input-field flex-1"
                        placeholder="例如: D:\projects\my-vue-app" />
                      <button type="button" @click="selectBuildPath('frontend')" class="btn-secondary text-sm">
                        浏览
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">打包命令</label>
                    <input v-model="form.frontend.buildConfig!.buildCommand" type="text" class="input-field"
                      placeholder="例如: npm run build" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">产物目录</label>
                    <input v-model="form.frontend.buildConfig!.outputDir" type="text" class="input-field"
                      placeholder="例如: dist (留空则自动检测)" />
                  </div>

                  <div class="flex items-center gap-2">
                    <input v-model="form.frontend.buildConfig!.stopOnBuildFailure" type="checkbox" class="accent-[#409EFF]" />
                    <span class="text-sm text-[var(--foreground)]">构建失败时停止部署</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. 后端配置 -->
          <div class="section">
            <h3 class="text-md font-semibold mb-4 flex items-center gap-2">
              <div class="w-4 h-4 rounded bg-gradient-to-br from-purple-400 to-purple-600"></div>
              后端部署配置
            </h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">部署路径</label>
                <input v-model="form.backend.remotePath" type="text" class="input-field" placeholder="/var/www/backend" />
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  上传后命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <textarea v-model="form.backend.postUploadCommand" class="input-field h-20 resize-none"
                  placeholder="npm install && pm2 restart app"></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  日志命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <input v-model="form.backend.logCommand" type="text" class="input-field"
                  placeholder="tail -f /var/log/server/app.log" />
              </div>

              <!-- 后端构建配置 -->
              <div class="border-t border-[var(--card-border)] pt-4 mt-4">
                <h4 class="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <Package class="w-4 h-4" />
                  后端构建配置
                </h4>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">项目路径</label>
                    <div class="flex gap-2">
                      <input v-model="form.backend.buildConfig!.localPath" type="text" class="input-field flex-1"
                        placeholder="例如: D:\projects\my-backend" />
                      <button type="button" @click="selectBuildPath('backend')" class="btn-secondary text-sm">
                        浏览
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">打包命令</label>
                    <input v-model="form.backend.buildConfig!.buildCommand" type="text" class="input-field"
                      placeholder="例如: mvn clean package" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">产物目录</label>
                    <input v-model="form.backend.buildConfig!.outputDir" type="text" class="input-field"
                      placeholder="例如: target (留空则自动检测)" />
                  </div>

                  <div class="flex items-center gap-2">
                    <input v-model="form.backend.buildConfig!.stopOnBuildFailure" type="checkbox" class="accent-[#409EFF]" />
                    <span class="text-sm text-[var(--foreground)]">构建失败时停止部署</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4 flex-shrink-0">
            <button type="button" @click="saveConfig" class="btn-primary flex-1 text-sm">
              {{ isEditing ? '更新配置' : '保存配置' }}
            </button>
            <button v-if="isEditing" type="button" @click="testConnection" :disabled="testingConnection"
              class="btn-primary flex items-center justify-center gap-2 text-sm">
              <Wifi v-if="!testingConnection" class="w-4 h-4" />
              <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {{ testingConnection ? '测试中...' : '测试连接' }}
            </button>
            <button v-if="isEditing" type="button" @click="resetForm" class="btn-secondary text-sm">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 连接测试结果弹窗 -->
    <div v-if="connectionResult" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="closeConnectionResult">
      <div class="bg-[var(--dialog-bg)] rounded-lg p-6 max-w-md w-full mx-4"
        :class="connectionResult.success ? 'border border-green-500/30' : 'border border-red-500/30'" @click.stop>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full flex items-center justify-center"
            :class="connectionResult.success ? 'bg-green-500/20' : 'bg-red-500/20'">
            <div class="w-6 h-6 rounded-full" :class="connectionResult.success ? 'bg-green-500' : 'bg-red-500'"></div>
          </div>
          <h3 class="text-lg font-semibold text-[var(--foreground)]">
            {{ connectionResult.success ? '连接成功' : '连接失败' }}
          </h3>
        </div>

        <p class="text-[var(--foreground)] mb-4">{{ connectionResult.message }}</p>

        <div v-if="connectionResult.time" class="flex justify-between items-center mb-4">
          <span class="text-sm text-[var(--muted-text)]">连接耗时</span>
          <span class="text-sm font-medium text-[var(--foreground)]">{{ connectionResult.time }}ms</span>
        </div>

        <button @click="closeConnectionResult"
          class="w-full py-2 px-4 bg-[#409EFF] hover:bg-[#409EFF]/80 text-white rounded-md transition-colors">
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { Plus, Trash2, Server, Eye, EyeOff, Wifi, Download, Upload, Package } from 'lucide-vue-next';
import { showSuccess, showError } from '../utils/notification';
import type { ServerConfig, DeployTargetConfig, BuildConfig, ConnectionTestResult } from '../../shared/types';
import { useServerStore } from '../stores/server';

// 默认构建配置
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

// 默认部署目标配置
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

const serverStore = useServerStore();

// 使用store中的状态
const servers = computed(() => serverStore.servers);
const selectedServerId = computed({
  get: () => serverStore.selectedServerId,
  set: (value) => serverStore.setSelectedServerId(value)
});
const authType = ref<'password' | 'key'>('password');
const showPassword = ref(false);
const testingConnection = ref(false);
const connectionResult = ref<ConnectionTestResult | null>(null);

const form = reactive({
  id: '',
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKey: '',
  retryCount: 3,
  frontend: createDefaultDeployTarget('frontend'),
  backend: createDefaultDeployTarget('backend')
});

const isEditing = computed(() => !!form.id);

// 迁移旧配置到新结构
function migrateConfig(server: any): ServerConfig {
  // 如果已经是新结构（包含 frontend 和 backend），直接返回
  if (server.frontend && server.backend) {
    return server as ServerConfig;
  }

  // 否则进行迁移
  const migrated: ServerConfig = {
    id: server.id,
    name: server.name || '',
    host: server.host || '',
    port: server.port || 22,
    username: server.username || '',
    password: server.password,
    privateKey: server.privateKey,
    retryCount: server.retryCount || 3,
    frontend: {
      type: 'frontend',
      remotePath: server.frontendPath || server.remotePath || '',
      postUploadCommand: server.frontendPostUploadCommand || server.postUploadCommand || '',
      logCommand: server.frontendLogCommand || '',
      enabled: !!(server.frontendPath || server.remotePath || server.frontendPostUploadCommand || server.buildConfig),
      buildConfig: server.buildConfig?.type === 'frontend' ? server.buildConfig : undefined
    },
    backend: {
      type: 'backend',
      remotePath: server.backendPath || '',
      postUploadCommand: server.backendPostUploadCommand || '',
      logCommand: server.backendLogCommand || '',
      enabled: !!(server.backendPath || server.backendPostUploadCommand || server.buildConfig?.type === 'backend'),
      buildConfig: server.buildConfig?.type === 'backend' ? server.buildConfig : undefined
    }
  };

  return migrated;
}

async function loadServers() {
  try {
    await serverStore.loadServers();
    console.log('加载服务器列表成功:', servers.value);
  } catch (error) {
    console.error('加载服务器列表失败:', error);
    showError('操作失败', '加载服务器列表失败，请重试');
  }
}

function addNewServer() {
  resetForm();
  serverStore.clearSelectedServer();
}

async function selectServer(id: string) {
  serverStore.setSelectedServerId(id);
  const server = servers.value.find(s => s.id === id);

  if (server) {
    // 迁移旧配置到新结构
    const migrated = migrateConfig(server);

    form.id = migrated.id;
    form.name = migrated.name || '';
    form.host = migrated.host || '';
    form.port = migrated.port || 22;
    form.username = migrated.username || '';
    form.password = migrated.password || '';
    form.privateKey = migrated.privateKey || '';
    form.retryCount = migrated.retryCount || 3;
    authType.value = migrated.password ? 'password' : 'key';

    // 加载前端配置
    if (migrated.frontend) {
      form.frontend = {
        type: 'frontend',
        remotePath: migrated.frontend.remotePath || '',
        postUploadCommand: migrated.frontend.postUploadCommand || '',
        logCommand: migrated.frontend.logCommand || '',
        enabled: migrated.frontend.enabled || false,
        buildConfig: migrated.frontend.buildConfig || createDefaultBuildConfig('frontend')
      };
    }

    // 加载后端配置
    if (migrated.backend) {
      form.backend = {
        type: 'backend',
        remotePath: migrated.backend.remotePath || '',
        postUploadCommand: migrated.backend.postUploadCommand || '',
        logCommand: migrated.backend.logCommand || '',
        enabled: migrated.backend.enabled || false,
        buildConfig: migrated.backend.buildConfig || createDefaultBuildConfig('backend')
      };
    }
  }
}

function resetForm() {
  form.id = '';
  form.name = '';
  form.host = '';
  form.port = 22;
  form.username = '';
  form.password = '';
  form.privateKey = '';
  form.retryCount = 3;
  form.frontend = createDefaultDeployTarget('frontend');
  form.backend = createDefaultDeployTarget('backend');
  authType.value = 'password';
  showPassword.value = false;
}

async function saveConfig() {
  console.log('保存配置，表单数据:', form);

  // 基本验证，确保关键字段不为空
  if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
    showError('操作失败', '服务器名称、主机地址和用户名不能为空');
    return;
  }

  // 使用 JSON.parse(JSON.stringify()) 深度克隆，剥离响应式并确保可序列化
  const config = JSON.parse(JSON.stringify({
    id: form.id || Date.now().toString(),
    name: form.name.trim() || '未命名服务器',
    host: form.host.trim() || '',
    port: form.port || 22,
    username: form.username.trim() || '',
    password: authType.value === 'password' ? form.password : undefined,
    privateKey: authType.value === 'key' ? form.privateKey : undefined,
    retryCount: form.retryCount || 3,
    frontend: form.frontend,
    backend: form.backend
  }));

  try {
    console.log('准备保存配置:', config);
    await serverStore.saveConfig(config as ServerConfig);
    console.log('配置保存成功');

    // 重新加载服务器列表，确保数据是最新的
    await loadServers();

    // 显示成功提示
    const action = isEditing.value ? '更新' : '保存';
    showSuccess('操作成功', `服务器配置${action}成功！`);

    if (!isEditing.value) {
      resetForm();
      serverStore.setSelectedServerId(config.id);
    } else {
      // 编辑模式:重新加载表单缓存
      await selectServer(config.id);
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    showError('操作失败', '保存配置失败，请重试');
  }
}

async function deleteServer(id: string) {
  if (!confirm('确定要删除这个服务器配置吗？')) return;

  try {
    await window.electronAPI.deleteConfig(id);
    await loadServers();
    if (serverStore.selectedServerId === id) {
      resetForm();
      serverStore.clearSelectedServer();
    }
  } catch (error) {
    console.error('删除配置失败:', error);
  }
}

async function testConnection() {
  testingConnection.value = true;

  try {
    const configToTest = {
      id: form.id,
      name: form.name,
      host: form.host,
      port: form.port,
      username: form.username,
      password: authType.value === 'password' ? form.password : undefined,
      privateKey: authType.value === 'key' ? form.privateKey : undefined
    };

    const serializableConfig = toSerializableConfig(configToTest as any);
    const result = await window.electronAPI.testConnection(serializableConfig);
    connectionResult.value = result;
  } catch (error: any) {
    connectionResult.value = { success: false, message: error.message || '连接失败', time: 0 };
  } finally {
    testingConnection.value = false;
  }
}

// 关闭连接测试结果弹窗
function closeConnectionResult() {
  connectionResult.value = null;
}

// 导出服务器配置
async function exportConfigs() {
  if (servers.value.length === 0) {
    showError('导出失败', '没有可导出的服务器配置');
    return;
  }

  try {
    // 将响应式对象转换为普通对象后再传递
    const plainConfigs = servers.value.map(s => ({ ...s }));
    const result = await window.electronAPI.exportConfigs(plainConfigs);
    if (result.success) {
      showSuccess('导出成功', `配置已导出到: ${result.filePath}`);
    } else if (result.message !== '用户取消导出') {
      showError('导出失败', result.error || '导出失败');
    }
  } catch (error: any) {
    showError('导出失败', error.message || '导出失败');
  }
}

// 导入服务器配置
async function importConfigs() {
  try {
    const result = await window.electronAPI.importConfigs('replace');
    if (result.success) {
      await loadServers();
      showSuccess('导入成功', `成功导入 ${result.count} 个服务器配置`);
    } else if (result.message !== '用户取消导入') {
      showError('导入失败', result.error || '导入失败');
    }
  } catch (error: any) {
    showError('导入失败', error.message || '导入失败');
  }
}

// 选择构建项目路径
async function selectBuildPath(targetType: 'frontend' | 'backend') {
  try {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      if (targetType === 'frontend') {
        form.frontend.buildConfig!.localPath = folderPath;
      } else {
        form.backend.buildConfig!.localPath = folderPath;
      }
    }
  } catch (error: any) {
    console.error('选择文件夹失败:', error);
    showError('选择失败', error.message || '选择文件夹失败');
  }
}

onMounted(async () => {
  await loadServers();
});
</script>

<style scoped>
.section {
  padding: 20px;
  border-radius: 8px;
  transition: all 0.2s;
}

.section:hover {
  background: rgba(64, 158, 255, 0.05);
}
</style>