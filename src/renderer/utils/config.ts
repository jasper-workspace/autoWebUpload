import type { ServerConfig } from '../../shared/types';

/**
 * 将 ServerConfig 对象转换为可序列化的纯对象
 * 这是为了避免 Electron IPC 通信时的 "An object could not be cloned" 错误
 */
export function toSerializableConfig(config: ServerConfig): ServerConfig {
  // 使用 JSON.parse(JSON.stringify()) 来深度克隆对象，确保完全脱离响应式系统
  return JSON.parse(JSON.stringify({
    id: config.id,
    name: config.name,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    privateKey: config.privateKey,
    frontendPath: config.frontendPath,
    backendPath: config.backendPath,
    remotePath: config.remotePath,
    postUploadCommand: config.postUploadCommand,
    retryCount: config.retryCount,
    frontendLogCommand: config.frontendLogCommand,
    backendLogCommand: config.backendLogCommand,
    frontendPostUploadCommand: config.frontendPostUploadCommand,
    backendPostUploadCommand: config.backendPostUploadCommand
  }));
}
