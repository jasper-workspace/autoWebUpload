<template>
  <div class="upload-window">
    <div
      class="upload-button"
      :class="{
        'drag-over': isDragOver,
        'disabled': disabled,
        'has-selection': selectedPath
      }"
      @drop="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragenter.prevent="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <!-- 使用label包装input，解决点击事件被拦截的问题 -->
      <label for="file-input" class="upload-label">
        <input
          id="file-input"
          ref="fileInput"
          type="file"
          style="display: none"
          @change="handleFileSelect"
          webkitdirectory
          directory
        />
        
        <div class="button-content">
          <div v-if="!selectedPath" class="upload-prompt">
            <UploadCloud class="upload-icon" />
            <span class="upload-text">点击上传或拖拽文件夹到此处</span>
            <span class="upload-hint">{{ deployType === 'backend' ? '后端请上传 .jar 文件' : '前端请上传 dist 目录' }}</span>
          </div>
          
          <div v-else class="selected-info">
            <FolderOpen class="folder-icon" />
            <span class="folder-name">{{ getFolderName(selectedPath) }}</span>
            <button class="clear-button" @click.stop="clearSelection">
              <X class="clear-icon" />
            </button>
          </div>
        </div>
      </label>
    </div>
    
    <div v-if="selectedPath" class="path-display">
      <span class="path-label">已选择路径:</span>
      <span class="path-text">{{ selectedPath }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { UploadCloud, FolderOpen, X } from 'lucide-vue-next';

const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
  deployType?: 'frontend' | 'backend';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'folder-error': [message: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const selectedPath = ref(props.modelValue || '');

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== selectedPath.value) {
    selectedPath.value = newValue || '';
  }
});

// 组件挂载后确保文件输入元素可用
onMounted(() => {
  // 确保文件输入元素存在并可用
  if (!fileInput.value) {
    console.warn('文件输入元素未正确挂载');
  }
});

// 处理拖拽进入事件
function handleDragEnter(e: DragEvent) {
  if (props.disabled) return;
  e.preventDefault();
  isDragOver.value = true;
}

// 处理拖拽悬停事件
function handleDragOver(e: DragEvent) {
  if (props.disabled) return;
  e.preventDefault();
}

// 处理拖拽离开事件
function handleDragLeave(e: DragEvent) {
  if (props.disabled) return;
  e.preventDefault();
  isDragOver.value = false;
}

// 处理拖拽放下事件
function handleDrop(e: DragEvent) {
  if (props.disabled) return;
  e.preventDefault();
  isDragOver.value = false;

  const files = e.dataTransfer?.files;
  
  // 检查是否拖拽了文件
  if (!files || files.length === 0) {
    emit('folder-error', '请拖拽至少一个文件或文件夹');
    return;
  }
  
  if (files && files.length > 0) {
    // 获取第一个文件夹路径
    const path = (files[0] as any).path || files[0].webkitRelativePath?.split('/')[0];
    if (path) {
      validateAndSetPath(path);
    }
  }
}

// 处理文件选择事件
function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  
  // 检查是否选择了文件
  if (!files || files.length === 0) {
    emit('folder-error', '请选择至少一个文件或文件夹');
    return;
  }
  
  if (files && files.length > 0) {    
    // 从文件路径中提取目录路径
    const filePath = (files[0] as any).path || '';
    let path = '';
    
    if (filePath) {
      // 从完整文件路径中提取目录路径
      const pathParts = filePath.split(/[/\\]/);
      // 移除文件名，保留目录部分
      pathParts.pop();
      path = pathParts.join('/');
    }
    
    // 如果没有获取到路径，尝试从webkitRelativePath获取
    if (!path && files[0].webkitRelativePath) {
      const relativeParts = files[0].webkitRelativePath.split('/');
      // 移除文件名，保留目录部分
      relativeParts.pop();
      path = relativeParts.join('/');
    }
    
    if (path) {
      validateAndSetPath(path);
    }
  }
}

// 验证并设置路径
function validateAndSetPath(path: string) {
  const isFrontend = props.deployType === 'frontend' || props.deployType === undefined;
  
  if (isFrontend) {
    // 前端：校验是否为 dist 目录
    if (!path.endsWith("dist") && !path.endsWith("dist\\")) {
      emit('update:modelValue', '');
      selectedPath.value = '';
      // 触发错误事件
      emit('folder-error', '请选择 dist 目录');
      return;
    }
  } else {
    // 后端：校验是否为 jar 文件
    if (!path.endsWith(".jar")) {
      emit('update:modelValue', '');
      selectedPath.value = '';
      // 触发错误事件
      emit('folder-error', '请选择 .jar 文件');
      return;
    }
  }
  
  emit('update:modelValue', path);
  selectedPath.value = path;
}

// 获取文件夹名称
function getFolderName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

// 清除选择
function clearSelection() {
  emit('update:modelValue', '');
  selectedPath.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}
</script>

<style scoped>
.upload-window {
  width: 100%;
}

.upload-button {
  border: 2px dashed var(--card-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--card-bg);
  position: relative;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-button:hover {
  border-color: var(--btn-primary);
  background-color: rgba(0, 217, 255, 0.05);
}

.upload-button.drag-over {
  border-color: var(--btn-primary);
  background-color: rgba(0, 217, 255, 0.1);
  transform: scale(1.02);
}

.upload-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-button.disabled:hover {
  border-color: var(--card-border);
  background-color: var(--card-bg);
  transform: none;
}

.upload-button.has-selection {
  border-color: var(--btn-primary);
  background-color: rgba(0, 217, 255, 0.1);
}

.upload-label {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.button-content {
  width: 100%;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 3rem;
  height: 3rem;
  color: var(--muted-text);
}

.upload-text {
  color: var(--foreground);
  font-size: 1rem;
  font-weight: 500;
}

.upload-hint {
  color: var(--muted-text);
  font-size: 0.875rem;
}

.selected-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(0, 217, 255, 0.1);
  border-radius: 6px;
}

.folder-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--btn-primary);
  flex-shrink: 0;
}

.folder-name {
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 500;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-text);
  transition: all 0.2s;
}

.clear-button:hover {
  background-color: rgba(0, 217, 255, 0.1);
  color: var(--foreground);
}

.clear-icon {
  width: 1rem;
  height: 1rem;
}

.path-display {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(0, 217, 255, 0.05);
  border-radius: 6px;
  border-left: 3px solid var(--btn-primary);
}

.path-label {
  display: block;
  font-size: 0.75rem;
  color: var(--muted-text);
  margin-bottom: 0.25rem;
}

.path-text {
  display: block;
  font-size: 0.875rem;
  color: var(--foreground);
  font-family: monospace;
  word-break: break-all;
}
</style>