<template>
  <div ref="terminalContainer" class="terminal-panel"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const emit = defineEmits<{
  (e: 'data', data: string): void;
  (e: 'execute', command: string): void;
}>();

const terminalContainer = ref<HTMLElement | null>(null);
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

// 终端是否准备好
const isReady = ref(false);

// 用户是否正在滚动
const isUserScrolling = ref(false);
let scrollTimeout: NodeJS.Timeout | null = null;

// 命令历史
const commandHistory: string[] = [];
let historyIndex = -1;
let currentInput = '';

// 输入状态
let inputBuffer = '';

onMounted(async () => {
  await nextTick();
  initTerminal();
});

onUnmounted(() => {
  dispose();
});

// 初始化终端
function initTerminal() {
  if (!terminalContainer.value) return;

  // 创建终端实例
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: '#000000',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#000000',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#f44747',
      green: '#608b4e',
      yellow: '#dcdcaa',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#d4d4d4',
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#608b4e',
      brightYellow: '#dcdcaa',
      brightBlue: '#569cd6',
      brightMagenta: '#c586c0',
      brightCyan: '#4ec9b0',
      brightWhite: '#ffffff',
    },
    scrollback: 1000,
    allowProposedApi: true,
  });

  // 加载 FitAddon
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // 打开终端
  terminal.open(terminalContainer.value);

  // 适应尺寸
  nextTick(() => {
    if (fitAddon) {
      fitAddon.fit();
    }
  });

  // 监听数据输入（包含普通字符和特殊按键）
  terminal.onData((data) => {
    // 上下箭头: \x1b[A, \x1b[B
    if (data === '\x1b[A') {
      // 上箭头 - 上一条历史
      handleHistoryPrev();
      return;
    }
    if (data === '\x1b[B') {
      // 下箭头 - 下一条历史
      handleHistoryNext();
      return;
    }

    // 直接发送其他所有数据（包括回车、Ctrl+C等）
    emit('data', data);

    // 如果是回车，清空输入缓冲区
    if (data === '\r') {
      inputBuffer = '';
    }
  });

  // 监听滚动事件
  terminal.onScroll(() => {
    handleScroll();
  });

  isReady.value = true;

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
}

// 处理上一条历史命令
function handleHistoryPrev() {
  if (commandHistory.length === 0) return;

  // 如果是第一次按上箭头，保存当前输入
  if (historyIndex === -1) {
    currentInput = '';
  }

  if (historyIndex < commandHistory.length - 1) {
    historyIndex++;
    const prevCommand = commandHistory[commandHistory.length - 1 - historyIndex];

    // 发送退格键清空当前行（简化处理）
    // 先发送足够多的退格
    const clearLine = '\x1b[2K\r'; // 清除整行并回到行首
    emit('data', clearLine);

    // 发送提示符和历史命令
    emit('data', prevCommand);
    currentInput = prevCommand;
  }
}

// 处理下一条历史命令
function handleHistoryNext() {
  if (historyIndex === -1) return;

  if (historyIndex > 0) {
    historyIndex--;
    const nextCommand = commandHistory[commandHistory.length - 1 - historyIndex];

    // 清除当前行
    const clearLine = '\x1b[2K\r';
    emit('data', clearLine);
    emit('data', nextCommand);
    currentInput = nextCommand;
  } else {
    // 已经到最后了，恢复空输入
    historyIndex = -1;
    const clearLine = '\x1b[2K\r';
    emit('data', clearLine);
    currentInput = '';
  }
}

// 添加到历史记录
function addToHistory(command: string) {
  if (command.trim() === '') return;

  // 避免重复添加连续相同的命令
  const lastCommand = commandHistory[commandHistory.length - 1];
  if (lastCommand !== command) {
    commandHistory.push(command);
  }

  // 重置历史索引
  historyIndex = -1;
  currentInput = '';
}

// 清空历史
function clearHistory() {
  commandHistory.length = 0;
  historyIndex = -1;
  currentInput = '';
}

// 处理滚动
function handleScroll() {
  if (!terminal) return;

  const viewportElement = terminal.element?.querySelector('.xterm-viewport');
  if (!viewportElement) return;

  const isAtBottom =
    viewportElement.scrollHeight - viewportElement.scrollTop - viewportElement.clientHeight < 50;

  if (!isAtBottom) {
    isUserScrolling.value = true;

    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      isUserScrolling.value = false;
    }, 2000);
  } else {
    isUserScrolling.value = false;
  }
}

// 处理窗口大小变化
function handleResize() {
  if (fitAddon) {
    fitAddon.fit();
  }
}

// 写入数据到终端
function write(data: string) {
  if (terminal) {
    terminal.write(data);
  }
}

// 写入一行数据
function writeln(data: string) {
  if (terminal) {
    terminal.writeln(data);
  }
}

// 清屏
function clear() {
  if (terminal) {
    terminal.clear();
  }
}

// 重置终端
function reset() {
  if (terminal) {
    terminal.reset();
  }
}

// 获取当前尺寸
function getSize(): { cols: number; rows: number } {
  if (terminal) {
    return {
      cols: terminal.cols,
      rows: terminal.rows,
    };
  }
  return { cols: 80, rows: 24 };
}

// 释放资源
function dispose() {
  window.removeEventListener('resize', handleResize);

  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }

  if (terminal) {
    terminal.dispose();
    terminal = null;
  }

  fitAddon = null;
  isReady.value = false;
}

// 暴露方法给父组件
defineExpose({
  write,
  writeln,
  clear,
  reset,
  getSize,
  dispose,
  addToHistory,
  clearHistory,
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
  background-color: #000000;
}

.terminal-panel :deep(.xterm-viewport) {
  overflow-y: auto !important;
  background-color: #000000 !important;
}

.terminal-panel :deep(.xterm-screen) {
  background-color: #000000;
}
</style>
