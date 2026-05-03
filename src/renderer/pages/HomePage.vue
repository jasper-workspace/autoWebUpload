<template>
  <div class="flex flex-col h-full mx-auto max-w-7xl">
    <div class="grid flex-1 min-h-0 grid-cols-1 gap-4 md:grid-cols-12">
      <!-- 左侧：配置区域（占4份） -->
      <div class="flex flex-col min-h-0 col-span-1 md:col-span-4">
        <div class="flex flex-col h-full p-4 card">
          <!-- 部署类型 -->
          <div class="mb-4">
            <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
              部署类型
            </h2>
            <div class="flex gap-3 mt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="deployType"
                  type="radio"
                  value="frontend"
                  class="accent-[#409EFF]" />
                <span class="text-[var(--foreground)]">前端</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="deployType"
                  type="radio"
                  value="backend"
                  class="accent-[#409EFF]" />
                <span class="text-[var(--foreground)]">后端</span>
              </label>
            </div>
          </div>

          <!-- 后端架构选择（当选择后端时显示） -->
          <div v-if="deployType === 'backend'" class="mb-4">
            <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
              后端架构
            </h2>
            <div class="flex gap-3 mt-2">
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
          </div>

          <!-- 一键部署按钮 -->
          <div
            v-if="canOneClickDeploy"
            class="mb-4">
            <!-- 后端微服务部署面板（当选择后端+微服务架构时显示） -->
            <div v-if="deployType === 'backend' && backendArchitecture === 'microservice'" class="backend-deploy-panel">
              <!-- 微服务列表 - 自定义多选下拉 -->
              <div class="mb-3 relative ms-dropdown-container">
                <label class="block text-xs text-[var(--muted-text)] mb-2">
                  微服务 <span class="text-[10px]">({{ enabledMicroserviceCount }}/{{ enabledMicroservicesList.length }})</span>
                </label>
                <div
                  @click="toggleMsDropdown"
                  class="input-field text-sm w-full min-h-[38px] flex items-center justify-between cursor-pointer">
                  <span class="text-[var(--muted-text)]" v-if="enabledMicroserviceCount === 0">请选择微服务...</span>
                  <span v-else class="truncate">{{ getSelectedMsNames() }}</span>
                  <svg class="w-4 h-4 text-[var(--muted-text)]" :class="{ 'rotate-180': msDropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <!-- 下拉选项 -->
                <div v-if="msDropdownOpen" class="absolute z-50 w-full mt-1 bg-[var(--dialog-bg)] border border-[var(--card-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <!-- 全选/全不选 -->
                  <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)]">
                    <label class="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        :checked="selectedMicroserviceIds.length === enabledMicroservicesList.length && enabledMicroservicesList.length > 0"
                        :indeterminate="selectedMicroserviceIds.length > 0 && selectedMicroserviceIds.length < enabledMicroservicesList.length"
                        @change="toggleSelectAll"
                        class="accent-[#409EFF]" />
                      <span>全选</span>
                    </label>
                    <button
                      v-if="selectedMicroserviceIds.length > 0"
                      @click="clearAllSelection"
                      class="text-xs text-[#409EFF] hover:text-[#409EFF]/80">
                      清空
                    </button>
                  </div>
                  <!-- 微服务列表 -->
                  <label
                    v-for="ms in enabledMicroservicesList"
                    :key="ms.id"
                    class="flex items-center gap-2 px-3 py-2 hover:bg-[var(--card-border)] cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      :checked="selectedMicroserviceIds.includes(ms.id)"
                      @change="toggleMsSelection(ms.id)"
                      class="accent-[#409EFF]" />
                    <span>{{ ms.name }} ({{ ms.artifactId }})</span>
                  </label>
                </div>
              </div>

              <!-- 微服务统计 -->
              <div class="flex justify-between items-center text-xs text-[var(--muted-text)] mb-3">
                <span>已选: {{ enabledMicroserviceCount }} / {{ enabledMicroservicesList.length }}</span>
                <span>jar包来源: target/ 目录</span>
              </div>

              <!-- 一键部署全部按钮 -->
              <button
                @click="handleDeployAll"
                :disabled="isDeployingRef || enabledMicroserviceCount === 0"
                class="btn-oneclick w-full"
                :class="isDeployingRef ? 'deploying' : ''">
                <Zap class="w-5 h-5" />
                <span class="btn-text">
                  {{ isDeployingRef ? '部署中...' : `一键部署 (${enabledMicroserviceCount})` }}
                </span>
              </button>
            </div>

            <!-- 后端单体一键部署按钮（当选择后端+单体架构时显示） -->
            <div v-else-if="deployType === 'backend' && backendArchitecture === 'single'" class="backend-single-deploy-panel">
              <div class="flex items-center gap-2 mb-3 text-xs text-[var(--muted-text)]">
                <Package class="w-4 h-4" />
                <span>单项目部署模式</span>
              </div>

              <!-- 一键部署按钮 -->
              <button
                @click="handleOneClickDeploy"
                :disabled="isDeployingRef || !selectedServer"
                class="btn-oneclick w-full"
                :class="isDeployingRef ? 'deploying' : ''">
                <Zap class="w-5 h-5" />
                <span class="btn-text">
                  {{ isDeployingRef ? '部署中' : '一键部署后端' }}
                </span>
              </button>
            </div>

            <!-- 前端一键部署按钮 -->
            <button
              v-else
              @click="handleOneClickDeploy"
              :disabled="isDeployingRef || !selectedServer"
              class="btn-oneclick w-full"
              :class="isDeployingRef ? 'deploying' : ''">
              <Zap class="w-5 h-5" />
              <span class="btn-text">
                {{
                  isDeployingRef
                    ? `${deployType === "frontend" ? "前端" : "后端"}部署中`
                    : `一键部署${deployType === "frontend" ? "前端" : "后端"}`
                }}
              </span>
            </button>

            <!-- 取消部署按钮 -->
            <button
              v-if="isDeployingRef"
              @click="handleCancelDeploy"
              class="flex items-center justify-center w-full gap-2 mt-4 text-sm btn-danger">
              <X class="w-4 h-4" />
              取消部署
            </button>

            <!-- 部署进度展示 -->
            <div
              v-if="isDeployingRef"
              class="mt-4">
              <h3 class="text-sm font-semibold text-[var(--foreground)] mb-2">
                <span v-if="deployProgress?.phase === 'completed'">部署完成</span>
                <span v-else>部署进度</span>
              </h3>
            <div class="mb-2">
              <div
                class="flex justify-between text-xs text-[var(--muted-text)] mb-1">
                <span>
                  <span v-if="deployProgress?.phase === 'completed'"
                    >部署完成</span
                  >
                  <span v-else-if="deployProgress?.phase === 'uploading'"
                    >[{{
                      deployType === "frontend" ? "前端" : "后端"
                    }}]上传中</span
                  >
                  <span v-else-if="deployProgress?.phase === 'deploying'"
                    >[{{
                      deployType === "frontend" ? "前端" : "后端"
                    }}]部署中</span
                  >
                  <span v-else
                    >[{{
                      deployType === "frontend" ? "前端" : "后端"
                    }}]构建中</span
                  >
                </span>
                <span
                  :class="{
                    'text-green-400': deployProgress?.status === 'success',
                    'text-red-400': deployProgress?.status === 'error',
                    'text-blue-400': deployProgress?.status === 'building',
                  }">
                  {{
                    deployProgress?.status === "building"
                      ? (deployProgress?.percentage || 0) + "%"
                      : getStatusLabel(deployProgress?.status || "building")
                  }}
                </span>
              </div>
              <div class="w-full bg-[var(--card-border)] rounded-full h-2">
                <div
                  class="h-2 transition-all duration-300 rounded-full"
                  :class="{
                    'bg-green-500': deployProgress?.status === 'success',
                    'bg-red-500': deployProgress?.status === 'error',
                    'bg-blue-500': deployProgress?.status === 'building',
                  }"
                  :style="{
                    width: (deployProgress?.percentage || 0) + '%',
                  }"></div>
              </div>
            </div>
          </div>
          </div>

          <!-- 手动上传选项（可折叠） -->
          <div class="mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="showManualUpload"
                type="checkbox"
                class="accent-[#409EFF]" />
              <span class="text-sm text-[var(--foreground)]">手动上传</span>
            </label>
          </div>

          <!-- 手动上传折叠区域 -->
          <div v-show="showManualUpload" class="collapse-section">
            <!-- 后端微服务模式下：选择要上传的微服务 -->
            <div v-if="deployType === 'backend' && backendArchitecture === 'microservice'" class="mb-4">
              <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
                选择微服务
              </h2>
              <select
                v-model="selectedUploadMicroserviceId"
                class="input-field w-full"
                :disabled="uploading">
                <option value="">-- 选择微服务 --</option>
                <option
                  v-for="ms in microservices"
                  :key="ms.id"
                  :value="ms.id">
                  {{ ms.name }} ({{ ms.artifactId }})
                </option>
              </select>
            </div>

            <!-- 远程目标路径 -->
            <div class="mb-4">
              <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
                远程目标路径
              </h2>
              <input
                v-model="remotePath"
                :disabled="true"
                type="text"
                class="w-full input-field"
                :placeholder="deployType === 'backend' && backendArchitecture === 'microservice' && !selectedUploadMicroserviceId ? '请先选择微服务' : '选择服务器后自动填写'" />
            </div>

            <!-- 显示所选微服务的上传后命令 -->
            <div v-if="deployType === 'backend' && backendArchitecture === 'microservice' && selectedUploadMicroserviceId" class="mb-4">
              <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
                上传后命令
              </h2>
              <div class="text-xs text-[var(--muted-text)] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-3 min-h-[40px]">
                {{ getSelectedMsPostCommand() || '（无）' }}
              </div>
            </div>

            <!-- 文件夹选择 -->
            <div class="mb-4">
              <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
                本地文件夹
              </h2>
              <DropZone
                v-model="localPath"
                :disabled="uploading"
                :deployType="deployType"
                @folder-error="handleFolderError" />
            </div>

            <!-- 操作按钮 -->
            <div class="flex flex-col gap-3">
              <button
                @click="startUpload"
                :disabled="!canUpload"
                class="flex items-center justify-center w-full gap-2 text-sm btn-primary">
                <Upload class="w-4 h-4" />
                {{ uploading ? "上传中..." : "开始上传" }}
              </button>
              <button
                v-if="uploading"
                @click="cancelUpload"
                class="flex items-center justify-center w-full gap-2 text-sm btn-danger">
                <X class="w-4 h-4" />
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：操作日志（占8份） -->
      <div class="flex flex-col min-h-0 col-span-1 md:col-span-8">
        <div class="flex flex-col flex-1 min-h-0 p-5 card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-[var(--foreground)]">
              操作日志
            </h2>
            <button
              @click="clearLogs"
              class="text-sm text-[var(--foreground)] bg-[var(--card-border)] hover:bg-[var(--scrollbar-thumb-hover)] transition-colors px-3 py-1 border border-[var(--card-border)] rounded">
              清空日志
            </button>
          </div>

          <!-- 日志输出 -->
          <div
            ref="logContainer"
            @scroll="handleScroll"
            class="bg-[var(--log-bg)] rounded-lg p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1 border border-[var(--card-border)]">
            <div
              v-for="(log, index) in logs"
              :key="index"
              :class="{
                'text-green-400': log.type === 'success',
                'text-red-400': log.type === 'error',
                'text-yellow-400': log.type === 'warning',
                'text-blue-400': log.type === 'info',
                'text-[var(--foreground)]': !log.type,
              }">
              [{{ log.time }}] {{ log.message }}
            </div>
            <div v-if="logs.length === 0" class="text-[var(--muted-text)]">
              暂无日志
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  onActivated,
  watch,
} from "vue";
import { Upload, FolderOpen, X, Zap, Package } from "lucide-vue-next";
import { useServerStore } from "../stores/server";
import { useUploadStore } from "../stores/upload";
import DropZone from "../components/DropZone.vue";
import { showWarning, showError } from "../utils/notification";
import type { UploadProgress, MicroserviceConfig, MicroserviceBuildProgress } from "../../shared/types";
import { toSerializableConfig } from "../utils/config";
import { useDeploy } from "../composables/useDeploy";
import { useMicroservice } from "../composables/useMicroservice";
import type { BuildProgress } from "../../shared/types";

