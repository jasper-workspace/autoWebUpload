<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
      <!-- 左侧：配置区域 -->
      <div class="col-span-1 md:col-span-4 flex flex-col min-h-0">
        <div class="card p-4 h-full flex flex-col">

          <!-- 日志类型选择 -->
          <div class="mb-4">
            <h2 class="text-sm font-semibold text-[var(--foreground)]">
              日志类型
            </h2>
            <div class="flex gap-3 mt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="logType"
                  type="radio"
                  value="frontend"
                  class="accent-[#409EFF]"
                />
                <span class="text-[var(--foreground)]">前端</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="logType"
                  type="radio"
                  value="backend"
                  class="accent-[#409EFF]"
                />
                <span class="text-[var(--foreground)]">后端</span>
              </label>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex flex-col gap-3">
            <button
              v-if="!isStreaming"
              @click="startLogStream"
              :disabled="!canFetchLogs || isOperating"
              class="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <Play class="w-4 h-4" />
              开始实时日志
            </button>
            <button
              v-else
              @click="stopLogStream"
              :disabled="isOperating"
              class="btn-danger w-full flex items-center justify-center gap-2 text-sm"
            >
              <StopCircle class="w-4 h-4" />
              停止实时日志
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：日志显示 -->
      <div class="col-span-1 md:col-span-8 flex flex-col min-h-0">
        <div class="card p-5 flex-1 flex flex-col min-h-0">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-[var(--foreground)]">
              {{ logType === 'frontend' ? '前端 Nginx 日志' : '后端服务日志' }}
            </h2>
            <div class="flex gap-2 items-center">
              <span v-if="selectedServer" class="text-xs text-[var(--muted-text)]">
                {{ selectedServer.name }}
              </span>
            </div>
          </div>

          <!-- 日志输出 -->
          <div
            ref="logContainer"
            @scroll="handleScroll"
            class="bg-[var(--log-bg)] rounded-lg p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1 border border-[var(--card-border)]"
          >
            <div
              v-for="(log, index) in logs"
              :key="index"
              :class="{
                'text-green-400': log.type === 'success',
                'text-red-400': log.type === 'error',
                'text-blue-400': log.type === 'info',
                'text-[var(--foreground)]': !log.type,
              }"
            >
              [{{ log.time }}] {{ log.message }}
            </div>
            <div v-if="logs.length === 0" class="text-[var(--muted-text)]">暂无日志</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch, onActivated } from 'vue';
import { Play, StopCircle } from 'lucide-vue-next';
import { useServerStore } from '../stores/server';
import { useLogStore } from '../stores/log';
import type { ServerConfig } from '../../shared/types';
import { toSerializableConfig } from '../utils/config';

const serverStore = useServerStore();
const logStore = useLogStore();

const logType = computed({
  get: () => logStore.logType,
  set: (value: 'frontend' | 'backend') => { logStore.logType = value; }
});
const isStreaming = computed(() => logStore.isStreaming);
const logs = computed(() => logStore.logs);
const logContainer = ref<HTMLElement | null>(null);

const selectedServer = computed(() => serverStore.selectedServer);

const canFetchLogs = computed(() => {
  if (!selectedServer.value) return false;
  
  const command = logType.value === 'frontend'
    ? selectedServer.value.frontendLogCommand
    : selectedServer.value.backendLogCommand;
    
  return !!command && command.trim() !== '';
});

const isUserScrolling = ref(false);
let scrollTimeout: NodeJS.Timeout | null = null;
// 操作标志
let isOperating = ref(false); // 统一的操作标志，防止重复操作

// 监听服务器变化，清空日志
watch(selectedServer, () => {
  logStore.clearLogs();
});

// 监听日志类型切换，清空日志
watch(logType, async (newType) => {
  if (!selectedServer.value) return;
  
  // 清空日志
  logStore.clearLogs();
  
  // 检查是否有配置的命令
  const command = newType === 'frontend'
    ? selectedServer.value.frontendLogCommand
    : selectedServer.value.backendLogCommand;
    
  if (!command || command.trim() === '') {
    logStore.addLog(`提示：未配置${newType === 'frontend' ? '前端' : '后端'}日志命令，请在服务器配置中添加`, 'info');
  }
}, { immediate: false });

// 添加日志
function addLog(message: string, type?: string) {
  logStore.addLog(message, type);

  scrollToBottom();
}

// 滚动到底部
function scrollToBottom() {
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

// 清空日志
function clearLogs() {
  logStore.clearLogs();
}

// 启动实时日志流
async function startLogStream() {

  if (isOperating.value) {
    return;
  }

  if (!selectedServer.value || !canFetchLogs.value) {
    addLog("请先选择服务器并确保配置了日志命令", "error");
    return;
  }

  const logCommand = logType.value === 'frontend'
    ? selectedServer.value.frontendLogCommand
    : selectedServer.value.backendLogCommand;

  if (!logCommand) {
    addLog("日志命令未配置", "error");
    return;
  }

  isOperating.value = true;
  clearLogs();
  addLog("开始实时日志流...", "info");
  addLog(`执行命令: ${logCommand}`, "info");

  logStore.startStream();

  try {
    const serializableConfig = toSerializableConfig(selectedServer.value);

    // 启动日志流（不在这里设置监听器，onMounted中已设置）
    await window.electronAPI.startLogStream(serializableConfig, logCommand);

    // addLog("实时日志流已启动", "success");
  } catch (error: any) {
    console.error('启动日志流出错:', error);
    addLog(`启动日志流出错: ${error.message || '未知错误'}`, "error");
  } finally {
    // 无论是成功还是失败，都重置标志
    isOperating.value = false;
  }
}

// 停止实时日志流
async function stopLogStream() {

  if (isOperating.value) {
    return;
  }

  isOperating.value = true;
  addLog("正在停止实时日志流...", "info");

  // 先设置标志，停止接收新的日志数据
  logStore.stopStream();

  try {
    await window.electronAPI.stopLogStream();
    // 不在这里移除监听器，监听器由 onMounted/onUnmounted 管理
    addLog("实时日志流已停止", "success");
  } catch (error: any) {
    console.error('停止日志流出错:', error);
    addLog(`停止日志流出错: ${error.message || '未知错误'}`, "error");
  } finally {
    // 无论如何都重置标志
    isOperating.value = false;
  }
}

onMounted(() => {
  // 先移除旧的监听器，避免重复
  window.electronAPI.removeLogStreamListeners();

  window.electronAPI.onLogStream((log: string) => {
    if (!logStore.shouldReceiveLogs) return;

    const lines = log.split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        logStore.addLog(line);
      }
    });

    // 滚动到底部
    scrollToBottom();
  });

  window.electronAPI.onLogStreamError((error: string) => {
    if (!logStore.shouldReceiveLogs) return;
    logStore.addLog(`日志流出错: ${error}`, "error");
  });
});

onUnmounted(() => {
  // 清理超时
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // 移除日志监听器
  window.electronAPI.removeLogStreamListeners();
});

onActivated(() => {
  // 页面激活时，检查并刷新配置
  serverStore.refreshIfNeeded();
});
</script>
