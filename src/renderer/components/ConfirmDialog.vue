<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div
        v-if="visible"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click="handleCancel"
      >
        <div
          class="bg-[var(--dialog-bg)] rounded-lg p-6 max-w-md w-full mx-4 border border-[var(--card-border)]"
          @click.stop
        >
          <div class="flex items-center gap-3 mb-4">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="iconBgClass"
            >
              <!-- 警告图标 -->
              <svg
                v-if="type === 'warning'"
                class="w-6 h-6 text-warning"
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
              <!-- 信息图标 -->
              <svg
                v-else
                class="w-6 h-6 text-info"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-[var(--foreground)]">
              {{ title }}
            </h3>
          </div>

          <p class="text-sm text-[var(--muted-text)] mb-6 whitespace-pre-line">
            {{ message }}
          </p>

          <div class="flex justify-end gap-3">
            <button class="btn-secondary text-sm" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn-primary text-sm" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ConfirmOptions } from '../utils/confirm';

const visible = ref(false);
const title = ref('');
const message = ref('');
const confirmText = ref('确认');
const cancelText = ref('取消');
const type = ref<'warning' | 'info'>('warning');

// 解析 Promise 的回调
let resolver: ((value: boolean) => void) | null = null;

// 图标背景随类型变化（使用主题变量）
const iconBgClass = computed(() =>
  type.value === 'warning' ? 'bg-warning-soft' : 'bg-info-soft'
);

// 显示确认对话框，返回用户选择
function show(options: ConfirmOptions): Promise<boolean> {
  title.value = options.title || '提示';
  message.value = options.message;
  confirmText.value = options.confirmText || '确认';
  cancelText.value = options.cancelText || '取消';
  type.value = options.type || 'warning';
  visible.value = true;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

function handleConfirm(): void {
  visible.value = false;
  resolver?.(true);
  resolver = null;
}

function handleCancel(): void {
  visible.value = false;
  resolver?.(false);
  resolver = null;
}

defineExpose({ show });
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
