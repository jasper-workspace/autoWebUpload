# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目概述

Linux 服务器自动部署工具 - 基于 Electron + Vue 3 + TypeScript 的 Windows 桌面应用程序，用于通过 SFTP 将本地文件上传到 Linux 服务器并执行权限设置命令。

## 常用命令

```bash
# 开发模式（启动 Vite dev server 和 Electron）
npm run dev

# 生产构建（TypeScript 检查 + Vite 构建 + electron-builder 打包）
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
├── main/                    # Electron 主进程
│   ├── index.ts             # 应用入口、窗口管理、系统主题监听
│   ├── preload.ts           # Context Bridge API 暴露
│   ├── ipc/handlers.ts      # IPC 处理器注册（配置/SFTP/日志/更新）
│   ├── services/
│   │   ├── sftp.ts          # SFTP 连接、文件上传、命令执行
│   │   └── update.ts        # Gitee 版本更新检查
│   └── logger.ts            # electron-log 配置
├── renderer/                # Vue 3 渲染进程
│   ├── App.vue              # 根组件、全局布局
│   ├── main.ts              # 渲染进程入口
│   ├── router/index.ts      # Vue Router 配置
│   ├── stores/              # Pinia 状态管理
│   │   ├── server.ts        # 服务器配置状态
│   │   ├── upload.ts        # 上传进度状态
│   │   └── log.ts           # 日志状态
│   ├── pages/               # 页面组件
│   │   ├── HomePage.vue     # 文件部署页
│   │   ├── ConfigPage.vue   # 服务器配置页
│   │   ├── LogPage.vue      # 日志查看页
│   │   └── SettingsPage.vue # 系统设置页
│   ├── components/           # 公共组件
│   └── utils/               # 工具函数
└── shared/
    └── types.ts             # 主进程和渲染进程共享的类型定义
```

## 关键设计

### IPC 通信模式
- 主进程通过 `ipcMain.handle` 注册处理器，渲染进程通过 `ipcRenderer.invoke` 调用
- 进度回调和日志流使用 `webContents.send` + `ipcRenderer.on` 实现双工通信
- Preload API 定义在 `src/main/preload.ts`，通过 Context Bridge 暴露为 `window.electronAPI`

### Preload API 一览
```
配置: getConfigs, saveConfig, deleteConfig, getConfig
主题: getThemeConfig, saveThemeConfig
上传: testConnection, uploadFolder, cancelUpload
进度: onUploadProgress, removeUploadProgressListener
日志: fetchServerLogs, startLogStream, stopLogStream, onLogStream, onLogStreamError
导入导出: exportConfigs, importConfigs
更新: checkForUpdates, openUpdateUrl, saveIgnoreVersion
其他: selectFolder, showMessageBox, getAppVersion, sendLog
```

### SFTP 服务 (`src/main/services/sftp.ts`)
- 使用 `ssh2-sftp-client` 处理 SFTP 操作
- 使用原生 `ssh2` Client 执行 Shell 命令
- 命令执行使用 `bash -l -c` 加载登录 Shell 环境变量
- `fetchLogs` 自动将 `tail -f` 转换为 `tail -n 100`
- 单文件上传使用模拟进度（每秒+2%，直到95%）

### 状态管理
- Pinia stores 管理服务器配置、上传进度、日志状态
- `electron-store` 持久化存储：
  - `server-configs.json` - 服务器配置
  - `app-configs.json` - 主题和更新配置
- 主进程全局状态：`isUploading`、`logStreamSftp`、`logStreamActive`

### 主题系统
- 支持 dark/light/system 三种主题
- 使用 CSS 变量 `var(--background)`、`var(--foreground)`
- 主进程监听 `nativeTheme` 变化自动更新

### 更新服务 (`src/main/services/update.ts`)
- 从 Gitee API 检查版本更新
- 支持忽略特定版本

## 类型定义

`src/shared/types.ts` 中定义了核心类型：

```typescript
ServerConfig {
  id, name, host, port, username,
  password?, privateKey?,
  frontendPath, backendPath,
  remotePath?, postUploadCommand?,
  frontendPostUploadCommand?, backendPostUploadCommand?,
  frontendLogCommand?, backendLogCommand?
}

UploadProgress {
  totalFiles, uploadedFiles, currentFile,
  percentage, status: 'uploading' | 'success' | 'error' | 'canceled'
}

ConnectionTestResult { success, message, time? }
```

## 构建产物

- `dist/` - Vue 渲染进程构建输出
- `dist-electron/` - Electron 主进程和 preload 构建输出
- `release/` - electron-builder 打包输出（可执行文件）
