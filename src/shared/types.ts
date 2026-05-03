// ==================== 服务器配置类型（父子级结构） ====================

/**
 * 部署目标配置（前端或后端子配置）
 */
export interface DeployTargetConfig {
  /** 部署类型 */
  type: 'frontend' | 'backend';

  /** 部署路径 */
  remotePath: string;

  /** 上传后执行的命令 */
  postUploadCommand?: string;

  /** 日志查看命令 */
  logCommand?: string;

  /** 构建配置（自动部署用） */
  buildConfig?: BuildConfig;

  /** 是否启用自动部署 */
  enabled?: boolean;
}

/**
 * 服务器完整配置（父子级结构）
 * - 一个服务器包含前端和后端两个独立的部署目标
 * - 每个部署目标拥有自己的路径、命令和构建配置
 * - 基础连接信息保持平铺以向后兼容
 */
export interface ServerConfig {
  // ==================== 基础连接信息（向后兼容） ====================
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  retryCount?: number;

  // ==================== 前端配置 ====================
  frontend: DeployTargetConfig;

  // ==================== 后端配置 ====================
  backend: DeployTargetConfig;

  // ==================== 旧的平铺字段（保留用于迁移） ====================
  /** @deprecated 请使用 frontend.remotePath */
  frontendPath?: string;
  /** @deprecated 请使用 backend.remotePath */
  backendPath?: string;
  /** @deprecated 请使用 frontend.postUploadCommand */
  frontendPostUploadCommand?: string;
  /** @deprecated 请使用 backend.postUploadCommand */
  backendPostUploadCommand?: string;
  /** @deprecated 请使用 frontend.logCommand */
  frontendLogCommand?: string;
  /** @deprecated 请使用 backend.logCommand */
  backendLogCommand?: string;
  /** @deprecated 请使用 frontend.buildConfig */
  postUploadCommand?: string;
  remotePath?: string;
}

export interface UploadProgress {
  totalFiles: number;
  uploadedFiles: number;
  currentFile: string;
  percentage: number;
  status: 'uploading' | 'success' | 'error' | 'canceled';
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  time?: number;
}

// ==================== 终端类型 ====================

export interface TerminalState {
  isConnected: boolean;
  currentServerId: string | null;
  commandHistory: string[];
  historyIndex: number;
  prompt: string;
}

export interface TerminalConnectOptions {
  serverId: string;
  cols: number;
  rows: number;
}

export interface TerminalResizeOptions {
  cols: number;
  rows: number;
}

// ==================== 构建配置类型 ====================

/**
 * 构建配置
 */
export interface BuildConfig {
  /** 构建类型: 前端或后端 */
  type: 'frontend' | 'backend';

  /** 项目本地路径 (绝对路径) */
  localPath: string;

  /** 打包命令 */
  buildCommand: string;

  /** 环境变量 */
  envVars?: Record<string, string>;

  /** 产物目录 (相对于 localPath，留空则自动检测) */
  outputDir?: string;

  /** 构建失败时是否停止部署 */
  stopOnBuildFailure: boolean;
}

/**
 * 构建进度
 */
export interface BuildProgress {
  /** 当前阶段: 'building' | 'uploading' | 'deploying' | 'completed' */
  phase: 'building' | 'uploading' | 'deploying' | 'completed';

  /** 子阶段描述 */
  step: string;

  /** 进度百分比 0-100 */
  percentage: number;

  /** 状态 */
  status: 'building' | 'success' | 'error' | 'canceled';

  /** 输出内容 */
  output?: string;

  /** 错误信息 */
  error?: string;
}

/**
 * 部署任务结果
 */
export interface DeployResult {
  success: boolean;

  /** 构建类型 */
  type: 'frontend' | 'backend';

  /** 构建结果 */
  build?: {
    success: boolean;
    duration: number;
    output: string;
    error?: string;
  };

  /** 上传结果 */
  upload?: {
    success: boolean;
    duration: number;
    error?: string;
  };

  /** 部署命令结果 */
  deploy?: {
    success: boolean;
    output: string;
    error?: string;
  };

  /** 总耗时 */
  totalDuration: number;

  /** 错误信息 */
  error?: string;
}
