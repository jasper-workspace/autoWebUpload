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

              <!-- 测试连接按钮 -->
              <div class="pt-2">
                <button type="button" @click="testConnection" :disabled="testingConnection"
                  class="btn-primary flex items-center justify-center gap-2 text-sm w-full">
                  <Wifi v-if="!testingConnection" class="w-4 h-4" />
                  <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {{ testingConnection ? '测试中...' : '测试连接' }}
                </button>
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

            <!-- 后端架构选择 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">架构类型</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="backendArchitecture"
                    type="radio"
                    value="microservice"
                    class="accent-[#409EFF]" />
                  <span class="text-[var(--foreground)]">微服务</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    v-model="backendArchitecture"
                    type="radio"
                    value="single"
                    class="accent-[#409EFF]" />
                  <span class="text-[var(--foreground)]">单体</span>
                </label>
              </div>
              <p class="text-xs text-[var(--muted-text)] mt-1">
                {{ backendArchitecture === 'microservice' ? '微服务架构：支持多模块微服务分别部署' : '单体架构：使用构建配置打包部署单个后端项目' }}
              </p>
            </div>

            <!-- 单体架构配置 -->
            <div v-if="backendArchitecture === 'single'" class="space-y-4">
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

            <!-- 微服务架构配置 -->
            <div v-if="backendArchitecture === 'microservice'" class="space-y-4">
              <!-- Maven 路径配置 -->
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  Maven 路径 <span class="text-[var(--muted-text)]">(可选，留空使用系统默认)</span>
                </label>
                <div class="flex gap-2">
                  <input v-model="mavenPath" type="text" class="input-field flex-1"
                    placeholder="例如: D:\apache-maven-3.9.9" />
                  <button type="button" @click="selectMavenPath" class="btn-secondary text-sm">
                    浏览
                  </button>
                </div>
                <p class="text-xs text-[var(--muted-text)] mt-1">
                  指定 Maven 安装目录，包含 bin 文件夹的父目录
                </p>
              </div>

              <!-- Java 路径配置 -->
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  Java 路径 <span class="text-[var(--muted-text)]">(可选，留空使用系统默认)</span>
                </label>
                <div class="flex gap-2">
                  <input v-model="javaPath" type="text" class="input-field flex-1"
                    placeholder="例如: D:\jdk-17" />
                  <button type="button" @click="selectJavaPath" class="btn-secondary text-sm">
                    浏览
                  </button>
                </div>
                <p class="text-xs text-[var(--muted-text)] mt-1">
                  指定 Java JDK 安装目录，用于 Maven 构建
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">后端根目录</label>
                <div class="flex gap-2">
                  <input v-model="backendRootPath" type="text" class="input-field flex-1"
                    placeholder="微服务项目根目录，用于自动扫描微服务" />
                  <button type="button" @click="selectBackendRootPath" class="btn-secondary text-sm">
                    浏览
                  </button>
                </div>
                <p class="text-xs text-[var(--muted-text)] mt-1">
                  配置微服务项目根目录后，可以自动扫描并管理微服务
                </p>
              </div>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="scanMicroservices"
                  :disabled="!backendRootPath || isScanningMaven"
                  class="btn-secondary flex items-center gap-2 text-sm"
                >
                  <div v-if="isScanningMaven" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <Search v-else class="w-4 h-4" />
                  {{ isScanningMaven ? '扫描中...' : '扫描微服务' }}
                </button>
                <span v-if="microserviceCount > 0" class="text-sm text-[var(--muted-text)]">
                  已扫描到 {{ microserviceCount }} 个微服务
                </span>
              </div>

              <!-- Maven状态 -->
              <div v-if="!mavenInstalled" class="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertTriangle class="w-4 h-4 text-yellow-500" />
                <span class="text-sm text-yellow-500">未检测到Maven，请确保已安装Maven并配置环境变量</span>
              </div>

              <!-- 微服务列表预览 -->
              <div v-if="scannedMicroservices.length > 0" class="border border-[var(--card-border)] rounded-lg p-3">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="text-sm font-medium text-[var(--foreground)]">已扫描的微服务（共 {{ scannedMicroservices.length }} 个）</h5>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1 cursor-pointer text-xs text-[var(--muted-text)] hover:text-[var(--foreground)]">
                      <input type="checkbox"
                        :checked="allMicroservicesSelected"
                        :indeterminate="someMicroservicesSelected"
                        @change="toggleSelectAllMicroservices"
                        class="accent-[#409EFF]" />
                      全选
                    </label>
                    <button v-if="someMicroservicesSelected" @click="clearAllMicroservices" class="text-xs text-[#409EFF] hover:text-[#409EFF]/80">
                      清空
                    </button>
                  </div>
                </div>
                <div class="space-y-2 max-h-[400px] overflow-y-auto">
                  <div
                    v-for="ms in scannedMicroservices"
                    :key="ms.id"
                    class="border border-[var(--card-border)] rounded-lg p-2 bg-[var(--card-bg)]"
                  >
                    <!-- 微服务头部：名称和启用checkbox -->
                    <div class="flex items-center gap-2 mb-2">
                      <input type="checkbox" v-model="ms.enabled" class="accent-[#409EFF]" />
                      <span class="text-[var(--foreground)] font-medium flex-1 text-sm">{{ ms.name }}</span>
                      <span class="text-[var(--muted-text)] text-xs">{{ ms.artifactId }}</span>
                    </div>

                    <!-- 微服务配置表单 -->
                    <div class="grid grid-cols-1 gap-1.5 pl-6">
                      <!-- 远程路径 -->
                      <div class="flex items-center gap-2">
                        <label class="text-xs text-[var(--muted-text)] w-14 flex-shrink-0">远程路径:</label>
                        <input
                          v-model="ms.remotePath"
                          type="text"
                          :disabled="!ms.enabled"
                          class="input-field text-xs flex-1 py-0.5"
                          placeholder="/opt/app/xxx" />
                      </div>

                      <!-- 上传后命令 -->
                      <div class="flex items-center gap-2">
                        <label class="text-xs text-[var(--muted-text)] w-14 flex-shrink-0">上传命令:</label>
                        <input
                          v-model="ms.postUploadCommand"
                          type="text"
                          :disabled="!ms.enabled"
                          class="input-field text-xs flex-1 py-0.5"
                          placeholder="chmod -R 755 /opt/app/xxx" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 通用：部署后命令和日志命令（微服务模式下也显示） -->
            <div v-if="backendArchitecture === 'microservice'" class="space-y-4 mt-4 pt-4 border-t border-[var(--card-border)]">
              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  通用部署后命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <textarea v-model="form.backend.postUploadCommand" class="input-field h-20 resize-none"
                  placeholder="所有微服务部署后执行的命令，如服务重启等"></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                  日志命令 <span class="text-[var(--muted-text)]">(可选)</span>
                </label>
                <input v-model="form.backend.logCommand" type="text" class="input-field"
                  placeholder="tail -f /var/log/server/app.log" />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4 flex-shrink-0">
            <button type="button" @click="saveConfig" class="btn-primary flex-1 text-sm">
              {{ isEditing ? '更新配置' : '保存配置' }}
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
import { Plus, Trash2, Server, Eye, EyeOff, Wifi, Download, Upload, Package, Cpu, AlertTriangle, Search } from 'lucide-vue-next';
import { showSuccess, showError } from '../utils/notification';
import type { ServerConfig, DeployTargetConfig, BuildConfig, ConnectionTestResult, MicroserviceConfig, BackendConfig } from '../../shared/types';
import { useServerStore } from '../stores/server';
import { toSerializableConfig } from '../utils/config';