const serverStore = useServerStore();
const uploadStore = useUploadStore();

// 一键部署
const { isDeploying: deployIsDeploying, deployProgress, startDeploy, cancelDeploy } = useDeploy();

// 微服务部署
const {
  microservices,
  selectedCommand,
  buildProgressMap,
  mavenInstalled,
  mavenVersion,
  toggleMicroservice,
  deployAllMicroservices,
  loadMicroservices,
  checkMaven,
  isDeploying: msIsDeploying,
} = useMicroservice();

// 合并 isDeployingRef（微服务部署或单体部署中任意一个为true就显示部署状态）
const isDeployingRef = computed(() => deployIsDeploying.value || msIsDeploying.value);

// 后端架构选择
const backendArchitecture = ref<'single' | 'microservice'>('microservice');

// 手动上传时选择的微服务ID
const selectedUploadMicroserviceId = ref('');

// 多选微服务列表
const selectedMicroserviceIds = ref<string[]>([]);

// 微服务下拉是否展开
const msDropdownOpen = ref(false);

// 启用的微服务列表（仅 enabled: true）
const enabledMicroservicesList = computed(() => {
  const list = microservices.value.filter(ms => ms.enabled);
  console.log('[HomePage] enabledMicroservicesList computed:', list.length, 'microservices:', microservices.value.map(ms => ({ id: ms.id, name: ms.name, enabled: ms.enabled })));
  return list;
});

