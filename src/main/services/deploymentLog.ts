import type { UploadFolderOptions } from '../../shared/types';

/** 日志级别（与 sftp.ts 的 LogType 保持一致） */
type LogLevel = 'info' | 'error' | 'warning' | 'success' | 'config';

/**
 * 部署选项日志描述符
 * 将某一项部署设置（UploadFolderOptions 字段）映射为人类可读的标签与值格式化器。
 *
 * 设计原则（开闭原则）：新增部署设置时，只需在 deploymentOptionDescriptors 中追加一项，
 * 命令/结果打印方法 logDeploymentCommand / logDeploymentResult 无需任何改动，日志即自动生效。
 */
export interface DeploymentOptionDescriptor {
  /** 对应 UploadFolderOptions 的字段名 */
  key: keyof UploadFolderOptions;
  /** 人类可读标签（日志输出使用） */
  label: string;
  /** 将选项值格式化为可读字符串 */
  format: (value: any) => string;
}

/**
 * 全量部署选项描述符。
 * 新增设置时在此数组追加一项即可，日志逻辑自动覆盖。
 */
export const deploymentOptionDescriptors: DeploymentOptionDescriptor[] = [
  {
    key: 'uploadSourcemap',
    label: '是否上传 sourcemap',
    format: (v) => (v === true ? '是' : '否'),
  },
  {
    key: 'keepDeployedJar',
    label: '是否保留已部署 jar 包',
    format: (v) => (v === false ? '否' : '是'),
  },
  {
    key: 'keepJarCount',
    label: '远端保留 jar 数量',
    format: (v) => `${typeof v === 'number' ? v : 0}`,
  },
  {
    key: 'deleteBesFiles',
    label: '删除远端 bes 文件',
    format: (v) => (v === true ? '是' : '否'),
  },
];

/** 根据字段名获取描述符，便于在清理流程中复用统一标签 */
export function getDeploymentOptionDescriptor(key: keyof UploadFolderOptions): DeploymentOptionDescriptor | undefined {
  return deploymentOptionDescriptors.find((d) => d.key === key);
}

/**
 * 计算字符串显示宽度：CJK / 全角字符计为 2，其余计为 1。
 * 用于在等宽终端/日志面板中对齐中文与英文混排的内容。
 */
function displayWidth(s: string): number {
  let width = 0;
  for (const ch of s) {
    width += ch.codePointAt(0)! > 0xff ? 2 : 1;
  }
  return width;
}

/**
 * 按显示宽度右补空格，避免中文占用双列导致冒号错位。
 */
function padEndDisplay(s: string, target: number): string {
  const pad = Math.max(0, target - displayWidth(s));
  return s + ' '.repeat(pad);
}

/** 所有描述符中标签的最大显示宽度（用于冒号对齐） */
function maxLabelWidth(): number {
  return deploymentOptionDescriptors.reduce((max, d) => Math.max(max, displayWidth(d.label)), 0);
}

/**
 * 打印单个部署选项的「命令」行（如：是否上传 sourcemap : 否），config 级别着色。
 * 与 logDeploymentResult 配对，构成「命令 + 操作结果」完整执行单元。
 * @param logFn 日志函数（如 emitLog），第二参数为日志级别
 * @param options 部署选项
 * @param key 选项字段名
 */
export function logDeploymentCommand(
  logFn: (message: string, type?: LogLevel) => void,
  options: UploadFolderOptions | undefined,
  key: keyof UploadFolderOptions
): void {
  const descriptor = getDeploymentOptionDescriptor(key);
  if (!descriptor) {
    return;
  }
  const value = options ? (options as Record<string, any>)[key] : undefined;
  logFn(`  ${padEndDisplay(descriptor.label, maxLabelWidth())} : ${descriptor.format(value)}`, 'config');
}

/**
 * 打印「操作结果」行（如：操作结果: 已删除 bes 文件: /path/bes.x），默认 config 级别着色。
 * 与 logDeploymentCommand 配对，构成「命令 + 操作结果」完整执行单元。
 * @param logFn 日志函数（如 emitLog），第二参数为日志级别
 * @param message 结果描述
 * @param type 日志级别（默认 config；失败时传 error）
 */
export function logDeploymentResult(
  logFn: (message: string, type?: LogLevel) => void,
  message: string,
  type: LogLevel = 'config'
): void {
  logFn(`  操作结果: ${message}`, type);
}
