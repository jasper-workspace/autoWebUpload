<template>
  <div class="relative flex items-center h-full gap-3">
    <label class="text-sm font-semibold text-[var(--foreground)]">
      {{ label }}
    </label>

    <!-- 自定义下拉按钮 -->
    <button
      type="button"
      @click="toggleDropdown"
      class="input-field h-[2.5rem] flex-1 flex items-center justify-between px-3">
      <span
        :class="
          selectedServerName
            ? 'text-[var(--foreground)]'
            : 'text-[var(--muted-text)]'
        ">
        {{ selectedServerName || placeholder }}
      </span>
      <ChevronDown
        class="w-4 h-4 text-[var(--muted-text)] transition-transform"
        :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- 下拉选项列表 -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0">
      <div
        v-if="isOpen"
        class="absolute top-full left-20 w-[200px] mt-1 z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg overflow-hidden">
        <div class="py-1 overflow-y-auto max-h-120">
          <button
            v-for="server in serverStore.servers"
            :key="server.id"
            type="button"
            @click="selectServer(server)"
            class="w-full px-4 py-4 text-left text-sm hover:bg-[var(--scrollbar-thumb-hover)] transition-colors flex flex-col gap-1"
            :class="
              modelValue === server.id
                ? 'bg-[#409EFF]/10 text-[#409EFF]'
                : 'text-[var(--foreground)]'
            ">
            <span class="font-medium">{{ server.name }}</span>
            <span class="text-xs text-[var(--muted-text)]"
              >{{ server.host }}:{{ server.port }}</span
            >
          </button>

          <div
            v-if="serverStore.servers.length === 0"
            class="px-4 py-6 text-center text-[var(--muted-text)] text-sm">
            暂无服务器配置
          </div>
        </div>
      </div>
    </Transition>

    <!-- 点击外部关闭下拉 -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="closeDropdown"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { useServerStore } from "../stores/server";
import type { ServerConfig } from "../../shared/types";

interface Props {
  modelValue?: string;
  label?: string;
  placeholder?: string;
}

interface Emits {
  (e: "update:modelValue", value: string): void;
  (e: "change", server: ServerConfig | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  label: "目标服务器",
  placeholder: "请选择服务器",
});

const emit = defineEmits<Emits>();

const serverStore = useServerStore();
const isOpen = ref(false);

const selectedServerName = computed(() => {
  const server = serverStore.servers.find((s) => s.id === props.modelValue);
  return server?.name || "";
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function closeDropdown() {
  isOpen.value = false;
}

function selectServer(server: ServerConfig) {
  emit("update:modelValue", server.id);
  emit("change", server);
  closeDropdown();
}

// 暴露重新加载方法
defineExpose({
  reloadServers: () => serverStore.refreshIfNeeded(),
});

// 在组件挂载时加载服务器列表
onMounted(async () => {
  if (serverStore.servers.length === 0) {
    try {
      await serverStore.loadServers();
    } catch (error) {
      console.error("加载服务器列表失败:", error);
    }
  }
});
</script>
