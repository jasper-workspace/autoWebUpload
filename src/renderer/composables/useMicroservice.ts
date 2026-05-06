import { ref, reactive, onUnmounted } from 'vue';
import type {
  MicroserviceConfig,
  MicroserviceBuildProgress,
  MultiMicroserviceDeployResult,
  MAVEN_COMMANDS,
} from '../../shared/types';

// Maven命令类型
type MavenCommand = 'clean' | 'compile' | 'package' | 'install' | 'deploy';

/**
 * 微服务部署Composable
 * 提供微服务扫描、配置、构建、部署等功能
 */
export function useMicroservice() {
  // 状态
  const isDeploying = ref(false);
  const isScanning = ref(false);
  const isBuilding = ref(false);
  const mavenInstalled = ref(false);
  const mavenVersion = ref<string | null>(null);

  // 微服务列表
  const microservices = ref<MicroserviceConfig[]>([]);

  // 当前选中的Maven命令
  const selectedCommand = ref<MavenCommand>('package');

  // 构建进度映射
  const buildProgressMap = reactive<Record<string, MicroserviceBuildProgress>>({});

  // 部署结果
  const deployResult = ref<MultiMicroserviceDeployResult | null>(null);

  // 错误信息
  const error = ref<string | null>(null);

  // 进度监听函数
  function onBuildProgress(progress: MicroserviceBuildProgress) {
    console.log('[useMicroservice] onBuildProgress', progress);
    buildProgressMap[progress.microserviceId] = progress;
  }

  // 开始监听进度
  function startListenProgress() {
    window.electronAPI.onMicroserviceBuildProgress(onBuildProgress);
  }

  // 停止监听进度
  function stopListenProgress() {
    window.electronAPI.removeMicroserviceBuildProgressListener();
  }

  /**
   * 检测Maven是否安装
   */
  async function checkMaven(): Promise<boolean> {
    try {
      const result = await window.electronAPI.checkMavenInstalled();
      mavenInstalled.value = result.installed;
      mavenVersion.value = result.version;
      return result.installed;
    } catch {
      mavenInstalled.value = false;
      return false;
    }
  }

  /**
   * 扫描微服务
   * @param rootPath 后端根目录
   */
  async function scanMicroservices(rootPath: string): Promise<MicroserviceConfig[]> {
    isScanning.value = true;
    error.value = null;

    try {
      const result = await window.electronAPI.scanMicroservices(rootPath);
      if (result.success) {
        microservices.value = result.data || [];
        return microservices.value;
      } else {
        error.value = result.error || '扫描失败';
        return [];
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '扫描失败';
      return [];
    } finally {
      isScanning.value = false;
    }
  }

  /**
   * 从服务器配置获取微服务列表
   * @param serverId 服务器ID
   */
  async function loadMicroservices(serverId: string): Promise<MicroserviceConfig[]> {
    try {
      console.log('[useMicroservice] loadMicroservices called with serverId:', serverId);
      const result = await window.electronAPI.getMicroserviceList(serverId);
      console.log('[useMicroservice] getMicroserviceList result:', result);
      if (result.success) {
        microservices.value = result.data || [];
        console.log('[useMicroservice] microservices.value after assignment:', microservices.value);
        return microservices.value;
      } else {
        error.value = result.error || '获取微服务列表失败';
        console.log('[useMicroservice] error:', error.value);
        return [];
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取微服务列表失败';
      console.log('[useMicroservice] exception:', e);
      return [];
    }
  }

  /**
   * 保存微服务配置
   * @param serverId 服务器ID
   */
  async function saveMicroservices(serverId: string, rootPath?: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.saveMicroserviceConfig(
        serverId,
        { microservices: microservices.value, rootPath }
      );
      if (!result.success) {
        error.value = result.error || '保存失败';
        return false;
      }
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '保存失败';
      return false;
    }
  }

  /**
   * 切换微服务启用状态
   * @param serverId 服务器ID
   * @param microserviceId 微服务ID
   * @param enabled 是否启用
   */
  async function toggleMicroservice(
    serverId: string,
    microserviceId: string,
    enabled: boolean
  ): Promise<boolean> {
    try {
      const result = await window.electronAPI.toggleMicroservice(
        serverId,
        microserviceId,
        enabled
      );
      if (result.success) {
        // 更新本地状态
        const ms = microservices.value.find((m) => m.id === microserviceId);
        if (ms) {
          ms.enabled = enabled;
        }
        return true;
      } else {
        error.value = result.error || '操作失败';
        return false;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '操作失败';
      return false;
    }
  }

  /**
   * 构建单个微服务
   * @param microservice 微服务配置
   * @param command Maven命令
   */
  async function buildMicroservice(
    microservice: MicroserviceConfig,
    command: MavenCommand
  ): Promise<boolean> {
    isBuilding.value = true;
    error.value = null;

    // 设置初始进度
    buildProgressMap[microservice.id] = {
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      command,
      phase: 'building',
      percentage: 0,
      output: '',
      startTime: Date.now(),
    };

    try {
      const result = await window.electronAPI.buildMicroservice(
        microservice.localPath,
        command,
        command !== 'clean' && command !== 'compile'
      );

      if (result.success) {
        buildProgressMap[microservice.id] = {
          ...buildProgressMap[microservice.id],
          phase: 'completed',
          percentage: 100,
          output: '构建成功',
          endTime: Date.now(),
          duration: Date.now() - (buildProgressMap[microservice.id]?.startTime || Date.now()),
        };
        return true;
      } else {
        buildProgressMap[microservice.id] = {
          ...buildProgressMap[microservice.id],
          phase: 'error',
          percentage: 0,
          output: result.output || '',
          error: result.error,
          endTime: Date.now(),
          duration: Date.now() - (buildProgressMap[microservice.id]?.startTime || Date.now()),
        };
        error.value = result.error || '构建失败';
        return false;
      }
    } catch (e) {
      buildProgressMap[microservice.id] = {
        ...buildProgressMap[microservice.id],
        phase: 'error',
        percentage: 0,
        output: '',
        error: e instanceof Error ? e.message : '构建失败',
        endTime: Date.now(),
        duration: Date.now() - (buildProgressMap[microservice.id]?.startTime || Date.now()),
      };
      error.value = e instanceof Error ? e.message : '构建失败';
      return false;
    } finally {
      isBuilding.value = false;
    }
  }

  /**
   * 部署单个微服务
   * @param serverId 服务器ID
   * @param microservice 微服务配置
   * @param command Maven命令
   */
  async function deployMicroservice(
    serverId: string,
    microservice: MicroserviceConfig,
    command: MavenCommand
  ): Promise<boolean> {
    isDeploying.value = true;
    error.value = null;
    startListenProgress();

    try {
      // 先构建
      const buildSuccess = await buildMicroservice(microservice, command);
      if (!buildSuccess) {
        return false;
      }

      // TODO: 实现单个微服务部署（目前主要通过deployAllMicroservices）
      return true;
    } finally {
      isDeploying.value = false;
      stopListenProgress();
    }
  }

  /**
   * 一键部署全部启用的微服务（跳过构建，直接上传jar包）
   * @param serverId 服务器ID
   * @param selectedIds 用户选择的微服务ID列表
   */
  async function deployAllMicroservices(
    serverId: string,
    selectedIds: string[] = []
  ): Promise<MultiMicroserviceDeployResult | null> {
    isDeploying.value = true;
    error.value = null;
    deployResult.value = null;

    // 清空进度，只对用户选择且启用的微服务设置 pending 状态
    for (const ms of microservices.value) {
      const isSelected = selectedIds.includes(ms.id);
      const shouldInit = isSelected && ms.enabled;

      if (shouldInit) {
        buildProgressMap[ms.id] = {
          microserviceId: ms.id,
          microserviceName: ms.name,
          phase: 'pending',
          percentage: 0,
          output: '',
        };
      } else {
        // 清除不在选择范围内或未启用的微服务进度
        delete buildProgressMap[ms.id];
      }
    }

    startListenProgress();

    try {
      console.log('[useMicroservice] 调用 window.electronAPI.deployAllMicroservices', { serverId, selectedIds });

      // 添加超时机制（10分钟，Maven构建可能需要较长时间）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('IPC 调用超时（10分钟）')), 600000);
      });

      const result = await Promise.race([
        window.electronAPI.deployAllMicroservices(serverId, selectedIds),
        timeoutPromise
      ]) as MultiMicroserviceDeployResult;

      console.log('[useMicroservice] deployAllMicroservices 返回', result);
      deployResult.value = result;
      isDeploying.value = false;

      if (!result.success && result.error) {
        error.value = result.error;
      }

      return result as MultiMicroserviceDeployResult;
    } catch (e) {
      console.error('[useMicroservice] deployAllMicroservices 异常', e);
      error.value = e instanceof Error ? e.message : '部署失败';
      return null;
    } finally {
      isDeploying.value = false;
      stopListenProgress();
    }
  }

  /**
   * 取消部署
   */
  async function cancelDeploy() {
    await window.electronAPI.cancelMicroserviceDeploy();
    isDeploying.value = false;
  }

  /**
   * 获取启用的微服务数量
   */
  function getEnabledCount(): number {
    return microservices.value.filter((ms) => ms.enabled).length;
  }

  /**
   * 获取微服务进度
   */
  function getMicroserviceProgress(microserviceId: string): MicroserviceBuildProgress | null {
    return buildProgressMap[microserviceId] || null;
  }

  /**
   * 清空进度
   */
  function clearProgress() {
    for (const key in buildProgressMap) {
      delete buildProgressMap[key];
    }
    deployResult.value = null;
    error.value = null;
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopListenProgress();
  });

  return {
    // 状态
    isDeploying,
    isScanning,
    isBuilding,
    mavenInstalled,
    mavenVersion,
    microservices,
    selectedCommand,
    buildProgressMap,
    deployResult,
    error,

    // 方法
    checkMaven,
    scanMicroservices,
    loadMicroservices,
    saveMicroservices,
    toggleMicroservice,
    buildMicroservice,
    deployMicroservice,
    deployAllMicroservices,
    cancelDeploy,
    getEnabledCount,
    getMicroserviceProgress,
    clearProgress,
  };
}
