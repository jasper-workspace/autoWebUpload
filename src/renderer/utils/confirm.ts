// 确认对话框类型与全局注册（参照 notification.ts 的注册模式）
// author: zhanghuanjun

// 确认对话框选项
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'info';
}

// 确认对话框组件接口
export interface ConfirmComponent {
  show(options: ConfirmOptions): Promise<boolean>;
}

// 全局确认对话框引用
let confirmRef: ConfirmComponent | null = null;

// 注册确认对话框组件
export function registerConfirm(ref: ConfirmComponent): void {
  confirmRef = ref;
}

// 显示确认对话框，返回用户选择（true=确认，false=取消）
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  if (confirmRef) {
    return confirmRef.show(options);
  }
  console.error('确认对话框组件未注册');
  return Promise.resolve(false);
}