// 启用的微服务数量（基于多选列表）
const enabledMicroserviceCount = computed(() => {
  return selectedMicroserviceIds.value.length;
});

// 切换微服务下拉展开/收起
function toggleMsDropdown() {
  msDropdownOpen.value = !msDropdownOpen.value;
}

// 切换微服务选中状态
function toggleMsSelection(msId: string) {
  const index = selectedMicroserviceIds.value.indexOf(msId);
  if (index === -1) {
    selectedMicroserviceIds.value.push(msId);
  } else {
    selectedMicroserviceIds.value.splice(index, 1);
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedMicroserviceIds.value.length === enabledMicroservicesList.value.length) {
    // 已全选，取消全选
    selectedMicroserviceIds.value = [];
  } else {
    // 未全选，执行全选
    selectedMicroserviceIds.value = enabledMicroservicesList.value.map(ms => ms.id);
  }
}

// 清空所有选择
function clearAllSelection() {
  selectedMicroserviceIds.value = [];
}

// 获取已选微服务的显示名称
function getSelectedMsNames(): string {
  if (selectedMicroserviceIds.value.length === 0) return '';
  const names = selectedMicroserviceIds.value.map(id => {
    const ms = microservices.value.find(m => m.id === id);
    return ms ? ms.name : '';
  }).filter(Boolean);
  return names.join(', ');
}

