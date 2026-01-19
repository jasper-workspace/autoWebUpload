import { ref } from 'vue';

// 通知类型定义
export type NotificationType = 'success' | 'error' | 'warning';

// 通知选项接口
export interface NotificationOptions {
  type: NotificationType;
  title?: string; // 标题可选
  message: string;
}

// 通知组件接口
export interface NotificationComponent {
  showNotification(options: NotificationOptions): void;
}

// 默认标题配置
const defaultTitles: Record<NotificationType, string> = {
  success: '操作成功',
  error: '操作失败',
  warning: '警告'
};

// 全局通知状态
let notificationRef: NotificationComponent | null = null;

// 注册通知组件引用
export function registerNotification(ref: NotificationComponent): void {
  notificationRef = ref;
}

// 显示通知
export function showNotification(options: NotificationOptions): void {
  if (notificationRef) {
    // 如果没有提供title，使用默认值
    const notificationOptions = {
      ...options,
      title: options.title ?? defaultTitles[options.type]
    };
    notificationRef.showNotification(notificationOptions);
  } else {
    console.error('通知组件未注册');
  }
}

// 便捷方法
export function showSuccess(title: string | undefined, message: string): void {
  showNotification({ type: 'success', title, message });
}

export function showError(title: string | undefined, message: string): void {
  showNotification({ type: 'error', title, message });
}

export function showWarning(title: string | undefined, message: string): void {
  showNotification({ type: 'warning', title, message });
}