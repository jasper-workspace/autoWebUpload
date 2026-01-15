import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 导出日志目录路径
export { logDir };

// 获取当前日期字符串
const getDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
};

// 获取当前时间字符串
const getTimeString = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
};

// 日志级别
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// 日志接口
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

// 写入日志到文件
const writeLogToFile = (logEntry: LogEntry) => {
  const logFile = path.join(logDir, `app-${getDateString()}.log`);
  const logLine = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.category}] ${logEntry.message}${logEntry.data ? ` | Data: ${JSON.stringify(logEntry.data)}` : ''}\n`;
  
  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
};

// 创建日志记录器
export const createLogger = (category: string) => {
  return {
    debug: (message: string, data?: any) => {
      const logEntry: LogEntry = {
        timestamp: getTimeString(),
        level: LogLevel.DEBUG,
        category,
        message,
        data
      };
      writeLogToFile(logEntry);
      console.debug(`[${category}] ${message}`, data || '');
    },
    info: (message: string, data?: any) => {
      const logEntry: LogEntry = {
        timestamp: getTimeString(),
        level: LogLevel.INFO,
        category,
        message,
        data
      };
      writeLogToFile(logEntry);
      console.info(`[${category}] ${message}`, data || '');
    },
    warn: (message: string, data?: any) => {
      const logEntry: LogEntry = {
        timestamp: getTimeString(),
        level: LogLevel.WARN,
        category,
        message,
        data
      };
      writeLogToFile(logEntry);
      console.warn(`[${category}] ${message}`, data || '');
    },
    error: (message: string, error?: Error | any) => {
      const logEntry: LogEntry = {
        timestamp: getTimeString(),
        level: LogLevel.ERROR,
        category,
        message,
        data: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      };
      writeLogToFile(logEntry);
      console.error(`[${category}] ${message}`, error || '');
    }
  };
};

// 默认日志记录器
export const logger = createLogger('Main');