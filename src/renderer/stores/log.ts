import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useLogStore = defineStore('log', () => {
  // 日志流是否在运行
  const isStreaming = ref(false);
  
  // 是否应该接收日志
  const shouldReceiveLogs = ref(false);
  
  // 日志列表
  const logs = ref<Array<{ time: string; message: string; type?: string }>>([]);
  
  // 日志容器引用
  const logContainer = ref<HTMLElement | null>(null);
  
  // 当前日志类型
  const logType = ref<'frontend' | 'backend'>('backend');

  // 计算属性：是否可以获取日志
  const canFetchLogs = computed(() => {
    // 这个计算属性需要在组件中使用，传入 selectedServer
    return false;
  });

  // 开始日志流
  function startStream() {
    isStreaming.value = true;
    shouldReceiveLogs.value = true;
  }

  // 停止日志流
  function stopStream() {
    shouldReceiveLogs.value = false;
    isStreaming.value = false;
  }

  // 添加日志
  function addLog(message: string, type?: string) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    // 如果没有指定 type，根据 message 内容自动识别
    let autoType = type;
    if (!autoType) {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('error') || lowerMsg.includes('failed') || lowerMsg.includes('fail to')) {
        autoType = 'error';
      } else if (lowerMsg.includes('warn')) {
        autoType = 'warning';
      } else if (message.includes('✓') || lowerMsg.includes('success') || lowerMsg.includes('complete')) {
        autoType = 'success';
      } else {
        autoType = 'info';
      }
    }

    logs.value.push({ time, message, type: autoType });
    
    // 限制日志数量为500条，超过时删除顶部的日志
    if (logs.value.length > 500) {
      logs.value.splice(0, logs.value.length - 500);
    }
  }

  // 清空日志
  function clearLogs() {
    logs.value = [];
  }

  return {
    isStreaming,
    shouldReceiveLogs,
    logs,
    logContainer,
    logType,
    canFetchLogs,
    startStream,
    stopStream,
    addLog,
    clearLogs,
  };
});
