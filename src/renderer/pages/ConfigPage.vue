<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
      <!-- 左侧：服务器列表 -->
      <div class="card p-3 flex flex-col overflow-hidden md:col-span-4">
        <div class="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 class="text-sm font-semibold text-[#E0E0E0]">服务器列表</h2>
          <button @click="addNewServer" class="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm">
            添加服务器
          </button>
        </div>

        <div class="space-y-3 overflow-y-auto flex-1 mb-4">
          <div
            v-for="server in servers"
            :key="server.id"
            :class="[
              'px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200',
              selectedServerId === server.id
                ? 'border-[#409EFF] bg-[#409EFF]/10'
                : 'border-[#3C3C3C] hover:border-[#5C5C5C] bg-[#1E1E1E]'
            ]"
            @click="selectServer(server.id)"
          >
            <div class="flex justify-between items-start mb-2">
              <div>
                <h3 class="text-sm font-medium text-[#E0E0E0]">{{ server.name }}</h3>
                <!-- <p class="text-sm text-[#B0B0B0]">{{ server.host }}:{{ server.port }}</p> -->
              </div>
              <button
                @click.stop="deleteServer(server.id)"
                class="p-1 hover:bg-red-500/20 rounded transition-colors"
              >
                <Trash2 class="w-4 h-4 text-red-400" />
              </button>
            </div>
            <div class="flex flex-col gap-1 text-xs text-[#8C8C8C]">
              <div>服务器: {{ server.host }}:{{ server.port }}</div>
              <div>用户: {{ server.username }}</div>
              <div class="truncate" :title="server.remotePath">路径: {{ server.remotePath }}</div>
            </div>
          </div>

          <div v-if="servers.length === 0" class="text-center py-8 text-[#8C8C8C]">
            <Server class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无服务器配置</p>
          </div>
        </div>
      </div>

      <!-- 右侧：配置表单 -->
      <div class="card p-5 overflow-y-auto md:col-span-8">
        <h2 class="text-sm font-semibold text-[#E0E0E0] mb-4">
          {{ isEditing ? '编辑服务器' : '添加服务器' }}
        </h2>

        <form @submit.prevent="saveConfig" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">服务器名称 *</label>
            <input 
              v-model="form.name" 
              type="text" 
              class="input-field" 
              placeholder="例如: 生产环境服务器"
              required
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-[#B0B0B0] mb-2">主机地址 *</label>
              <input 
                v-model="form.host" 
                type="text" 
                class="input-field" 
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-[#B0B0B0] mb-2">端口 *</label>
              <input 
                v-model.number="form.port" 
                type="number" 
                class="input-field" 
                placeholder="22"
                required
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">用户名 *</label>
            <input 
              v-model="form.username" 
              type="text" 
              class="input-field" 
              placeholder="root"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">认证方式</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  v-model="authType" 
                  type="radio" 
                  value="password"
                  class="accent-[#409EFF]"
                />
                <span class="text-[#E0E0E0]">密码</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  v-model="authType" 
                  type="radio" 
                  value="key"
                  class="accent-[#409EFF]"
                />
                <span class="text-[#E0E0E0]">私钥</span>
              </label>
            </div>
          </div>

          <div v-if="authType === 'password'">
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">密码 *</label>
            <div class="relative">
              <input 
                v-model="form.password" 
                :type="showPassword ? 'text' : 'password'" 
                class="input-field pr-10"
                placeholder="请输入密码"
                required
              />
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#E0E0E0]"
              >
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div v-if="authType === 'key'">
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">私钥路径</label>
            <input
              v-model="form.privateKey"
              type="text"
              class="input-field"
              placeholder="/path/to/private/key"
            />
          </div>

          <!-- 连接测试结果 -->
          <div
            v-if="connectionResult"
            :class="[
              'p-3 rounded-lg text-sm',
              connectionResult.success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            ]"
          >
            {{ connectionResult.message }}
            <span v-if="connectionResult.time" class="block mt-1 text-xs opacity-75">
              耗时: {{ connectionResult.time }}ms
            </span>
          </div>

          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">远程部署路径 *</label>
            <input 
              v-model="form.remotePath" 
              type="text" 
              class="input-field" 
              placeholder="/var/www/html"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">错误重试次数</label>
            <input 
              v-model.number="form.retryCount" 
              type="number" 
              class="input-field" 
              placeholder="3"
              min="0"
              max="10"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-[#B0B0B0] mb-2">
              上传后命令 <span class="text-[#8C8C8C]">(可选)</span>
            </label>
            <textarea 
              v-model="form.postUploadCommand" 
              class="input-field h-24 resize-none"
              placeholder="chmod -R 755 /var/www/html"
            ></textarea>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="submit" class="btn-primary flex-1 text-sm">
              {{ isEditing ? '更新配置' : '保存配置' }}
            </button>
            <button
              v-if="isEditing"
              type="button"
              @click="testConnection"
              :disabled="testingConnection"
              class="btn-primary flex items-center justify-center gap-2 text-sm"
            >
              <Wifi v-if="!testingConnection" class="w-4 h-4" />
              <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {{ testingConnection ? '测试中...' : '测试连接' }}
            </button>
            <button
              v-if="isEditing"
              type="button"
              @click="resetForm"
              class="btn-secondary text-sm"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus, Trash2, Server, Eye, EyeOff, Wifi } from 'lucide-vue-next';
import type { ServerConfig } from '../../shared/types';
import type { ConnectionTestResult } from '../../shared/types';

const servers = ref<ServerConfig[]>([]);
const selectedServerId = ref('');
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
  remotePath: '',
  retryCount: 3,
  postUploadCommand: ''
});

