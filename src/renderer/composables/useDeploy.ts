import { ref, onUnmounted } from 'vue';
import type { BuildProgress } from '../../shared/types';

export function useDeploy() {
  const isDeploying = ref(false);
  const deployProgress = ref<BuildProgress | null>(null);

  function onProgress(progress: BuildProgress) {
    deployProgress.value = progress;
  }

  function startListenProgress() {
    window.electronAPI.onDeployProgress(onProgress);
  }

  function stopListenProgress() {
    window.electronAPI.removeDeployProgressListener();
  }

  async function startDeploy(serverId: string, deployType: 'frontend' | 'backend') {
    isDeploying.value = true;
    deployProgress.value = null;
    startListenProgress();

    try {
      const result = await window.electronAPI.executeOneClickDeploy(serverId, deployType);
      isDeploying.value = false;

      if (result.success) {
        console.log('部署成功:', result);
      } else {
        console.error('部署失败:', result.error);
      }

      return result;
    } catch (error) {
      isDeploying.value = false;
      console.error('部署失败:', error);
      throw error;
    }
  }

  async function cancelDeploy() {
    await window.electronAPI.cancelDeploy();
    isDeploying.value = false;
  }

  onUnmounted(() => {
    stopListenProgress();
  });

  return {
    isDeploying,
    deployProgress,
    startDeploy,
    cancelDeploy,
  };
}