// 微服务相关状态
const backendRootPath = ref('');
const isScanningMaven = ref(false);
const mavenInstalled = ref(false);
const mavenVersion = ref<string | null>(null);
const scannedMicroservices = ref<MicroserviceConfig[]>([]);
const microserviceCount = computed(() => scannedMicroservices.value.length);
const mavenPath = ref('');
const javaPath = ref('');

// 全选/取消全选
const allMicroservicesSelected = computed(() =>
  scannedMicroservices.value.length > 0 && scannedMicroservices.value.every(ms => ms.enabled)
);

const someMicroservicesSelected = computed(() =>
  scannedMicroservices.value.some(ms => ms.enabled) && !allMicroservicesSelected.value
);

function toggleSelectAllMicroservices() {
  const allEnabled = allMicroservicesSelected.value;
  scannedMicroservices.value.forEach(ms => {
    ms.enabled = !allEnabled;
  });
}

function clearAllMicroservices() {
  scannedMicroservices.value.forEach(ms => {
    ms.enabled = false;
  });
}

// 后端架构选择
const backendArchitecture = ref<'single' | 'microservice'>('microservice');

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
      buildConfig: server.buildConfig?.type === 'backend' ? server.buildConfig : undefined,
      microservices: (server.backend as any)?.microservices || [],
      rootPath: (server.backend as any)?.rootPath || '',
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
      const backendConfig: BackendConfig = {
        type: 'backend',
        remotePath: migrated.backend.remotePath || '',
        postUploadCommand: migrated.backend.postUploadCommand || '',
        logCommand: migrated.backend.logCommand || '',
        enabled: migrated.backend.enabled || false,
        buildConfig: migrated.backend.buildConfig || createDefaultBuildConfig('backend'),
        microservices: (migrated.backend as any).microservices || [],
        rootPath: (migrated.backend as any).rootPath || '',
      };
      form.backend = backendConfig;

      // 判断后端架构类型
      const hasMicroservices = (migrated.backend as any).microservices?.length > 0;
      backendArchitecture.value = hasMicroservices ? 'microservice' : 'single';

      // 如果是微服务架构，加载微服务数据
      if (hasMicroservices) {
        backendRootPath.value = (migrated.backend as any).rootPath || '';
        scannedMicroservices.value = (migrated.backend as any).microservices || [];
        mavenPath.value = (migrated.backend as any).mavenPath || '';
        javaPath.value = (migrated.backend as any).javaPath || '';
      }
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
  backendArchitecture.value = 'microservice';
  backendRootPath.value = '';
  scannedMicroservices.value = [];
  mavenPath.value = '';
  javaPath.value = '';
}