const deployType = computed({
  get: () => uploadStore.deployType,
  set: (value: "frontend" | "backend") => {
    uploadStore.deployType = value;
  },
});
const showManualUpload = ref(false); // 默认隐藏手动上传选项
const uploading = computed(() => uploadStore.uploading);
const progress = computed(() => uploadStore.progress);
const logs = computed(() => uploadStore.logs);
const logContainer = ref<HTMLElement | null>(null); // 使用本地引用，保持自动滚动
const localPath = computed({
  get: () => uploadStore.localPath,
  set: (value: string) => {
    uploadStore.localPath = value;
  },
});
const remotePath = computed({
  get: () => uploadStore.remotePath,
  set: (value: string) => {
    uploadStore.remotePath = value;
  },
});

const selectedServer = computed(() => serverStore.selectedServer);

// 当前部署类型的配置
const currentDeployConfig = computed(() => {
  if (!selectedServer.value) return null;
  return deployType.value === "frontend"
    ? selectedServer.value.frontend
    : selectedServer.value.backend;
});

// 一键部署是否可用（根据架构模式判断）
const canOneClickDeploy = computed(() => {
  // 必须先选中服务器
  if (!selectedServer.value) return false;

  // 后端微服务模式：有微服务列表就显示（即使为空也会显示下拉框）
  if (deployType.value === 'backend' && backendArchitecture.value === 'microservice') {
    return true;
  }

  // 后端单体模式或前端模式：只要选中了服务器就显示按钮
  // （配置验证在点击时进行）
  return true;
});

