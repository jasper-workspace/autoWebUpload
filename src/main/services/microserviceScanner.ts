
import fs from 'fs/promises';
import path from 'path';
import { MicroserviceConfig } from '../../shared/types';

/**
 * POM文件解析结果
 */
interface PomParseResult {
  artifactId: string;
  name?: string;
  packaging?: string;
  /** 是否为可部署的微服务（通过检测 spring-boot-maven-plugin 判断） */
  isDeployable: boolean;
}

/**
 * 微服务扫描服务
 * 负责扫描后端根目录，自动发现所有Maven模块
 */
export class MicroserviceScanner {
  /**
   * 扫描后端根目录，查找所有Maven模块
   * @param rootPath 后端根目录路径
   * @returns 微服务配置列表
   */
  async scanMicroservices(rootPath: string): Promise<MicroserviceConfig[]> {
    const microservices: MicroserviceConfig[] = [];

    try {
      // 检查目录是否存在
      await fs.access(rootPath);
    } catch {
      console.error(`[MicroserviceScanner] 目录不存在: ${rootPath}`);
      return [];
    }

    // 递归扫描所有pom.xml文件
    await this.scanDirectory(rootPath, rootPath, microservices);

    // 按名称排序
    microservices.sort((a, b) => (a.order || 0) - (b.order || 0));

    return microservices;
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(
    dirPath: string,
    rootPath: string,
    microservices: MicroserviceConfig[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // 跳过隐藏目录和target目录
          if (entry.name.startsWith('.') || entry.name === 'target') {
            continue;
          }

          // 检查是否是Maven模块
          const pomPath = path.join(fullPath, 'pom.xml');
          try {
            await fs.access(pomPath);
            // 找到pom.xml，解析并添加
            const pomInfo = await this.parsePom(pomPath);

            // 跳过父pom（packing为pom的）- 父pom本身不是可部署模块，但需要继续扫描子目录
            if (pomInfo.packaging === 'pom') {
              await this.scanDirectory(fullPath, rootPath, microservices);
              continue;
            }

            // 跳过artifactId为空的模块
            if (!pomInfo.artifactId) {
              continue;
            }

            // 跳过非可部署模块（没有 spring-boot-maven-plugin 的模块通常是公共库或接口定义）
            if (!pomInfo.isDeployable) {
              continue;
            }

            const relativePath = path.relative(rootPath, fullPath);
            // 使用目录名作为微服务名称，更直观
            const microserviceName = pomInfo.name || entry.name;
            const microservice: MicroserviceConfig = {
              id: this.generateId(),
              name: microserviceName,
              artifactId: pomInfo.artifactId,
              localPath: relativePath.replace(/\\/g, '/'),
              remotePath: '',  // 不设置默认远程路径，让用户自己填写
              postUploadCommand: '',
              enabled: true,
              order: microservices.length,
            };

            microservices.push(microservice);
          } catch {
            // 没有pom.xml，继续递归扫描子目录
            await this.scanDirectory(fullPath, rootPath, microservices);
          }
        }
      }
    } catch (error) {
      console.error(`[MicroserviceScanner] 扫描目录失败: ${dirPath}`, error);
    }
  }

  /**
   * 解析pom.xml文件
   * 通过检测 spring-boot-maven-plugin 判断是否为可部署的微服务
   */
  private async parsePom(pomPath: string): Promise<PomParseResult> {
    try {
      const content = await fs.readFile(pomPath, 'utf-8');

      // 简单的XML解析（避免引入额外依赖）
      const artifactIdMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
      const nameMatch = content.match(/<name>([^<]+)<\/name>/);
      const packagingMatch = content.match(/<packaging>([^<]+)<\/packaging>/);

      // 检测 spring-boot-maven-plugin - 这是判断是否为可执行微服务的关键标志
      // 只有可执行的 Spring Boot 应用才需要这个 plugin
      // 公共库（common、api、domain）只是依赖，不会打包成可执行jar
      const hasSpringBootPlugin = /<artifactId>spring-boot-maven-plugin<\/artifactId>/.test(content);

      return {
        artifactId: artifactIdMatch ? artifactIdMatch[1] : '',
        name: nameMatch ? nameMatch[1] : undefined,
        packaging: packagingMatch ? packagingMatch[1] : 'jar',
        isDeployable: hasSpringBootPlugin,
      };
    } catch (error) {
      console.error(`[MicroserviceScanner] 解析pom.xml失败: ${pomPath}`, error);
      return { artifactId: '', isDeployable: false };
    }
  }

  /**
   * 生成默认远程部署路径
   */
  private generateDefaultRemotePath(artifactId: string): string {
    // 默认部署到 /opt/app/{artifactId}
    return `/opt/app/${artifactId}`;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `ms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 检测Maven是否已安装
   */
  async checkMavenInstalled(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      execSync('mvn --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取Maven版本
   */
  async getMavenVersion(): Promise<string | null> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('mvn --version', { encoding: 'utf-8' });
      const match = output.match(/Apache Maven (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}

// 导出单例
export const microserviceScanner = new MicroserviceScanner();
