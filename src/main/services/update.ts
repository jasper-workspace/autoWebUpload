import { createLogger } from '../logger';

const logger = createLogger('Update');

// Gitee API 配置
const GITEE_REPO_OWNER = 'just-jasper'; // 仓库所有者
const GITEE_REPO_NAME = 'auto-web-upload'; // 仓库名称
const GITEE_API_URL = `https://gitee.com/api/v5/repos/${GITEE_REPO_OWNER}/${GITEE_REPO_NAME}/releases/latest`;

// 版本信息接口
interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  published_at: string;
  assets: ReleaseAsset[];
}

// 发行版附件接口
export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  download_url: string;
  browser_download_url: string;
}

// 更新检查结果接口
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
}

/**
 * 更新服务类，负责检查和处理应用更新
 */
export class UpdateService {
  private currentVersion: string;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  /**
   * 检查是否有新版本
   * @returns 更新检查结果
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      logger.info('开始检查更新...');

      // 调用Gitee API获取最新发布版本，使用AbortController实现超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response: Response;
      try {
        response = await fetch(GITEE_API_URL, {
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const releaseInfo = await response.json() as ReleaseInfo;
      logger.debug('获取到最新版本信息', releaseInfo);

      // 提取版本号（去掉可能的前缀如v）
      const latestVersion = releaseInfo.tag_name.replace(/^v/, '');
      const currentVersion = this.currentVersion.replace(/^v/, '');

      const hasUpdate = this.isNewerVersion(latestVersion, currentVersion);


      logger.info('更新检查完成', {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseInfo: { id: releaseInfo.id, tag_name: releaseInfo.tag_name }
      });

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseInfo
      };
    } catch (error) {
      logger.error('检查更新失败', error as Error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 比较两个版本号，判断是否为新版本
   * @param latestVersion 最新版本号
   * @param currentVersion 当前版本号
   * @returns 是否为新版本
   */
  private isNewerVersion(latestVersion: string, currentVersion: string): boolean {
    const latestParts = latestVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);

    // 比较每个版本号部分
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latest = latestParts[i] || 0;
      const current = currentParts[i] || 0;

      if (latest > current) {
        return true;
      } else if (latest < current) {
        return false;
      }
    }

    return false; // 版本号相同
  }

  /**
   * 获取 Windows 安装包的下载链接
   * @param releaseInfo 发布信息
   * @returns exe文件的下载URL，如果没有则返回null
   */
  getUpdateUrl(releaseInfo: ReleaseInfo): string | null {
    if (!releaseInfo.assets || releaseInfo.assets.length === 0) {
      return null;
    }

    // 查找 .exe 文件（绿色免安装程序）
    const exeAsset = releaseInfo.assets.find(asset =>
      asset.name.endsWith('.exe') || asset.browser_download_url.endsWith('.exe')
    );

    if (exeAsset) {
      return exeAsset.browser_download_url || exeAsset.download_url;
    }

    return null;
  }

  /**
   * 获取版本更新URL（兼容方法，返回html_url）
   * @param releaseInfo 发布信息
   * @deprecated 使用 getUpdateUrl 代替
   */
  getUpdatePageUrl(releaseInfo: ReleaseInfo): string {
    return releaseInfo.html_url;
  }
}