// 监听微服务下拉展开状态，点击外部时关闭
watch(msDropdownOpen, (isOpen) => {
  if (isOpen) {
    const closeDropdown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.ms-dropdown-container')) {
        msDropdownOpen.value = false;
        document.removeEventListener('click', closeDropdown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
  }
});

// 监听部署类型切换，重置手动上传选项，再根据一键部署能力控制
watch(
  deployType,
  (type) => {
    // 切换时先重置为 false
    showManualUpload.value = false;
    // 前端模式不使用微服务架构，重置为 single
    if (type === 'frontend') {
      backendArchitecture.value = 'single';
    }
    // 切换到后端时，加载微服务列表
    if (type === 'backend') {
      loadBackendMicroservices();
    }
  },
  { immediate: true },
);

// 监听后端架构切换，当切换到微服务架构时加载微服务列表
watch(
  backendArchitecture,
  (arch) => {
    if (arch === 'microservice' && selectedServer.value) {
      loadBackendMicroservices();
    }
  },
  { immediate: true },
);

// 监听选中的服务器，加载微服务列表
watch(
  selectedServer,
  (server) => {
    if (server && deployType.value === 'backend' && backendArchitecture.value === 'microservice') {
      loadBackendMicroservices();
    }
  },
  { immediate: true },
);

const canUpload = computed(
  () =>
    selectedServer.value &&
    localPath.value &&
    remotePath.value &&
    !uploading.value,
);

const isUserScrolling = ref(false);
let scrollTimeout: NodeJS.Timeout | null = null;
let lastDeployPhase = "";
let lastBuildOutputLength = 0;
let lastLoggedStatus = ""; // 上次打印的状态，用于防重

// 监听部署进度变化，同步到操作日志
watch(
  deployProgress,
  (progress) => {
    if (!progress) return;

    // 防重：如果状态和步骤都与上次相同，则不重复打印
    const progressKey = `${progress.status}:${progress.step}`;
    if (progressKey === lastLoggedStatus) return;

    // 错误状态处理
    if (progress.status === "error") {
      lastLoggedStatus = progressKey;
      addLog(`构建失败: ${progress.step}`, "error");
      return;
    }

    // 成功状态处理
    if (progress.status === "success") {
      lastLoggedStatus = progressKey;
      addLog(`构建完成`, "success");
      return;
    }

    // 进行中状态
    if (!deployIsDeploying.value) return;

    // 构建阶段的输出实时打印（只打印新增的内容）
    if (progress.phase === "building" && progress.output) {
      if (progress.output.length > lastBuildOutputLength) {
        const newOutput = progress.output.substring(lastBuildOutputLength);
        lastBuildOutputLength = progress.output.length;
        // 按行分割，只打印新增的行
        const newLines = newOutput
          .split("\n")
          .filter((line: string) => {
            if (!line.trim()) return false;
            // 跳过包含错误关键词的行，这些由 error 状态单独处理
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('error') || lowerLine.includes('failed') ||
                lowerLine.includes('fail to') || lowerLine.includes('上传失败')) {
              return false;
            }
            return true;
          });
        if (newLines.length > 0) {
          addLog(newLines.join("\n"));
        }
      }
      return;
    }

    // 阶段变化时打印阶段信息
    if (progress.phase !== lastDeployPhase) {
      lastDeployPhase = progress.phase;
      const phaseLabel = getPhaseLabel(progress.phase);
      addLog(`${phaseLabel}: ${progress.step}`);

      // 切换到其他阶段时重置 output 长度
      lastBuildOutputLength = 0;
    }
  },
  { deep: true }
);

// 记录上一个已处理的微服务进度（用于防重）
let lastMicroserviceProgressKeys: Record<string, string> = {};

// 监听微服务部署进度变化，同步到操作日志
watch(
  buildProgressMap,
  (progressMap) => {
    if (!msIsDeploying.value) return;

    // 遍历所有微服务的进度
    for (const [msId, progress] of Object.entries(progressMap)) {
      if (!progress) continue;

      // 防重：检查是否与上次相同
      const progressKey = `${progress.phase}:${progress.percentage}:${progress.output}`;
      if (lastMicroserviceProgressKeys[msId] === progressKey) continue;
      lastMicroserviceProgressKeys[msId] = progressKey;

      // 根据阶段打印日志
      switch (progress.phase) {
        case 'pending':
          addLog(`[${progress.microserviceName}] 等待部署...`);
          break;

        case 'uploading':
          if (progress.output && progress.output.includes('开始上传')) {
            addLog(`[${progress.microserviceName}] ${progress.output}`);
          } else if (progress.output && progress.output.includes('已上传')) {
            addLog(`[${progress.microserviceName}] ${progress.output}`);
          }
          break;

        case 'deploying':
          addLog(`[${progress.microserviceName}] ${progress.output}`);
          break;

        case 'completed':
          addLog(`[${progress.microserviceName}] 部署完成`, 'success');
          break;

        case 'error':
          addLog(`[${progress.microserviceName}] 部署失败: ${progress.error}`, 'error');
          break;

        case 'building':
          // 构建阶段（已跳过，但保留日志）
          if (progress.output) {
            addLog(`[${progress.microserviceName}] ${progress.output}`);
          }
          break;
      }
    }
  },
  { deep: true }
);

