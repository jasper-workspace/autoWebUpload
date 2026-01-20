# 调试指南

本文档介绍如何使用项目中的调试命令和VS Code调试配置。

## NPM 调试命令

在项目根目录下，可以使用以下NPM脚本进行调试：

### 开发模式
```bash
npm run dev
```
启动开发服务器，支持热重载。

### 调试模式
```bash
npm run debug
```
以开发模式启动Vite服务器，启用调试功能。

### Electron主进程调试
```bash
npm run debug:electron
```
启动Electron应用并开启主进程调试（端口5858）。

### 渲染进程调试
```bash
npm run debug:renderer
```
以开发模式启动Vite服务器，启用渲染进程调试。

### 类型检查
```bash
npm run typecheck
```
运行TypeScript类型检查，不生成输出文件。

### 清理构建
```bash
npm run clean
```
清理所有构建输出目录（dist、dist-electron、release）。

## VS Code 调试配置

项目已配置了VS Code调试配置，可以通过VS Code的调试面板使用：

### 调试配置选项

1. **Debug Main Process**
   - 调试Electron主进程
   - 启动应用并附加Node.js调试器
   - 可以在主进程代码中设置断点

2. **Debug Renderer Process**
   - 调试渲染进程（Vue组件）
   - 附加到已启动的Chrome调试端口
   - 可以在Vue组件和JavaScript代码中设置断点

3. **Debug All Processes**
   - 同时调试主进程和渲染进程
   - 启动应用并开启两个调试端口

4. **Debug Electron App**（复合配置）
   - 同时启动主进程和渲染进程的调试会话

### 使用方法

1. 在VS Code中打开项目
2. 打开调试面板（Ctrl+Shift+D）
3. 从下拉菜单中选择调试配置
4. 点击绿色播放按钮或按F5开始调试

### 断点设置

- **主进程断点**：在`src/main/`目录下的文件中设置断点
- **渲染进程断点**：在`src/renderer/`目录下的文件中设置断点

### 调试技巧

1. **日志输出**：
   - 主进程使用`logger.info()`、`logger.error()`等
   - 渲染进程使用`console.log()`、`console.error()`等

2. **网络请求调试**：
   - 在渲染进程中可以使用Chrome开发者工具
   - 主进程中的网络请求需要通过日志查看

3. **热重载**：
   - 开发模式下，修改渲染进程代码会自动重载
   - 主进程代码修改需要重启应用

## 常见问题

### 调试器无法连接

1. 确保端口没有被占用
2. 检查防火墙设置
3. 尝试关闭其他调试会话

### 断点不生效

1. 确保源码映射正确生成
2. 检查代码是否已编译
3. 尝试重启调试会话

### 应用启动失败

1. 检查依赖是否正确安装：`npm install`
2. 尝试清理并重新构建：`npm run clean && npm run dev`
3. 查看控制台错误信息

## 生产环境调试

生产环境构建的应用调试较为困难，建议：

1. 在生产构建中保留源码映射
2. 使用日志记录关键信息
3. 使用远程调试工具（如Chrome DevTools Protocol）

## 更多资源

- [Electron调试官方文档](https://www.electronjs.org/docs/tutorial/debugging-main-process)
- [VS Code调试文档](https://code.visualstudio.com/docs/editor/debugging)
- [Vue调试技巧](https://vuejs.org/guide/scaling-up/debugging.html)