async function saveConfig() {
  console.log('保存配置，表单数据:', form);

  // 基本验证，确保关键字段不为空
  if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
    showError('操作失败', '服务器名称、主机地址和用户名不能为空');
    return;
  }

  // 根据架构类型构建backend配置
  const backendConfig: BackendConfig = {
    type: 'backend',
    remotePath: form.backend.remotePath || '',
    postUploadCommand: form.backend.postUploadCommand || '',
    logCommand: form.backend.logCommand || '',
    enabled: form.backend.enabled || false,
    buildConfig: form.backend.buildConfig,
    // 微服务架构专用字段
    microservices: backendArchitecture.value === 'microservice' ? scannedMicroservices.value : [],
    rootPath: backendArchitecture.value === 'microservice' ? backendRootPath.value : '',
    mavenPath: backendArchitecture.value === 'microservice' ? mavenPath.value : undefined,
    javaPath: backendArchitecture.value === 'microservice' ? javaPath.value : undefined,
  };

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
    backend: backendConfig
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

// 选择后端根目录
async function selectBackendRootPath() {
  try {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      backendRootPath.value = folderPath;
      // 同时更新后端构建配置的项目路径
      form.backend.buildConfig!.localPath = folderPath;
    }
  } catch (error: any) {
    console.error('选择文件夹失败:', error);
    showError('选择失败', error.message || '选择文件夹失败');
  }
}

// 选择 Maven 路径
async function selectMavenPath() {
  try {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      mavenPath.value = folderPath;
      // 选择后自动重新检测 Maven
      await checkMavenInstalled();
    }
  } catch (error: any) {
    console.error('选择文件夹失败:', error);
    showError('选择失败', error.message || '选择文件夹失败');
  }
}

// 选择 Java 路径
async function selectJavaPath() {
  try {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      javaPath.value = folderPath;
    }
  } catch (error: any) {
    console.error('选择文件夹失败:', error);
    showError('选择失败', error.message || '选择文件夹失败');
  }
}

// 检测Maven是否安装
async function checkMavenInstalled() {
  try {
    const result = await window.electronAPI.checkMavenInstalled(mavenPath.value || undefined);
    mavenInstalled.value = result.installed;
    mavenVersion.value = result.version;
  } catch {
    mavenInstalled.value = false;
  }
}

// 扫描微服务
async function scanMicroservices() {
  if (!backendRootPath.value) {
    showError('扫描失败', '请先配置后端根目录');
    return;
  }

  isScanningMaven.value = true;
  try {
    const result = await window.electronAPI.scanMicroservices(backendRootPath.value);
    if (result.success) {
      scannedMicroservices.value = result.data || [];
      if (scannedMicroservices.value.length === 0) {
        showError('扫描结果', '未在指定目录下找到Maven模块');
      } else {
        showSuccess('扫描成功', `找到 ${scannedMicroservices.value.length} 个微服务`);

        // 如果是编辑模式，自动保存微服务配置
        if (form.id && scannedMicroservices.value.length > 0) {
          // 将响应式对象转换为普通对象，避免 Electron IPC 克隆失败
          const backendConfig = {
            microservices: JSON.parse(JSON.stringify(scannedMicroservices.value)),
            rootPath: backendRootPath.value,
          };
          await window.electronAPI.saveMicroserviceConfig(form.id, backendConfig);
        }
      }
    } else {
      showError('扫描失败', result.error || '扫描微服务失败');
    }
  } catch (error: any) {
    showError('扫描失败', error.message || '扫描微服务失败');
  } finally {
    isScanningMaven.value = false;
  }
}

onMounted(async () => {
  await loadServers();
  await checkMavenInstalled();
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