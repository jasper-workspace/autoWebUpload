# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Linux 服务器自动部署工具 - 基于 Electron + Vue 3 + TypeScript 的 Windows 桌面应用程序，通过 SFTP 将本地文件上传到 Linux 服务器并执行部署命令。

## 常用命令

```bash
# 开发模式
npm run dev

# 生产构建 (TypeScript检查 + Vite构建 + electron-builder打包)
npm run build

# TypeScript 类型检查
npm run typecheck

# 调试 Electron 主进程
npm run debug:electron

# 调试渲染进程
npm run debug:renderer

# 清理构建产物
npm run clean
```

## 架构概览

```
src/
├── main/                          # Electron 主进程 (Node.js)
│   ├── index.ts                   # 应用入口、窗口管理、系统主题监听
│   ├── preload.ts                 # Context Bridge API 暴露
│   ├── ipc/handlers.ts            # IPC 处理器注册（新增处理器在此）
│   ├── services/
│   │   ├── sftp.ts                # SFTP 连接、文件上传、命令执行
│   │   ├── localBuild.ts          # 前端构建 (npm run build)
│   │   ├── mavenExecutor.ts       # Maven 构建执行
│   │   ├── microserviceScanner.ts # 微服务扫描 (spring-boot-maven-plugin)
│   │   ├── deployOrchestrator.ts  # 前端部署协调
│   │   ├── multiMicroserviceOrchestrator.ts  # 多微服务部署协调
│   │   ├── terminal.ts            # 交互式终端 (ssh2 Client)
│   │   └── update.ts              # Gitee 版本更新检查
│   └── logger.ts                  # electron-log 配置
├── renderer/                      # Vue 3 渲染进程
│   ├── App.vue                    # 根组件
│   ├── pages/                     # 页面组件
│   │   ├── HomePage.vue           # 前端/后端一键部署页
│   │   ├── ConfigPage.vue          # 服务器配置页
│   │   ├── LogPage.vue             # 终端日志页
│   │   └── SettingsPage.vue        # 系统设置页
│   ├── stores/                     # Pinia 状态管理
│   │   ├── server.ts              # 服务器配置状态
│   │   ├── upload.ts              # 上传进度状态
│   │   ├── log.ts                  # 日志状态
│   │   └── terminal.ts            # 终端状态
│   └── composables/                # Vue Composables
│       ├── useDeploy.ts           # 部署逻辑
│       └── useMicroservice.ts     # 微服务部署逻辑
└── shared/
    └── types.ts                   # 主进程和渲染进程共享的类型定义
```

### 配置文件
- `vite.config.ts` - Vite + Electron 构建配置
- `tsconfig.json` / `tsconfig.node.json` - TypeScript 配置
- `tailwind.config.js` - Tailwind CSS 主题配置（CSS 变量定义）

## 关键设计

### IPC 通信模式
- 主进程使用 `ipcMain.handle` 注册处理器（处理器注册在 `src/main/ipc/handlers.ts`）
- 渲染进程通过 `ipcRenderer.invoke` 调用
- 进度回调和日志流使用 `webContents.send` + `ipcRenderer.on` 实现双工通信
- Preload API 在 `src/main/preload.ts`，通过 Context Bridge 暴露为 `window.electronAPI`

### Preload API (`window.electronAPI`)

| 分类 | 方法 |
|------|------|
| 配置 | `getConfigs`, `saveConfig`, `deleteConfig`, `getConfig` |
| 主题 | `getThemeConfig`, `saveThemeConfig` |
| 上传 | `testConnection`, `uploadFolder`, `cancelUpload` |
| 构建 | `buildFrontend`, `buildBackend`, `cancelBuild` |
| 微服务 | `scanMicroservices`, `buildMicroservices` |
| 进度 | `onUploadProgress`, `onBuildProgress`, `removeUploadProgressListener` |
| 日志 | `fetchServerLogs`, `startLogStream`, `stopLogStream`, `onLogStream` |
| 终端 | `connectTerminal`, `disconnectTerminal`, `resizeTerminal`, `onTerminalData` |
| 导入导出 | `exportConfigs`, `importConfigs` |
| 更新 | `checkForUpdates`, `openUpdateUrl`, `saveIgnoreVersion` |
| 其他 | `selectFolder`, `showMessageBox`, `getAppVersion` |

### 服务器配置结构 (ServerConfig)
- 采用父子级结构：服务器包含 `frontend` 和 `backend` 两个独立的 `DeployTargetConfig`
- 每个部署目标有自己的 `remotePath`、`postUploadCommand`、`logCommand` 和 `buildConfig`
- 旧的平铺字段 (`frontendPath`, `postUploadCommand` 等) 已废弃但保留用于迁移

### SFTP 服务 (`src/main/services/sftp.ts`)
- 使用 `ssh2-sftp-client` 处理 SFTP 操作
- 使用原生 `ssh2` Client 执行 Shell 命令
- 命令执行使用 `bash -l -c` 加载登录 Shell 环境变量
- `fetchLogs` 自动将 `tail -f` 转换为 `tail -n 100`

### 构建流程
1. **前端部署**: `localBuild.ts` 执行 npm build → 产物上传 → 执行部署命令
2. **后端单体部署**: `mavenExecutor.ts` 执行 mvn package → jar上传 → 执行部署命令
3. **后端微服务部署**: `microserviceScanner.ts` 扫描 → `mavenExecutor.ts` 批量构建 → `multiMicroserviceOrchestrator.ts` 协调上传和部署

### 主题系统
- 支持 `dark` / `light` / `system` 三种主题
- 使用 CSS 变量：`var(--background)`、`var(--foreground)`
- 主进程监听 `nativeTheme` 变化自动更新

### 持久化存储 (`electron-store`)
- Windows: `%APPDATA%/auto-web-upload/server-configs.json`
- Windows: `%APPDATA%/auto-web-upload/app-configs.json`
- macOS: `~/Library/Application Support/auto-web-upload/`

## 项目特定规则

项目规则位于 `.claude/rules/` 目录，**必须遵循**:
- `my-rules.md` - 基本规则（中文回答、Windows系统、禁止新建文件等）
- `workflow-rules.md` - 工作流程（场景识别和推荐路径）
- `documents-rules.md` - 文档编写规范（输出目录、命名规则）
- `project-rules.md` - 项目开发规则
- `codegraph-rules.md` - 代码检索工具使用规则

## 类型定义位置

`src/shared/types.ts` 定义了核心类型:
- `ServerConfig` - 服务器配置（含前端/后端子配置）
- `BackendConfig` - 后端配置（支持微服务列表）
- `MicroserviceConfig` - 单个微服务配置
- `BuildProgress` / `MicroserviceBuildProgress` - 构建进度
- `UploadProgress` - 上传进度

## 构建产物

- `dist/` - Vue 渲染进程构建输出
- `dist-electron/` - Electron 主进程和 preload 构建输出
- `release/` - electron-builder 打包输出（可执行文件）