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

          <!-- 一键部署按钮 -->
          <div
            v-if="
              currentDeployConfig?.buildConfig?.localPath &&
              currentDeployConfig?.buildConfig?.buildCommand
            "
            class="mb-4">
            <button
              @click="handleOneClickDeploy"
              :disabled="isDeploying || !selectedServer"
              class="btn-oneclick"
              :class="isDeploying ? 'deploying' : ''">
              <Zap class="w-5 h-5" />
              <span class="btn-text">
                {{
                  isDeploying
                    ? `${deployType === "frontend" ? "前端" : "后端"}部署中`
                    : `一键部署${deployType === "frontend" ? "前端" : "后端"}`
                }}
              </span>
              <span v-if="isDeploying" class="loading-dots">
                <span></span><span></span><span></span>
              </span>
            </button>
            <!-- 取消部署按钮（独立于一键部署区域） -->
            <button
              v-if="isDeploying"
              @click="handleCancelDeploy"
              class="flex items-center justify-center w-full gap-2 mt-4 text-sm btn-danger">
              <X class="w-4 h-4" />
              取消部署
            </button>

            <!-- 部署进度展示 -->
            <div
              v-if="isDeploying"
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
            <!-- 远程目标路径 -->
            <div class="mb-4">
              <h2 class="text-sm mb-4 font-semibold text-[var(--foreground)]">
                远程目标路径
              </h2>
              <input
                v-model="remotePath"
                disabled
                type="text"
                class="w-full input-field"
                placeholder="选择服务器后自动填写" />
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
import { Upload, FolderOpen, X, Zap } from "lucide-vue-next";
import { useServerStore } from "../stores/server";
import { useUploadStore } from "../stores/upload";
import DropZone from "../components/DropZone.vue";
import { showWarning, showError } from "../utils/notification";
import type { UploadProgress } from "../../shared/types";
import { toSerializableConfig } from "../utils/config";
import { useDeploy } from "../composables/useDeploy";
import type { BuildProgress } from "../../shared/types";

const serverStore = useServerStore();
const uploadStore = useUploadStore();

// 一键部署
const { isDeploying, deployProgress, startDeploy, cancelDeploy } = useDeploy();

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

// 一键部署是否可用
const canOneClickDeploy = computed(() => {
  return (
    currentDeployConfig.value?.buildConfig?.localPath &&
    currentDeployConfig.value?.buildConfig?.buildCommand
  );
});

// 监听部署类型切换，重置手动上传选项，再根据一键部署能力控制
watch(
  deployType,
  () => {
    // 切换时先重置为 false
    showManualUpload.value = false;
    // 如果没有一键部署能力，则显示手动上传
    if (!canOneClickDeploy.value && selectedServer.value) {
      showManualUpload.value = true;
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
    if (!isDeploying.value) return;

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

// 监听服务器变化或部署类型变化，更新远程路径
watch(
  [selectedServer, deployType],
  ([server, type]) => {
    if (server) {
      const targetConfig =
        type === "frontend" ? server.frontend : server.backend;
      uploadStore.remotePath = targetConfig?.remotePath || "";
    } else {
      uploadStore.remotePath = "";
    }
  },
  { immediate: true },
);

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

    // 创建可序列化的配置对象
    const serializableConfig = toSerializableConfig(selectedServer.value);
    const targetConfig =
      deployType.value === "frontend"
        ? selectedServer.value.frontend
        : selectedServer.value.backend;
    const uploadConfig = JSON.parse(
      JSON.stringify({
        ...serializableConfig,
        remotePath: remotePath.value,
        postUploadCommand: targetConfig?.postUploadCommand,
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
onActivated(() => {
  serverStore.refreshIfNeeded();
});
</script>
