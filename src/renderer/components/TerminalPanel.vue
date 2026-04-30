<template>
  <div ref="terminalContainer" class="terminal-panel"></div>
  <!-- 自定义右键菜单 -->
  <Teleport to="body">
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="doCopy">
        复制
      </div>
      <div class="context-menu-item" @click="doPaste">
        粘贴
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click="doSelectAll">
        全选
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const emit = defineEmits<{
  (e: 'data', data: string): void;
}>();

const terminalContainer = ref<HTMLElement | null>(null);
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

// 右键菜单状态
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

onMounted(async () => {
  await nextTick();
  initTerminal();
  document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  dispose();
});

function initTerminal() {
  if (!terminalContainer.value) return;

  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: '#000000',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      selectionBackground: '#264f78',
    },
    scrollback: 1000,
    allowProposedApi: true,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer.value);

  nextTick(() => {
    if (fitAddon) {
      fitAddon.fit();
    }
    // 在 xterm 元素上添加右键监听
    const xtermEl = terminalContainer.value?.querySelector('.xterm') as HTMLElement;
    if (xtermEl) {
      xtermEl.addEventListener('contextmenu', onContextMenu);
    }
  });

  // 监听数据输入
  terminal.onData((data) => {
    // Ctrl+V 粘贴
    if (data === '\x16') {
      doPaste();
      return;
    }
    emit('data', data);
  });
}

// 右键菜单事件处理
function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  let x = e.clientX;
  let y = e.clientY;

  // 边界检测
  const menuWidth = 120;
  const menuHeight = 140;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  if (x < 10) x = 10;
  if (y < 10) y = 10;

  contextMenuX.value = x;
  contextMenuY.value = y;
  contextMenuVisible.value = true;
}

// 关闭右键菜单
function closeContextMenu() {
  contextMenuVisible.value = false;
}

// 复制
async function doCopy() {
  const selection = terminal?.getSelection();
  if (selection) {
    try {
      await navigator.clipboard.writeText(selection);
    } catch (e) {
      console.error('复制失败:', e);
    }
  }
  closeContextMenu();
}

// 粘贴
async function doPaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      emit('data', text);
    }
  } catch (e) {
    console.error('粘贴失败:', e);
  }
  closeContextMenu();
}

// 全选
function doSelectAll() {
  terminal?.selectAll();
  closeContextMenu();
}

// 写入数据到终端
function write(data: string) {
  terminal?.write(data);
}

// 写入一行数据
function writeln(data: string) {
  terminal?.writeln(data);
}

// 清屏
function clear() {
  terminal?.clear();
}

// 获取当前尺寸
function getSize() {
  if (terminal) {
    return { cols: terminal.cols, rows: terminal.rows };
  }
  return { cols: 80, rows: 24 };
}

// 释放资源
function dispose() {
  const xtermEl = terminalContainer.value?.querySelector('.xterm') as HTMLElement;
  if (xtermEl) {
    xtermEl.removeEventListener('contextmenu', onContextMenu);
  }
  document.removeEventListener('click', closeContextMenu);

  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  fitAddon = null;
}

// 暴露方法给父组件
defineExpose({
  write,
  writeln,
  clear,
  getSize,
  dispose,
});
</script>

<style scoped>
.terminal-panel {
  width: 100%;
  height: 100%;
  background-color: #000000;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-panel :deep(.xterm) {
  padding: 8px;
  height: 100%;
}

.terminal-panel :deep(.xterm-viewport) {
  overflow-y: auto;
}

.terminal-panel :deep(.xterm-screen) {
  display: block !important;
}
</style>

<style>
/* 右键菜单样式（全局） */
.context-menu {
  position: fixed;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 9999;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #d4d4d4;
  transition: background-color 0.15s;
}

.context-menu-item:hover {
  background: #409EFF;
}

.context-menu-divider {
  height: 1px;
  background: #3c3c3c;
  margin: 4px 0;
}
</style>