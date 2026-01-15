<template>
  <div class="h-screen flex flex-col bg-[#1E1E1E]">
    <!-- 顶部导航栏 -->
    <header class="h-16 flex-shrink-0 bg-[#252525] border-b border-[#3C3C3C] flex items-center px-6 z-50">
      <div class="flex items-center gap-3">
        <!-- <div class="w-8 h-8 bg-gradient-to-br from-[#409EFF] to-[#0066E6] rounded-lg flex items-center justify-center">
          <UploadCloud class="w-5 h-5 text-white" />
        </div> -->
        <h1 class="text-xl font-semibold text-[#E0E0E0]">Linux 服务器自动部署工具</h1>
      </div>
      <div class="flex gap-2 ml-auto">
        <button
          @click="handleTabChange('upload')"
          :class="[
            'px-6 py-2 rounded-lg font-medium transition-all duration-200',
            currentTab === 'upload'
              ? 'bg-[#409EFF] text-white'
              : 'text-[#B0B0B0] hover:text-[#E0E0E0] hover:bg-[#3C3C3C]'
          ]"
        >
          文件部署
        </button>
        <button
          @click="handleTabChange('config')"
          :class="[
            'px-6 py-2 rounded-lg font-medium transition-all duration-200',
            currentTab === 'config'
              ? 'bg-[#409EFF] text-white'
              : 'text-[#B0B0B0] hover:text-[#E0E0E0] hover:bg-[#3C3C3C]'
          ]"
        >
          服务器配置
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 px-6 py-4 overflow-auto">
      <keep-alive>
        <UploadPage v-if="currentTab === 'upload'" ref="uploadPageRef" />
      </keep-alive>
      <ConfigPage v-if="currentTab === 'config'" />
    </main>

    <!-- 确认对话框 -->
    <div
      v-if="showConfirmDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-[#2C2C2C] rounded-lg p-6 max-w-md border border-[#3C3C3C] shadow-2xl">
        <h3 class="text-lg font-semibold text-[#E0E0E0] mb-4">确认切换页面</h3>
        <p class="text-[#B0B0B0] mb-6">
          上传正在进行中，切换页面将导致上传中断，确定要切换吗？
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="showConfirmDialog = false"
            class="px-4 py-2 rounded-lg text-[#B0B0B0] hover:bg-[#3C3C3C] transition-all duration-200"
          >
            取消
          </button>
          <button
            @click="confirmTabChange"
            class="px-4 py-2 rounded-lg bg-[#F56C6C] hover:bg-[#D64A4A] text-white transition-all duration-200"
          >
            确定切换
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { UploadCloud } from 'lucide-vue-next';
import UploadPage from './pages/UploadPage.vue';
import ConfigPage from './pages/ConfigPage.vue';
import { logger } from './utils/logger';

const currentTab = ref<'upload' | 'config'>('upload');
const showConfirmDialog = ref(false);
const pendingTab = ref<'upload' | 'config' | null>(null);
const uploadPageRef = ref<InstanceType<typeof UploadPage> | null>(null);

function handleTabChange(tab: 'upload' | 'config') {
  // 如果切换到同一个标签，不做处理
  if (currentTab.value === tab) return;

  // 如果当前是上传页面，检查是否正在上传
  if (currentTab.value === 'upload' && uploadPageRef.value) {
    const isUploading = (uploadPageRef.value as any).isUploading?.() ?? false;

    if (isUploading) {
      pendingTab.value = tab;
      showConfirmDialog.value = true;
      return;
    }
  }

  currentTab.value = tab;
}

function confirmTabChange() {
  if (pendingTab.value) {
    // 停止上传
    if (currentTab.value === 'upload' && uploadPageRef.value) {
      (uploadPageRef.value as any).cancelUpload?.();
    }

    currentTab.value = pendingTab.value;
    showConfirmDialog.value = false;
    pendingTab.value = null;
  }
}

onMounted(() => {
  logger.info('App 组件已挂载');
});
</script>
