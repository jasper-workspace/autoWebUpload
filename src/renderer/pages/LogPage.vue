<template>
  <div class="max-w-7xl mx-auto h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
      <!-- 左侧：快捷命令区域 -->
      <div class="col-span-1 md:col-span-3 flex flex-col min-h-0">
        <div class="card p-4 h-full flex flex-col">
          <!-- 连接状态 -->
          <div class="flex items-center gap-2 mb-4">
            <span class="text-sm text-[var(--foreground)]">状态:</span>
            <span
              :class="[
                'px-2 py-0.5 rounded text-xs font-medium',
                isConnected
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              ]"
            >
              {{ isConnected ? '已连接' : '未连接' }}
            </span>
          </div>

          <!-- 快捷命令 -->
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-[var(--foreground)] mb-2">
              快捷命令
            </h3>
            <div class="flex flex-col gap-2">
              <button
                @click="sendCommand('clear')"
                :disabled="!isConnected"
                class="btn-secondary w-full text-left px-3 py-2 text-xs rounded border border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors"
              >
                clear - 清屏
              </button>
              <button
                @click="sendCommand('ls -la')"
                :disabled="!isConnected"
                class="btn-secondary w-full text-left px-3 py-2 text-xs rounded border border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors"
              >
                ls -la - 列出目录
              </button>
              <button
                @click="sendCommand('ps aux | head -20')"
                :disabled="!isConnected"
                class="btn-secondary w-full text-left px-3 py-2 text-xs rounded border border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors"
              >
                ps aux - 查看进程
              </button>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex flex-col gap-3 mt-auto">
            <button
              v-if="!isConnected"
              @click="connect"
              :disabled="!selectedServer || isConnecting"
              class="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <span v-if="isConnecting" class="animate-spin">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </span>
              <span>{{ isConnecting ? '连接中...' : '连接终端' }}</span>
            </button>
            <button
              v-else
              @click="disconnect"
              :disabled="isDisconnecting"
              class="btn-danger w-full flex items-center justify-center gap-2 text-sm"
            >
              <span>{{ isDisconnecting ? '断开中...' : '断开连接' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：交互式终端 -->
      <div class="col-span-1 md:col-span-9 flex flex-col min-h-0">
        <div class="card p-4 h-full flex flex-col">
          <div class="flex justify-between items-center mb-2">
            <h2 class="text-sm font-semibold text-[var(--foreground)]">
              交互式终端
            </h2>
            <div class="flex gap-2 items-center">
              <span v-if="selectedServer" class="text-xs text-[var(--muted-text)]">
                {{ selectedServer.name }}
              </span>
              <span v-if="isConnected" class="text-xs text-green-400">
                ● 已连接
              </span>
            </div>
          </div>

          <!-- 终端面板 -->
          <div class="flex-1 bg-[#1e1e1e] rounded-lg overflow-hidden min-h-[400px]">
            <TerminalPanel
              ref="terminalPanelRef"
              @data="handleTerminalData"
            />
          </div>

          <!-- 提示信息 -->
          <div class="mt-2 text-xs text-[var(--muted-text)]">
            <span>提示: Ctrl+C 中断命令 | ↑↓ 历史命令 | clear 清屏</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue';
import { useServerStore } from '../stores/server';
import { useTerminalStore } from '../stores/terminal';
import TerminalPanel from '../components/TerminalPanel.vue';

// 定义组件名称，用于 keep-alive
defineOptions({
  name: 'Log'
});

const serverStore = useServerStore();
const terminalStore = useTerminalStore();

// Refs
const terminalPanelRef = ref<InstanceType<typeof TerminalPanel> | null>(null);
const isConnecting = ref(false);
const isDisconnecting = ref(false);

// 计算属性 - 直接使用 serverStore 的选中服务器
const selectedServer = computed(() => serverStore.selectedServer);
const isConnected = computed(() => terminalStore.isConnected);

// 页面首次加载
onMounted(async () => {
  await serverStore.loadServers();

  // 初始化终端监听器
  initTerminalListeners();
});

// 页面激活时（从缓存恢复）
onActivated(() => {
  // 重新注册监听器，因为之前可能移除了
  initTerminalListeners();
});

// 页面卸载时只移除监听器，保持连接
onUnmounted(() => {
  removeTerminalListeners();
});

// 初始化终端监听器
function initTerminalListeners() {
  // 先移除旧监听器，避免重复注册
  window.electronAPI.removeTerminalListeners();

  window.electronAPI.onTerminalData((data: string) => {
    terminalPanelRef.value?.write(data);
  });

  window.electronAPI.onTerminalClose(() => {
    terminalStore.setDisconnected();
    terminalPanelRef.value?.writeln('\r\n[连接已关闭]\r\n');
  });

  window.electronAPI.onTerminalError((error: string) => {
    terminalPanelRef.value?.writeln(`\r\n[错误: ${error}]\r\n`);
  });
}

// 移除终端监听器
function removeTerminalListeners() {
  window.electronAPI.removeTerminalListeners();
}

// 连接终端
async function connect() {
  if (!selectedServer.value || isConnecting.value || isDisconnecting.value) {
    return;
  }

  isConnecting.value = true;

  try {
    // 获取终端尺寸
    const size = terminalPanelRef.value?.getSize() || { cols: 80, rows: 24 };

    // 连接终端
    const result = await window.electronAPI.terminalConnect({
      serverId: selectedServer.value.id,
      cols: size.cols,
      rows: size.rows,
    });

    if (result.success) {
      terminalStore.setConnected(selectedServer.value.id);
      terminalPanelRef.value?.writeln(`[连接到 ${selectedServer.value.name}]`);
      terminalPanelRef.value?.writeln('');
    } else {
      throw new Error(result.error || '连接失败');
    }
  } catch (error: any) {
    terminalPanelRef.value?.writeln(`\r\n[连接失败: ${error.message}]\r\n`);
    terminalStore.setDisconnected();
  } finally {
    isConnecting.value = false;
  }
}

// 断开连接
async function disconnect() {
  if (isDisconnecting.value) return;

  isDisconnecting.value = true;

  try {
    await window.electronAPI.terminalDisconnect();
    terminalStore.setDisconnected();
    terminalPanelRef.value?.writeln('\r\n[已断开连接]\r\n');
  } catch (error: any) {
    terminalPanelRef.value?.writeln(`\r\n[断开失败: ${error.message}]\r\n`);
  } finally {
    isDisconnecting.value = false;
  }
}

// 处理终端数据输入
function handleTerminalData(data: string) {
  window.electronAPI.terminalWrite(data);
}

// 发送快捷命令
function sendCommand(command: string) {
  if (!isConnected.value) return;

  // 发送命令到终端
  window.electronAPI.terminalWrite(command + '\r');
}
</script>
