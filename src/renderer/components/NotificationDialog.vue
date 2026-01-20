<template>
  <teleport to="body">
    <transition name="notification">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click="closeNotification"
      >
        <div
          class="bg-[var(--dialog-bg)] rounded-lg p-6 max-w-md w-full mx-4 border"
          :class="getBorderClass()"
          @click.stop
        >
          <div class="flex items-center gap-3 mb-4">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="getIconClass()"
            >
              <!-- 成功图标 -->
              <svg
                v-if="type === 'success'"
                class="w-6 h-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <!-- 错误图标 -->
              <svg
                v-else-if="type === 'error'"
                class="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <!-- 警告图标 -->
              <svg
                v-else-if="type === 'warning'"
                class="w-6 h-6 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-[var(--foreground)]">
              {{ title }}
            </h3>
          </div>

          <p class="text-[var(--foreground)]">{{ message }}</p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { NotificationOptions } from '../utils/notification';

const show = ref(false);
const type = ref<'success' | 'error' | 'warning'>('success');
const title = ref('');
const message = ref('');
let timer: NodeJS.Timeout | null = null;

function closeNotification(): void {
  show.value = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

// 获取边框样式类
function getBorderClass(): string {
  switch (type.value) {
    case 'success':
      return 'border-green-500/30';
    case 'error':
      return 'border-red-500/30';
    case 'warning':
      return 'border-yellow-500/30';
    default:
      return 'border-gray-500/30';
  }
}

// 获取图标样式类
function getIconClass(): string {
  switch (type.value) {
    case 'success':
      return 'bg-green-500/20';
    case 'error':
      return 'bg-red-500/20';
    case 'warning':
      return 'bg-yellow-500/20';
    default:
      return 'bg-gray-500/20';
  }
}

// ESC键关闭
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && show.value) {
    closeNotification();
  }
});

// 暴露方法给外部调用
defineExpose({
  showNotification: (options: NotificationOptions): void => {
    // 如果已经有通知显示，先关闭并清除定时器
    if (show.value) {
      closeNotification();
    }
    
    type.value = options.type;
    title.value = options.title || '';
    message.value = options.message;
    show.value = true;
    
    // 设置自动关闭定时器（3秒后关闭）
    timer = setTimeout(() => {
      closeNotification();
    }, 1000);
  }
});
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: opacity 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
}
</style>