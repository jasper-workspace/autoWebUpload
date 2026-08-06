<template>
  <div v-if="updateInfo" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="handleClose">
    <div class="card p-6 max-w-md w-full mx-4" @click.stop>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-info-soft flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-info"></div>
        </div>
        <h3 class="text-lg font-semibold">发现新版本</h3>
      </div>
      
      <div class="space-y-4 mb-6">
        <div class="flex justify-between items-center">
          <span class="text-sm text-muted">当前版本</span>
          <span class="text-sm font-medium">{{ updateInfo.currentVersion }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-muted">最新版本</span>
          <span class="text-sm font-medium text-info">{{ updateInfo.latestVersion }}</span>
        </div>
        
        <div class="mt-4">
          <h4 class="text-sm font-medium mb-2">更新内容</h4>
          <div class="bg-[var(--input-bg)] p-3 rounded-md overflow-y-auto max-h-40 text-sm text-[var(--foreground)]">
            <pre class="whitespace-pre-wrap">{{ updateInfo.releaseInfo?.body || '暂无更新信息' }}</pre>
          </div>
        </div>
      </div>
      
      <div class="flex items-center justify-between mb-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="ignoreUpdate" class="accent-[var(--btn-primary)]" />
          <span class="text-sm">不再提示此版本</span>
        </label>
      </div>
      
      <div class="flex gap-3">
        <button
          @click="handleClose"
          class="btn-secondary flex-1 text-sm"
        >
          取消
        </button>
        <button
          @click="handleUpdate"
          class="btn-primary flex-1 text-sm"
          :disabled="isDownloading"
        >
          确定更新
        </button>
      </div>
    </div>

    <!-- 下载进度弹窗 -->
    <div v-if="showProgressDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div class="card p-6 max-w-sm w-full mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-info-soft flex items-center justify-center">
            <svg class="w-5 h-5 text-info animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold">正在下载更新</h3>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-[var(--muted-text)]">{{ downloadProgress.received.toFixed(2) }} MB</span>
            <span class="text-[var(--muted-text)]">{{ downloadProgress.total.toFixed(2) }} MB</span>
          </div>
          <div class="w-full bg-[var(--input-bg)] rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-info rounded-full transition-all duration-300"
              :style="{ width: `${downloadProgress.percentage}%` }"
            ></div>
          </div>
          <div class="text-center text-sm text-[var(--muted-text)]">
            {{ downloadProgress.percentage }}%
          </div>
        </div>

        <div class="flex justify-center mt-4">
          <button
            @click="handleCancelDownload"
            class="btn-secondary text-sm px-6"
          >
            取消下载
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { showSuccess, showError } from '../utils/notification';

// 更新信息接口
interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  published_at: string;
  assets: ReleaseAsset[];
}

// 发行版附件接口
interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_url: string;
  browser_download_url: string;
}

// 更新检查结果接口
interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
}

// Props
const props = defineProps<{
  updateInfo?: UpdateInfo;
}>();

// Emits
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update', url: string): void;
}>();

// 不再提示更新
const ignoreUpdate = ref(false);

// 下载状态
const isDownloading = ref(false);

// 下载进度弹窗状态
const showProgressDialog = ref(false);

// 下载进度
const downloadProgress = ref({
  received: 0,
  total: 0,
  percentage: 0
});

// 格式化文件大小 (MB)
function formatSize(bytes: number): number {
  return bytes / (1024 * 1024);
}

// 处理下载进度
function handleDownloadProgress(progress: { received: number; total: number; percentage: number }) {
  downloadProgress.value = {
    received: formatSize(progress.received),
    total: formatSize(progress.total),
    percentage: progress.percentage
  };
}

// 取消下载
async function handleCancelDownload() {
  await window.electronAPI.cancelDownload();
  isDownloading.value = false;
  showProgressDialog.value = false;
  window.electronAPI.removeDownloadProgressListener();
  showError('下载已取消', '用户取消了下载');
}

// 处理关闭
async function handleClose() {
  // 如果勾选了不再提示，保存不再提示的版本号
  if (ignoreUpdate.value && props.updateInfo) {
    await window.electronAPI.saveIgnoreVersion(props.updateInfo.latestVersion);
  }
  emit('close');
}

// 处理更新
async function handleUpdate() {
  if (!props.updateInfo?.releaseInfo) {
    return;
  }

  const releaseInfo = props.updateInfo.releaseInfo;

  // 先尝试获取 exe 文件的下载链接
  let downloadUrl: string | null = null;

  if (releaseInfo.assets && releaseInfo.assets.length > 0) {
    const exeAsset = releaseInfo.assets.find(asset =>
      asset.name.endsWith('.exe') || asset.browser_download_url.endsWith('.exe')
    );
    if (exeAsset) {
      downloadUrl = exeAsset.browser_download_url || exeAsset.download_url;
    }
  }

  if (downloadUrl) {
    // 下载更新文件到本地
    isDownloading.value = true;
    showProgressDialog.value = true;
    downloadProgress.value = { received: 0, total: 0, percentage: 0 };

    // 监听下载进度
    window.electronAPI.onDownloadProgress(handleDownloadProgress);

    try {
      const result = await window.electronAPI.downloadUpdate(downloadUrl, props.updateInfo.latestVersion);
      if (result.success) {
        emit('update', result.filePath || '');
        emit('close');
        // 提示用户可以运行下载的文件进行更新
        showSuccess('下载完成', `更新文件已下载到:\n${result.filePath}\n\n请手动运行该文件进行更新。`);
      } else if (result.message !== '用户取消下载') {
        showError('下载失败', result.error || '下载更新文件失败');
      }
    } catch (error) {
      console.error('下载更新失败:', error);
      showError('下载失败', '下载更新文件失败，请重试');
    } finally {
      isDownloading.value = false;
      showProgressDialog.value = false;
      window.electronAPI.removeDownloadProgressListener();
    }
  } else {
    // 如果没有找到 exe 文件，打开发行版页面让用户手动下载
    await window.electronAPI.openUpdateUrl(releaseInfo.html_url);
    emit('update', releaseInfo.html_url);
    emit('close');
  }
}
</script>

<style scoped>
pre {
  font-family: 'Microsoft YaHei UI', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
}
</style>
