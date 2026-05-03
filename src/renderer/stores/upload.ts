import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UploadProgress } from '../../shared/types';

export const useUploadStore = defineStore('upload', () => {
  // 是否在上传中
  const uploading = ref(false);
  
  // 上传进度
  const progress = ref<UploadProgress>({
    totalFiles: 0,
    uploadedFiles: 0,
    currentFile: "",
    percentage: 0,
    status: "uploading",
  });
  
  // 日志列表
  const logs = ref<Array<{ time: string; message: string; type?: string }>>([]);
  
  // 日志容器引用
  const logContainer = ref<HTMLElement | null>(null);
  
  // 部署类型
  const deployType = ref<"frontend" | "backend">("frontend");
  
  // 本地路径
  const localPath = ref("");
  
  // 远程路径
  const remotePath = ref("");
  
  // 进度日志索引
  const progressLogIndex = ref<number | null>(null);

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

  // 处理上传进度（全局监听器使用）
  function handleUploadProgress(data: any, uploadConfig?: any) {
    if (data.status) {
      progress.value = { ...progress.value, ...data };

      if (data.status === "success") {
        // 删除或更新进度日志
        if (progressLogIndex.value !== null) {
          logs.value.splice(progressLogIndex.value, 1);
        }
        addLog(`上传成功: ${data.message || '文件上传完成'}`, "success");
        progressLogIndex.value = null;
        if (uploadConfig?.postUploadCommand) {
          addLog(`执行命令: ${uploadConfig.postUploadCommand}`, "info");
        }
      } else if (data.status === "error") {
        if (progressLogIndex.value !== null) {
          logs.value.splice(progressLogIndex.value, 1);
        }
        addLog(`上传失败: ${data.message || '未知错误'}`, "error");
        progressLogIndex.value = null;
      } else if (data.status === "uploading" && data.percentage !== undefined) {
        const loadingBar =
          "█".repeat(Math.floor(data.percentage / 5)) +
          "-".repeat(20 - Math.floor(data.percentage / 5));
        
        // 根据部署类型显示不同的进度信息
        let message = '';
        if (deployType.value === 'backend') {
          // 后端单个文件上传
          message = `上传中: [${loadingBar}] ${data.percentage}%`;
        } else {
          // 前端多文件上传
          message = `上传中: [${loadingBar}] ${data.percentage}% (${data.uploadedFiles}/${data.totalFiles})`;
        }
        
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now
          .getMinutes()
          .toString()
          .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        if (progressLogIndex.value === null) {
          // 第一次添加进度日志
          logs.value.push({ time, message, type: "info" });
          progressLogIndex.value = logs.value.length - 1;
        } else {
          // 更新现有的进度日志
          logs.value[progressLogIndex.value] = { time, message, type: "info" };
        }
      } else if (data.status === "progress") {
        // 可以在这里添加更详细的进度日志
        if (data.currentFile && data.progress !== undefined) {
          addLog(`正在上传: ${data.currentFile} (${Math.round(data.progress)}%)`, "info");
        }
      }
    } else if (data.message) {
      // 处理普通消息
      const messageType = data.type || "info";
      addLog(data.message, messageType);
    }
  }

  return {
    uploading,
    progress,
    logs,
    logContainer,
    deployType,
    localPath,
    remotePath,
    progressLogIndex,
    addLog,
    clearLogs,
    handleUploadProgress,
  };
});