// 监听服务器变化或部署类型变化，更新远程路径
watch(
  [selectedServer, deployType, backendArchitecture],
  ([server, type, arch]) => {
    // 重置选择的微服务
    selectedUploadMicroserviceId.value = '';

    if (!server) {
      uploadStore.remotePath = "";
      return;
    }

    // 微服务模式下，远程路径由用户选择微服务后决定
    if (type === "backend" && arch === "microservice") {
      uploadStore.remotePath = "";
      return;
    }

    // 前端或后端单体模式
    const targetConfig = type === "frontend" ? server.frontend : server.backend;
    uploadStore.remotePath = targetConfig?.remotePath || "";
  },
  { immediate: true },
);

// 监听选择的微服务变化，更新远程路径（微服务模式下）
watch(selectedUploadMicroserviceId, (msId) => {
  if (!msId) {
    uploadStore.remotePath = "";
    return;
  }

  const ms = microservices.value.find(m => m.id === msId);
  if (ms) {
    uploadStore.remotePath = ms.remotePath;
  }
});

// 添加日志
function addLog(message: string, type?: string) {
  uploadStore.addLog(message, type);

  nextTick(() => {
    if (logContainer.value) {
      // 只有在用户没有滚动时才自动滚动到底部
      if (!isUserScrolling.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    }
  });
}

// 处理滚动事件
function handleScroll() {
  if (!logContainer.value) return;

  const container = logContainer.value;
  const isAtBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 50;

  // 如果用户向上滚动，标记为用户正在滚动
  if (!isAtBottom) {
    isUserScrolling.value = true;

    // 清除之前的超时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // 设置新的超时，如果用户停止滚动2秒，则恢复自动滚动
    scrollTimeout = setTimeout(() => {
      isUserScrolling.value = false;
    }, 2000);
  } else {
    // 如果用户滚动到底部，恢复自动滚动
    isUserScrolling.value = false;
  }
}

// 处理文件夹错误
function handleFolderError(message: string) {
  uploadStore.addLog(message, "error");
  showError("文件选择错误", message);
}

// 验证服务器选择
function validateServerSelection(): boolean {
  if (!selectedServer.value) {
    showWarning("请选择服务器", "请先在顶部选择要上传的目标服务器");
    return false;
  }
  return true;
}

// 验证部署类型
function validateDeployType(): boolean {
  if (!deployType) {
    showWarning("请选择部署类型", "请选择前端或后端部署类型");
    return false;
  }

  // 检查文件/文件夹名称是否与部署类型匹配
  const folderName = localPath.value.split("\\").pop()?.split("/").pop() || "";
  const isFrontend = deployType.value === "frontend";

  // 只有当文件夹名称不为空时才进行匹配检查
  if (folderName) {
    let folderMatchesType = false;

    if (isFrontend) {
      // 前端：检查是否为dist目录或包含front
      folderMatchesType =
        folderName.toLowerCase() === "dist" ||
        folderName.toLowerCase().includes("front");
    } else {
      // 后端：检查是否为.jar文件或包含back
      folderMatchesType =
        folderName.toLowerCase().endsWith(".jar") ||
        folderName.toLowerCase().includes("back");
    }

    if (!folderMatchesType) {
      const deployTypeName = isFrontend ? "前端" : "后端";
      const expectedType = isFrontend ? "dist目录" : ".jar文件";
      showWarning(
        "部署类型不匹配",
        `您选择的文件可能与${deployTypeName}部署不匹配，请选择正确的${expectedType}`,
      );
    }
  }

  return true;
}

// 开始上传
async function startUpload() {
  // 上传前校验
  if (!validateServerSelection()) return;
  if (!validateDeployType()) return;
  if (!localPath.value || !remotePath.value) return;

  uploadStore.uploading = true;
  uploadStore.progress = {
    totalFiles: 0,
    uploadedFiles: 0,
    currentFile: "",
    percentage: 0,
    status: "uploading",
  };
  uploadStore.progressLogIndex = null;

  addLog(`开始上传文件...`, "info");
  addLog(`本地路径: ${localPath.value}`, "info");
  addLog(`远程路径: ${remotePath.value}`, "info");

  try {
    // 验证服务器配置完整性
    if (
      !selectedServer.value?.id ||
      !selectedServer.value?.host ||
      !selectedServer.value?.username
    ) {
      showError("配置错误", "服务器配置不完整，请检查服务器设置");
      uploadStore.uploading = false;
      return;
    }

    // 验证远程路径
    if (!remotePath.value) {
      showError("配置错误", "远程路径不能为空");
      uploadStore.uploading = false;
      return;
    }

    // 获取上传后命令（微服务模式下使用所选微服务的命令，否则使用服务器通用命令）
    let postUploadCmd = '';
    if (deployType.value === 'backend' && backendArchitecture.value === 'microservice' && selectedUploadMicroserviceId.value) {
      const selectedMs = microservices.value.find(ms => ms.id === selectedUploadMicroserviceId.value);
      postUploadCmd = selectedMs?.postUploadCommand || '';
    }

    // 创建可序列化的配置对象
    const serializableConfig = toSerializableConfig(selectedServer.value);
    const uploadConfig = JSON.parse(
      JSON.stringify({
        ...serializableConfig,
        remotePath: remotePath.value,
        postUploadCommand: postUploadCmd,
      }),
    );

    // 将上传配置存储到全局变量，供全局监听器使用
    window.currentUploadConfig = uploadConfig;

    // 监听进度
    // 进度监听已在 onMounted 中设置为全局监听器，这里不需要重复设置

    // 开始上传
    await window.electronAPI.uploadFolder(uploadConfig, localPath.value);
  } catch (error: any) {
    console.error("上传配置错误:", error);
    addLog(`上传失败: ${error.message || "未知错误"}`, "error");
    // showError('上传失败', error.message || '上传过程中发生未知错误');
  } finally {
    uploadStore.uploading = false;
    // 不移除监听器，保持全局监听以便页面切换时仍能接收进度
    // 清理全局上传配置
    window.currentUploadConfig = null;
  }
}

// 取消上传
async function cancelUpload() {
  try {
    await window.electronAPI.cancelUpload();
    addLog("上传已取消", "warning");
    uploadStore.uploading = false;
  } catch (error) {
    console.error("取消上传失败:", error);
  }
}

// 清空日志
function clearLogs() {
  uploadStore.logs = [];
}

// 获取所选微服务的上传后命令
function getSelectedMsPostCommand(): string {
  if (!selectedUploadMicroserviceId.value) return '';
  const ms = microservices.value.find(m => m.id === selectedUploadMicroserviceId.value);
  return ms?.postUploadCommand || '';
}

// 获取阶段标签
function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    building: "构建中",
    uploading: "文件上传",
    deploying: "远程部署",
    completed: "部署完成",
  };
  return labels[phase] || phase;
}

