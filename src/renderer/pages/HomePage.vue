<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
      <!-- 左侧：配置区域（占4份） -->
      <div class="col-span-1 md:col-span-4 flex flex-col min-h-0">
        <div class="card p-4 h-full flex flex-col">

          <!-- 部署类型 -->
          <div class="mb-4">
            <h2 class="text-sm mb-4 font-semibold text-[#E0E0E0]">
              部署类型
            </h2>
            <div class="flex gap-3 mt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="deployType"
                  type="radio"
                  value="frontend"
                  class="accent-[#409EFF]"
                />
                <span class="text-[#E0E0E0]">前端</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="deployType"
                  type="radio"
                  value="backend"
                  class="accent-[#409EFF]"
                />
                <span class="text-[#E0E0E0]">后端</span>
              </label>
            </div>
          </div>

          <!-- 远程目标路径 -->
          <div class="mb-4">
            <h2 class="text-sm mb-4 font-semibold text-[#E0E0E0]">
              远程目标路径
            </h2>
            <input
              v-model="remotePath"
              disabled
              type="text"
              class="input-field w-full"
              placeholder="选择服务器后自动填写"
            />
          </div>

          <!-- 文件夹选择 -->
          <div class="mb-4">
            <h2 class="text-sm mb-4 font-semibold text-[#E0E0E0]">
              本地文件夹
            </h2>
            <DropZone 
              v-model="localPath"
              :disabled="uploading"
              :deployType="deployType"
              @folder-error="handleFolderError"
            />
          </div>

          <!-- 操作按钮 -->
          <div class="flex flex-col gap-3">
            <button
              @click="startUpload"
              :disabled="!canUpload"
              class="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <Upload class="w-4 h-4" />
              {{ uploading ? "上传中..." : "开始上传" }}
            </button>
            <button
              v-if="uploading"
              @click="cancelUpload"
              class="btn-danger w-full flex items-center justify-center gap-2 text-sm"
            >
              <X class="w-4 h-4" />
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：操作日志（占8份） -->
      <div class="col-span-1 md:col-span-8 flex flex-col min-h-0">
        <div class="card p-5 flex-1 flex flex-col min-h-0">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-[#E0E0E0]">操作日志</h2>
            <button
              @click="clearLogs"
              class="text-sm text-[#E0E0E0] bg-[#3C3C3C] hover:bg-[#4C4C4C] transition-colors px-3 py-1 border border-[#5C5C5C] rounded"
            >
              清空日志
            </button>
          </div>

          <!-- 日志输出 -->
          <div
            ref="logContainer"
            @scroll="handleScroll"
            class="bg-[#0D0D0D] rounded-lg p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1 border border-[#3C3C3C]"
          >
            <div
              v-for="(log, index) in logs"
              :key="index"
              :class="{
                'text-green-400': log.type === 'success',
                'text-red-400': log.type === 'error',
                'text-blue-400': log.type === 'info',
                'text-[#E0E0E0]': !log.type,
              }"
            >
              [{{ log.time }}] {{ log.message }}
            </div>
            <div v-if="logs.length === 0" class="text-[#5C5C5C]">暂无日志</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, onActivated, watch } from "vue";
import { Upload, FolderOpen, X } from "lucide-vue-next";
import { useServerStore } from "../stores/server";
import { useUploadStore } from "../stores/upload";
import DropZone from "../components/DropZone.vue";
import { showWarning, showError } from "../utils/notification";
import type { UploadProgress } from "../../shared/types";
import { toSerializableConfig } from "../utils/config";

const serverStore = useServerStore();
const uploadStore = useUploadStore();

const deployType = computed({
  get: () => uploadStore.deployType,
  set: (value: 'frontend' | 'backend') => { uploadStore.deployType = value; }
});
const uploading = computed(() => uploadStore.uploading);
const progress = computed(() => uploadStore.progress);
const logs = computed(() => uploadStore.logs);
const logContainer = ref<HTMLElement | null>(null); // 使用本地引用，保持自动滚动
const localPath = computed({
  get: () => uploadStore.localPath,
  set: (value: string) => { uploadStore.localPath = value; }
});
const remotePath = computed({
  get: () => uploadStore.remotePath,
  set: (value: string) => { uploadStore.remotePath = value; }
});

const selectedServer = computed(() => serverStore.selectedServer);

const canUpload = computed(
  () =>
    selectedServer.value &&
    localPath.value &&
    remotePath.value &&
    !uploading.value
);

const isUserScrolling = ref(false);
let scrollTimeout: NodeJS.Timeout | null = null;

// 监听服务器变化或部署类型变化，更新远程路径
watch([selectedServer, deployType], ([server, type]) => {
  if (server) {
    uploadStore.remotePath = type === "frontend"
      ? server.frontendPath || server.remotePath || ""
      : server.backendPath || "";
  } else {
    uploadStore.remotePath = "";
  }
}, { immediate: true });

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
  const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
  
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
    showWarning('请选择服务器', '请先在顶部选择要上传的目标服务器');
    return false;
  }
  return true;
}

// 验证部署类型
function validateDeployType(): boolean {
  if (!deployType) {
    showWarning('请选择部署类型', '请选择前端或后端部署类型');
    return false;
  }
  
  // 检查文件/文件夹名称是否与部署类型匹配
  const folderName = localPath.value.split('\\').pop()?.split('/').pop() || '';
  const isFrontend = deployType.value === 'frontend';
  
  // 只有当文件夹名称不为空时才进行匹配检查
  if (folderName) {
    let folderMatchesType = false;
    
    if (isFrontend) {
      // 前端：检查是否为dist目录或包含front
      folderMatchesType = folderName.toLowerCase() === 'dist' || folderName.toLowerCase().includes('front');
    } else {
      // 后端：检查是否为.jar文件或包含back
      folderMatchesType = folderName.toLowerCase().endsWith('.jar') || folderName.toLowerCase().includes('back');
    }
      
    if (!folderMatchesType) {
      const deployTypeName = isFrontend ? '前端' : '后端';
      const expectedType = isFrontend ? 'dist目录' : '.jar文件';
      showWarning('部署类型不匹配', `您选择的文件可能与${deployTypeName}部署不匹配，请选择正确的${expectedType}`);
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
    if (!selectedServer.value?.id || !selectedServer.value?.host || !selectedServer.value?.username) {
      showError('配置错误', '服务器配置不完整，请检查服务器设置');
      uploadStore.uploading = false;
      return;
    }

    // 验证远程路径
    if (!remotePath.value) {
      showError('配置错误', '远程路径不能为空');
      uploadStore.uploading = false;
      return;
    }

    // 创建可序列化的配置对象
    const serializableConfig = toSerializableConfig(selectedServer.value);
    const uploadConfig = JSON.parse(JSON.stringify({
      ...serializableConfig,
      remotePath: remotePath.value,
      postUploadCommand: deployType.value === "frontend"
        ? selectedServer.value.frontendPostUploadCommand
        : selectedServer.value.backendPostUploadCommand,
    }));

    // 将上传配置存储到全局变量，供全局监听器使用
    window.currentUploadConfig = uploadConfig;

    // 监听进度
    // 进度监听已在 onMounted 中设置为全局监听器，这里不需要重复设置

    // 开始上传
    await window.electronAPI.uploadFolder(uploadConfig, localPath.value);
  } catch (error: any) {
    console.error('上传配置错误:', error);
    addLog(`上传失败: ${error.message || '未知错误'}`, "error");
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
  if (typeof window !== 'undefined') {
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
onActivated(() => {
  serverStore.refreshIfNeeded();
});
</script>