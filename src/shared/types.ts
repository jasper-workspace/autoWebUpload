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
  backend: BackendConfig;

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

// ==================== 微服务配置类型 ====================

/**
 * 微服务配置
 */
export interface MicroserviceConfig {
  /** 微服务唯一标识 */
  id: string;

  /** 微服务名称（显示用） */
  name: string;

  /** Maven artifactId */
  artifactId: string;

  /** 微服务本地路径（相对于后端根目录） */
  localPath: string;

  /** 远程部署路径 */
  remotePath: string;

  /** 上传后执行的命令（如重启服务、授权等） */
  postUploadCommand?: string;

  /** 日志查看命令 */
  logCommand?: string;

  /** 是否启用该微服务 */
  enabled: boolean;

  /** 排序权重（数字越小越靠前） */
  order?: number;
}

/**
 * Maven命令配置
 */
export interface MavenCommandConfig {
  /** 命令类型 */
  command: 'clean' | 'compile' | 'package' | 'install' | 'deploy';

  /** 显示名称 */
  label: string;

  /** 命令说明 */
  description: string;

  /** 是否跳过测试（默认true） */
  skipTests?: boolean;
}

/**
 * Maven命令常量
 */
export const MAVEN_COMMANDS: MavenCommandConfig[] = [
  {
    command: 'clean',
    label: 'clean',
    description: '清理target目录',
    skipTests: false,
  },
  {
    command: 'compile',
    label: 'compile',
    description: '编译源代码',
    skipTests: false,
  },
  {
    command: 'package',
    label: 'package',
    description: '打包（跳过测试）',
    skipTests: true,
  },
  {
    command: 'install',
    label: 'install',
    description: '安装到本地仓库',
    skipTests: true,
  },
  {
    command: 'deploy',
    label: 'deploy',
    description: '部署到远程仓库',
    skipTests: true,
  },
];

/**
 * 微服务构建进度
 */
export interface MicroserviceBuildProgress {
  /** 微服务ID */
  microserviceId: string;

  /** 微服务名称 */
  microserviceName: string;

  /** 当前执行的命令（Maven命令，可选） */
  command?: string;

  /** 当前阶段 */
  phase: 'pending' | 'building' | 'uploading' | 'deploying' | 'completed' | 'error';

  /** 进度百分比 0-100 */
  percentage: number;

  /** 构建日志输出 */
  output: string;

  /** 错误信息 */
  error?: string;

  /** 开始时间戳 */
  startTime?: number;

  /** 结束时间戳 */
  endTime?: number;

  /** 耗时（毫秒） */
  duration?: number;
}

/**
 * 单个微服务部署结果
 */
export interface MicroserviceDeployResult {
  /** 微服务ID */
  microserviceId: string;

  /** 微服务名称 */
  microserviceName: string;

  /** 是否成功 */
  success: boolean;

  /** 构建结果 */
  buildResult?: {
    success: boolean;
    duration: number;
    output: string;
    error?: string;
  };

  /** 上传结果 */
  uploadResult?: {
    success: boolean;
    duration: number;
    uploadedFiles: number;
    error?: string;
  };

  /** 部署命令结果 */
  deployResult?: {
    success: boolean;
    output: string;
    error?: string;
  };

  /** 错误信息 */
  error?: string;
}

/**
 * 多微服务部署结果
 */
export interface MultiMicroserviceDeployResult {
  /** 是否全部成功 */
  success: boolean;

  /** 各微服务部署结果 */
  results: MicroserviceDeployResult[];

  /** 总耗时（毫秒） */
  totalDuration: number;

  /** 失败数量 */
  failedCount: number;

  /** 成功数量 */
  successCount: number;

  /** 错误信息（可选） */
  error?: string;
}

/**
 * 后端配置扩展（支持微服务）
 * - 如果配置了微服务列表(microservices)，使用微服务部署流程
 * - 如果没有配置微服务列表，回退到旧的单项目构建流程(buildConfig)
 */
export interface BackendConfig extends DeployTargetConfig {
  /** 微服务列表（如果为空数组，则使用旧的buildConfig方式） */
  microservices: MicroserviceConfig[];

  /** 后端根目录（微服务项目根目录，用于扫描微服务） */
  rootPath: string;

  /** 自定义 Maven 路径（可选，留空则使用系统 PATH 中的 mvn） */
  mavenPath?: string;

  /** 自定义 Java 路径（可选，留空则使用系统默认 Java） */
  javaPath?: string;

  /** 是否上传 sourcemap 文件，默认 false（不上传） */
  uploadSourcemap: boolean;

  /** 是否保留已部署 jar 包（上传前重命名旧 jar），默认 true */
  keepDeployedJar: boolean;
}

/**
 * 文件上传扩展选项
 * - 由后端部署配置透传，控制 sourcemap 过滤与 jar 备份行为
 */
export interface UploadFolderOptions {
  /** 是否上传 sourcemap 文件，默认 false（不上传） */
  uploadSourcemap?: boolean;

  /** 是否保留已部署 jar 包（上传前重命名旧 jar），默认 true */
  keepDeployedJar?: boolean;
}

// ==================== 服务器验证类型 ====================

/**
 * 服务器验证结果
 */
export interface ServerValidationResult {
  /** 验证是否成功 */
  success: boolean;
  /** 错误信息（验证失败时） */
  error?: string;
  /** 连接状态 */
  connection: {
    status: 'success' | 'error' | 'unknown';
    message: string;
  };
  /** 磁盘空间状态 */
  disk: {
    status: 'success' | 'warning' | 'unknown';
    used?: string;
    message: string;
  };
  /** 目标路径状态 */
  path: {
    status: 'success' | 'warning' | 'unknown';
    message: string;
  };
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  /** 磁盘空间警告阈值（百分比），默认90 */
  diskWarningThreshold?: number;
  /** 连接超时时间（毫秒），默认10000 */
  connectionTimeout?: number;
  /** 是否自动创建路径 */
  autoCreatePath?: boolean;
}

// ==================== 配置模板类型 ====================

/**
 * 配置模板
 */
export interface ConfigTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 模板配置内容 */
  config: {
    frontend?: {
      remotePath?: string;
      postUploadCommand?: string;
      buildConfig?: {
        localPath?: string;
        buildCommand?: string;
        outputDir?: string;
      };
    };
    backend?: {
      remotePath?: string;
      postUploadCommand?: string;
      buildConfig?: {
        localPath?: string;
        buildCommand?: string;
        outputDir?: string;
      };
    };
  };
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 导入配置选项
 */
export interface ImportConfigOptions {
  /** 合并类型：replace-替换，merge-合并，skip-跳过冲突 */
  mergeType: 'replace' | 'merge' | 'skip';
}

/**
 * 导入结果
 */
export interface ImportConfigResult {
  success: boolean;
  /** 导入成功数量 */
  importedCount: number;
  /** 冲突数量 */
  conflictCount: number;
  /** 冲突详情 */
  conflicts?: Array<{
    name: string;
    existingId: string;
    importedId: string;
  }>;
  error?: string;
}