const isEditing = computed(() => !!form.id);

async function loadServers() {
  try {
    servers.value = await window.electronAPI.getConfigs();
  } catch (error) {
    console.error('加载服务器列表失败:', error);
  }
}

function addNewServer() {
  resetForm();
  selectedServerId.value = '';
}

async function selectServer(id: string) {
  selectedServerId.value = id;
  const server = servers.value.find(s => s.id === id);
  if (server) {
    form.id = server.id;
    form.name = server.name;
    form.host = server.host;
    form.port = server.port;
    form.username = server.username;
    form.password = server.password || '';
    form.privateKey = server.privateKey || '';
    form.remotePath = server.remotePath;
    form.retryCount = server.retryCount || 3;
    form.postUploadCommand = server.postUploadCommand || '';
    authType.value = server.password ? 'password' : 'key';
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
  form.remotePath = '';
  form.retryCount = 3;
  form.postUploadCommand = '';
  authType.value = 'password';
  showPassword.value = false;
}

async function saveConfig() {
  const config: ServerConfig = {
    id: form.id || Date.now().toString(),
    name: form.name,
    host: form.host,
    port: form.port,
    username: form.username,
    password: authType.value === 'password' ? form.password : undefined,
    privateKey: authType.value === 'key' ? form.privateKey : undefined,
    remotePath: form.remotePath,
    retryCount: form.retryCount,
    postUploadCommand: form.postUploadCommand || undefined
  };

  try {
    await window.electronAPI.saveConfig(config);
    await loadServers();
    if (!isEditing.value) {
      resetForm();
      selectedServerId.value = config.id;
    }
  } catch (error) {
    console.error('保存配置失败:', error);
  }
}

async function deleteServer(id: string) {
  if (!confirm('确定要删除这个服务器配置吗？')) return;

  try {
    await window.electronAPI.deleteConfig(id);
    await loadServers();
    if (selectedServerId.value === id) {
      resetForm();
      selectedServerId.value = '';
    }
  } catch (error) {
    console.error('删除配置失败:', error);
  }
}

async function testConnection() {
  if (!form.host || !form.port || !form.username) {
    alert('请填写服务器配置信息');
    return;
  }

  testingConnection.value = true;
  connectionResult.value = null;

  try {
    const configToTest: Partial<ServerConfig> = {
      id: form.id,
      name: form.name,
      host: form.host,
      port: form.port,
      username: form.username,
      password: authType.value === 'password' ? form.password : undefined,
      privateKey: authType.value === 'key' ? form.privateKey : undefined
    };

    const result = await window.electronAPI.testConnection(configToTest);
    connectionResult.value = result;
  } catch (error: any) {
    connectionResult.value = { success: false, message: error.message || '连接失败', time: 0 };
  } finally {
    testingConnection.value = false;
  }
}

onMounted(() => {
  loadServers();
});
</script>