// 获取状态标签
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    building: "进行中",
    success: "成功",
    error: "失败",
    canceled: "已取消",
  };
  return labels[status] || status;
}

// 一键部署处理
async function handleOneClickDeploy() {
  if (!selectedServer.value) {
    showWarning("请选择服务器", "请先在顶部选择要部署的目标服务器");
    return;
  }

  const targetConfig =
    deployType.value === "frontend"
      ? selectedServer.value.frontend
      : selectedServer.value.backend;

  if (
    !targetConfig?.buildConfig?.localPath ||
    !targetConfig?.buildConfig?.buildCommand
  ) {
    showWarning(
      "未配置构建",
      `请先在配置页面配置${deployType.value === "frontend" ? "前端" : "后端"}构建命令`,
    );
    return;
  }

  // 重置部署阶段状态
  lastDeployPhase = "";
  lastBuildOutputLength = 0;
  lastLoggedStatus = "";
  addLog(
    `开始一键部署${deployType.value === "frontend" ? "前端" : "后端"}...`,
    "info",
  );

  try {
    const result = await startDeploy(selectedServer.value.id, deployType.value);

    if (result.success) {
      addLog(
        `一键部署成功！总耗时: ${(result.totalDuration / 1000).toFixed(2)}秒`,
        "success",
      );
    } else {
      // 强制更新进度状态为失败
      deployProgress.value = {
        phase: "building",
        step: result.error || "部署失败",
        percentage: 0,
        status: "error",
      };
      addLog(`一键部署失败: ${result.error}`, "error");
    }
  } catch (error: any) {
    // 强制更新进度状态为失败
    deployProgress.value = {
      phase: "building",
      step: error.message || "未知错误",
      percentage: 0,
      status: "error",
    };
    console.error("一键部署失败:", error);
    addLog(`一键部署失败: ${error.message || "未知错误"}`, "error");
  }
}

// 取消部署
function handleCancelDeploy() {
  cancelDeploy();
  addLog("部署已取消", "warning");
}

// ==================== 微服务部署相关方法 ====================

// 切换微服务启用状态
async function handleToggleMicroservice(microserviceId: string, enabled: boolean) {
  if (!selectedServer.value) return;

  try {
    await toggleMicroservice(selectedServer.value.id, microserviceId, enabled);
  } catch (error) {
    console.error('切换微服务状态失败:', error);
  }
}

