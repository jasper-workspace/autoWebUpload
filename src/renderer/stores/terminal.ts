import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TerminalState } from '../../shared/types';

export const useTerminalStore = defineStore('terminal', () => {
  // 连接状态
  const isConnected = ref(false);

  // 当前连接的服务器ID
  const currentServerId = ref<string | null>(null);

  // 命令历史记录
  const commandHistory = ref<string[]>([]);

  // 历史索引（用于上下箭头切换）
  const historyIndex = ref(-1);

  // 终端提示符
  const prompt = ref('C:\\Users\\admin>');

  // 是否正在执行命令
  const isExecuting = ref(false);

  // 计算属性：是否有历史命令
  const hasHistory = computed(() => commandHistory.value.length > 0);

  // 添加命令到历史记录
  function addToHistory(command: string) {
    if (command.trim() === '') return;

    // 避免重复添加连续相同的命令
    if (commandHistory.value[commandHistory.value.length - 1] !== command) {
      commandHistory.value.push(command);
    }

    // 重置索引到最新位置
    historyIndex.value = commandHistory.value.length;
  }

  // 获取上一条命令
  function getPreviousCommand(): string | null {
    if (commandHistory.value.length === 0) return null;

    if (historyIndex.value > 0) {
      historyIndex.value--;
    }

    return commandHistory.value[historyIndex.value];
  }

  // 获取下一条命令
  function getNextCommand(): string | null {
    if (commandHistory.value.length === 0) return null;

    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++;
      return commandHistory.value[historyIndex.value];
    }

    // 已经到最后了，返回空
    historyIndex.value = commandHistory.value.length;
    return '';
  }

  // 重置历史索引
  function resetHistoryIndex() {
    historyIndex.value = commandHistory.value.length;
  }

  // 清空历史记录
  function clearHistory() {
    commandHistory.value = [];
    historyIndex.value = -1;
  }

  // 设置连接状态
  function setConnected(serverId: string) {
    isConnected.value = true;
    currentServerId.value = serverId;
  }

  // 断开连接
  function setDisconnected() {
    isConnected.value = false;
    currentServerId.value = null;
    clearHistory();
  }

  // 设置提示符
  function setPrompt(newPrompt: string) {
    prompt.value = newPrompt;
  }

  // 设置执行状态
  function setExecuting(executing: boolean) {
    isExecuting.value = executing;
  }

  return {
    // 状态
    isConnected,
    currentServerId,
    commandHistory,
    historyIndex,
    prompt,
    isExecuting,

    // 计算属性
    hasHistory,

    // 方法
    addToHistory,
    getPreviousCommand,
    getNextCommand,
    resetHistoryIndex,
    clearHistory,
    setConnected,
    setDisconnected,
    setPrompt,
    setExecuting,
  };
});
