<template>
  <div class="mb-4">
    <label class="block text-sm font-semibold text-[#E0E0E0] mb-2">
      {{ label }}
    </label>
    <select
      :value="modelValue"
      @change="handleChange"
      class="input-field h-[2.5rem]"
    >
      <option value="">{{ placeholder }}</option>
      <option
        v-for="server in serverStore.servers"
        :key="server.id"
        :value="server.id"
      >
        {{ server.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useServerStore } from '../stores/server';

interface Props {
  modelValue?: string;
  label?: string;
  placeholder?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'change', server: import('../../shared/types').ServerConfig | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  label: '目标服务器',
  placeholder: '请选择服务器'
});

const emit = defineEmits<Emits>();

const serverStore = useServerStore();

// 暴露重新加载方法
defineExpose({
  reloadServers: () => serverStore.refreshIfNeeded()
});

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = target.value;

  // 触发更新事件
  emit('update:modelValue', value);

  // 触发变更事件，传递选中的服务器对象
  const selectedServer = serverStore.servers.find(s => s.id === value) || null;
  emit('change', selectedServer);
}

// 在组件挂载时加载服务器列表
onMounted(async () => {
  if (serverStore.servers.length === 0) {
    try {
      await serverStore.loadServers();
    } catch (error) {
      console.error('加载服务器列表失败:', error);
      // 可以在这里添加错误处理逻辑，比如显示错误消息
    }
  }
});
</script>