// 构建单个微服务
async function handleBuildOne(ms: MicroserviceConfig) {
  if (!selectedServer.value) {
    showWarning("请选择服务器", "请先在顶部选择要部署的目标服务器");
    return;
  }

  if (!ms.enabled) {
    showWarning("微服务未启用", "请先启用该微服务");
    return;
  }

  addLog(`开始构建微服务: ${ms.name}...`, "info");

  try {
    const result = await window.electronAPI.buildMicroservice(
      ms.localPath,
      selectedCommand.value,
      selectedCommand.value !== 'clean' && selectedCommand.value !== 'compile'
    );

    if (result.success) {
      addLog(`微服务 ${ms.name} 构建成功`, "success");
    } else {
      addLog(`微服务 ${ms.name} 构建失败: ${result.error}`, "error");
    }
  } catch (error: any) {
    addLog(`微服务 ${ms.name} 构建失败: ${error.message}`, "error");
  }
}

// 一键部署全部微服务
async function handleDeployAll() {
  if (!selectedServer.value) {
    showWarning("请选择服务器", "请先在顶部选择要部署的目标服务器");
    return;
  }

  if (enabledMicroserviceCount.value === 0) {
    showWarning("没有启用的微服务", "请至少启用一个微服务进行部署");
    return;
  }

  // 重置部署阶段状态
  lastDeployPhase = "";
  lastBuildOutputLength = 0;
  lastLoggedStatus = "";
  lastMicroserviceProgressKeys = {};
  addLog(`开始一键部署 ${enabledMicroserviceCount.value} 个微服务...`, "info");

  try {
    const result = await deployAllMicroservices(selectedServer.value.id, [...selectedMicroserviceIds.value]);

    if (result) {
      if (result.success) {
        addLog(
          `一键部署成功！成功: ${result.successCount}，失败: ${result.failedCount}，总耗时: ${(result.totalDuration / 1000).toFixed(2)}秒`,
          "success"
        );
      } else {
        addLog(
          `一键部署完成。成功: ${result.successCount}，失败: ${result.failedCount}`,
          result.failedCount > 0 ? "warning" : "success"
        );
      }
    }
  } catch (error: any) {
    addLog(`一键部署失败: ${error.message || "未知错误"}`, "error");
  }
}

// 加载微服务列表
async function loadBackendMicroservices() {
  console.log('[HomePage] loadBackendMicroservices called, selectedServer:', selectedServer.value?.name, selectedServer.value?.id);

  if (!selectedServer.value) {
    console.log('[HomePage] selectedServer is null, skip loading microservices');
    return;
  }

  try {
    console.log('[HomePage] calling loadMicroservices with serverId:', selectedServer.value.id);
    const result = await loadMicroservices(selectedServer.value.id);
    console.log('[HomePage] loadMicroservices returned, result:', result, 'microservices.value:', microservices.value);

    // 默认不选中任何微服务
    selectedMicroserviceIds.value = [];

    await checkMaven();
  } catch (error) {
    console.error('[HomePage] 加载微服务列表失败:', error);
  }
}

// 暴露方法给外部使用
defineExpose({
  isUploading: () => uploadStore.uploading,
  cancelUpload,
});

onMounted(() => {
  // 只在首次挂载时清空日志（如果日志为空）
  if (uploadStore.logs.length === 0) {
    uploadStore.logs = [];
  }

  // 注册全局方法供路由守卫使用
  if (typeof window !== "undefined") {
    window.isUploading = () => uploadStore.uploading;
    window.cancelUpload = cancelUpload;
  }

  // 设置全局上传进度监听器（只设置一次）
  if (!window.uploadProgressListenerSet) {
    window.electronAPI.onUploadProgress((data: any) => {
      // 使用 uploadStore 处理进度更新，并传入全局上传配置
      uploadStore.handleUploadProgress(data, window.currentUploadConfig);
    });
    window.uploadProgressListenerSet = true;
  }
});

onUnmounted(() => {
  // 清理超时
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
});

// 页面激活时检查并刷新配置
onActivated(async () => {
  // 刷新配置
  await serverStore.refreshIfNeeded();
  // 刷新后重新加载微服务列表（确保从配置文件读取最新数据）
  if (deployType.value === 'backend' && backendArchitecture.value === 'microservice') {
    loadBackendMicroservices();
  }
});
</script>
