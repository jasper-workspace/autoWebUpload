// 渲染进程日志工具
// 通过 IPC 将日志发送到主进程

interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  data?: any;
}

class RendererLogger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  private sendLog(level: LogEntry['level'], message: string, data?: any) {
    const logEntry: LogEntry = {
      level,
      category: this.category,
      message,
      data
    };

    // 通过 IPC 发送到主进程
    if (window.electronAPI && window.electronAPI.sendLog) {
      window.electronAPI.sendLog(logEntry);
    } else {
      // 如果 IPC 不可用，则输出到控制台
      console.log(`[${this.category}] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any) {
    this.sendLog('DEBUG', message, data);
    console.debug(`[${this.category}] ${message}`, data || '');
  }

  info(message: string, data?: any) {
    this.sendLog('INFO', message, data);
    console.info(`[${this.category}] ${message}`, data || '');
  }

  warn(message: string, data?: any) {
    this.sendLog('WARN', message, data);
    console.warn(`[${this.category}] ${message}`, data || '');
  }

  error(message: string, error?: Error | any) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;
    
    this.sendLog('ERROR', message, errorData);
    console.error(`[${this.category}] ${message}`, error || '');
  }
}

// 创建日志记录器
export const createLogger = (category: string) => {
  return new RendererLogger(category);
};

// 默认日志记录器
export const logger = createLogger('Renderer');