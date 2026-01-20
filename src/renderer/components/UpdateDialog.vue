<template>
  <div v-if="updateInfo" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="handleClose">
    <div class="card p-6 max-w-md w-full mx-4" @click.stop>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-blue-500"></div>
        </div>
        <h3 class="text-lg font-semibold">发现新版本</h3>
      </div>
      
      <div class="space-y-4 mb-6">
        <div class="flex justify-between items-center">
          <span class="text-sm text-[#8C8C8C]">当前版本</span>
          <span class="text-sm font-medium">{{ updateInfo.currentVersion }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-[#8C8C8C]">最新版本</span>
          <span class="text-sm font-medium text-blue-500">{{ updateInfo.latestVersion }}</span>
        </div>
        
        <div class="mt-4">
          <h4 class="text-sm font-medium mb-2">更新内容</h4>
          <div class="bg-[#1E1E1E] p-3 rounded-md overflow-y-auto max-h-40 text-sm text-[#E0E0E0]">
            <pre class="whitespace-pre-wrap">{{ updateInfo.releaseInfo?.body || '暂无更新信息' }}</pre>
          </div>
        </div>
      </div>
      
      <div class="flex items-center justify-between mb-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="ignoreUpdate" class="accent-[#409EFF]" />
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
        >
          确定更新
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// 更新信息接口
interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  published_at: string;
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
  if (props.updateInfo?.releaseInfo?.html_url) {
    await window.electronAPI.openUpdateUrl(props.updateInfo.releaseInfo.html_url);
    emit('update', props.updateInfo.releaseInfo.html_url);
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
