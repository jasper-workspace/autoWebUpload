<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
      <!-- 左侧：配置区域（占4份） -->
      <div class="col-span-1 md:col-span-4 flex flex-col min-h-0">
        <div class="card p-4 h-full flex flex-col">
          <!-- 目标服务器 -->
          <div class="mb-4">
            <h2 class="text-sm font-semibold text-[#E0E0E0]">
              目标服务器
            </h2>
            <select
              v-model="selectedServerId"
              class="input-field h-[2.5rem] w-full"
              @change="handleServerChange"
            >
              <option value="">请选择目标服务器</option>
              <option
                v-for="server in servers"
                :key="server.id"
                :value="server.id"
              >
                {{ server.name }}
                 <!-- ({{ server.host }}) -->
              </option>
            </select>
          </div>

          <!-- 远程目标路径 -->
          <div class="mb-4">
            <h2 class="text-sm font-semibold text-[#E0E0E0]">
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
            <h2 class="text-sm font-semibold text-[#E0E0E0]">
              本地文件夹
            </h2>
            <div class="flex flex-col gap-2">
              <input
                v-model="localPath"
                type="text"
                class="input-field w-full"
                placeholder="请选择本地文件夹路径"
                readonly
              />
              <button
                @click="selectFolder"
                class="btn-primary flex items-center justify-center gap-2 text-sm"
              >
                <FolderOpen class="w-4 h-4" />
                浏览
              </button>
            </div>
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
import { ref, computed, nextTick, onMounted } from "vue";
import { Upload, FolderOpen, X } from "lucide-vue-next";
import type { ServerConfig, UploadProgress } from "../../shared/types";

const servers = ref<ServerConfig[]>([]);
const selectedServerId = ref("");
const localPath = ref("");
const remotePath = ref("");
const uploading = ref(false);
const progress = ref<UploadProgress>({
  totalFiles: 0,
  uploadedFiles: 0,
  currentFile: "",
  percentage: 0,
  status: "uploading",
});
const logs = ref<Array<{ time: string; message: string; type?: string }>>([]);
const logContainer = ref<HTMLElement | null>(null);
let progressLogIndex: number | null = null;

const selectedServer = computed(
  () => servers.value.find((s) => s.id === selectedServerId.value) || null
);

const canUpload = computed(
  () =>
    selectedServer.value &&
    localPath.value &&
    remotePath.value &&
    !uploading.value
);

// 添加日志
function addLog(message: string, type?: string) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  logs.value.push({ time, message, type });

  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

// 加载服务器列表
async function loadServers() {
  try {
    servers.value = await window.electronAPI.getConfigs();
  } catch (error) {
    console.error("加载服务器列表失败:", error);
  }
}

// 选择文件夹
async function selectFolder() {
  try {
    const path = await window.electronAPI.selectFolder();
    if (path) {
      // 校验是否为 dist 目录
      if (!path.endsWith("dist") && !path.endsWith("dist\\")) {
        addLog("错误：请选择 dist 目录", "error");
        return;
      }
      localPath.value = path;
      addLog(`已选择文件夹: ${path}`, "info");
    }
  } catch (error) {
    console.error("选择文件夹失败:", error);
    addLog("选择文件夹失败", "error");
  }
}

// 服务器变更
function handleServerChange() {
  remotePath.value = "";
  if (selectedServer.value) {
    remotePath.value = selectedServer.value.remotePath;
  }
}

// 开始上传
async function startUpload() {
  if (!selectedServer.value || !localPath.value || !remotePath.value) return;

  uploading.value = true;
  progress.value = {
    totalFiles: 0,
    uploadedFiles: 0,
    currentFile: "",
    percentage: 0,
    status: "uploading",
  };
  progressLogIndex = null;

  addLog(`开始上传文件...`, "info");
  addLog(`本地路径: ${localPath.value}`, "info");
  addLog(`远程路径: ${remotePath.value}`, "info");

  // 先移除之前的监听器
  window.electronAPI.removeUploadProgressListener();

  // 只传递必要的配置信息
  const uploadConfig = {
    id: selectedServer.value.id,
    name: selectedServer.value.name,
    host: selectedServer.value.host,
    port: selectedServer.value.port,
    username: selectedServer.value.username,
    password: selectedServer.value.password,
    privateKey: selectedServer.value.privateKey,
    remotePath: remotePath.value,
    postUploadCommand: selectedServer.value.postUploadCommand,
  };

  // 监听进度
  window.electronAPI.onUploadProgress((data: any) => {
    if (data.status) {
      progress.value = { ...progress.value, ...data };

      if (data.status === "success") {
        // 删除或更新进度日志
        if (progressLogIndex !== null) {
          logs.value.splice(progressLogIndex, 1);
        }
        addLog("上传完成! 100%", "success");
        progressLogIndex = null;
        if (uploadConfig?.postUploadCommand) {
          addLog(`执行命令: ${uploadConfig.postUploadCommand}`, "info");
        }
      } else if (data.status === "error") {
        if (progressLogIndex !== null) {
          logs.value.splice(progressLogIndex, 1);
        }
        addLog(`上传失败: ${data.error}`, "error");
        progressLogIndex = null;
      } else if (data.status === "uploading" && data.percentage !== undefined) {
        const loadingBar =
          "█".repeat(Math.floor(data.percentage / 5)) +
          "-".repeat(20 - Math.floor(data.percentage / 5));
        const message = `上传中: [${loadingBar}] ${data.percentage}% (${data.uploadedFiles}/${data.totalFiles})`;
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now
          .getMinutes()
          .toString()
          .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        if (progressLogIndex === null) {
          // 第一次添加进度日志
          logs.value.push({ time, message, type: "info" });
          progressLogIndex = logs.value.length - 1;
        } else {
          // 更新现有的进度日志
          logs.value[progressLogIndex] = { time, message, type: "info" };
        }
      }
    } else if (data.message) {
      addLog(data.message, "info");
    }
  });

  try {
    await window.electronAPI.uploadFolder(uploadConfig, localPath.value);
  } catch (error: any) {
    addLog(`上传失败: ${error.message}`, "error");
  } finally {
    uploading.value = false;
    window.electronAPI.removeUploadProgressListener();
  }
}

// 取消上传
async function cancelUpload() {
  try {
    await window.electronAPI.cancelUpload();
    addLog("上传已取消", "warnning");
    uploading.value = false;
  } catch (error) {
    console.error("取消上传失败:", error);
  }
}

// 清空日志
function clearLogs() {
  logs.value = [];
}

// 暴露方法给父组件使用
defineExpose({
  isUploading: () => uploading.value,
  cancelUpload,
});

onMounted(() => {
  loadServers();
  logs.value = [];
});
</script>
