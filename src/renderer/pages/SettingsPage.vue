<template>
  <div class="flex flex-col h-full">
    <div class="p-5 overflow-y-auto card">
      <h2 class="text-sm font-semibold text-[var(--foreground)] mb-4">
        系统设置
      </h2>

      <div class="space-y-6">
        <!-- 1. 主题设置 -->
        <div class="section">
          <h3
            class="text-md font-semibold text-[var(--btn-primary)] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-[var(--border-tech-start)] to-[var(--border-tech-end)]"></div>
            主题设置
          </h3>
          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                系统风格
              </label>
              <div class="flex flex-col gap-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="theme"
                    type="radio"
                    value="dark"
                    class="accent-[var(--btn-primary)]"
                    @change="updateTheme" />
                  <span class="text-[var(--foreground)]">深色主题</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="theme"
                    type="radio"
                    value="light"
                    class="accent-[var(--btn-primary)]"
                    @change="updateTheme" />
                  <span class="text-[var(--foreground)]">浅色主题</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="theme"
                    type="radio"
                    value="system"
                    class="accent-[var(--btn-primary)]"
                    @change="updateTheme" />
                  <span class="text-[var(--foreground)]">跟随系统</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 更新设置 -->
        <div class="section">
          <h3
            class="text-md font-semibold text-[var(--btn-primary)] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-[var(--border-tech-start)] to-[var(--border-tech-end)]"></div>
            更新设置
          </h3>
          <div class="space-y-4">
            <div>
              <label
                class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                自动检查更新
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model="autoCheckUpdate"
                  type="checkbox"
                  class="accent-[var(--btn-primary)]"
                  @change="updateAutoCheckUpdate" />
                <span class="text-[var(--foreground)]"
                  >应用启动时自动检查更新</span
                >
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button @click="checkForUpdates" class="text-sm btn-primary">
                立即检查更新
              </button>
              <span class="text-xs text-[var(--muted-text)]"
                >上次检查: {{ lastCheckTime || "从未检查" }}</span
              >
            </div>
          </div>
        </div>

        <!-- 部署选项（全局） -->
        <div class="section">
          <h3
            class="text-md font-semibold text-[var(--btn-primary)] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-[var(--border-tech-start)] to-[var(--border-tech-end)]"></div>
            部署选项
          </h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                关闭时不上传 sourcemap 文件
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model="deployUploadSourcemap"
                  type="checkbox"
                  class="accent-[var(--btn-primary)]" />
                <span class="text-[var(--foreground)]">是否上传 sourcemap</span>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                勾选时上传前备份旧 jar 包
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model="deployKeepDeployedJar"
                  type="checkbox"
                  class="accent-[var(--btn-primary)]" />
                <span class="text-[var(--foreground)]">是否保留已部署 jar 包</span>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                0=不处理；1-9=上传成功后保留最新的同名 jar 包数量
              </label>
              <div class="flex items-center gap-3">
                <span class="text-[var(--foreground)]">远端保留 jar 包数量</span>
                <input
                  v-model.number="deployKeepJarCount"
                  type="number"
                  min="0"
                  max="9"
                  class="input-field w-32"
                  placeholder="0" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--muted-text)] mb-2">
                勾选时上传前清理远端目录下的 bes.* 文件
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model="deployDeleteBesFiles"
                  type="checkbox"
                  class="accent-[var(--btn-primary)]" />
                <span class="text-[var(--foreground)]">上传前删除 bes.* 文件</span>
              </div>
            </div>

            <div class="pt-2">
              <button @click="saveDeploymentOptions" class="text-sm btn-primary">
                保存部署选项
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 关于 -->
        <div class="section">
          <h3
            class="text-md font-semibold text-[var(--btn-primary)] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-[var(--border-tech-start)] to-[var(--border-tech-end)]"></div>
            关于
          </h3>
          <div class="space-y-3 text-sm">
            <div class="flex items-center gap-3">
              <span class="text-[var(--muted-text)] w-20">作者:</span>
              <span class="text-[var(--foreground)]">{{
                appAuthor || "未知"
              }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[var(--muted-text)] w-20">版本:</span>
              <span class="text-[var(--foreground)]">v{{ appVersion }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[var(--muted-text)] w-20">开源协议:</span>
              <span class="text-[var(--foreground)]">MIT License</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-[var(--muted-text)] w-20">项目地址:</span>
              <button
                @click="openProjectUrl"
                class="text-[var(--btn-primary)] hover:underline break-all text-left">
                https://gitee.com/just-jasper/auto-web-upload
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新信息弹窗 -->
    <UpdateDialog
      v-if="updateInfo"
      :updateInfo="updateInfo"
      @close="updateInfo = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { showSuccess, showError } from "../utils/notification";
import { showConfirm } from "../utils/confirm";
import UpdateDialog from "../components/UpdateDialog.vue";

// 主题相关
const theme = ref<"dark" | "light" | "system">("system");

// 更新相关
const autoCheckUpdate = ref(true);
const lastCheckTime = ref("");
const updateInfo = ref<any>(null);
const appVersion = ref("1.0.0");
const appAuthor = ref("");

// 部署选项（全局）
const deployUploadSourcemap = ref(false);
const deployKeepDeployedJar = ref(true);
const deployKeepJarCount = ref(0);
const deployDeleteBesFiles = ref(false);

// 加载部署选项
async function loadDeploymentOptions() {
  try {
    const config = await window.electronAPI.getDeploymentConfig();
    deployUploadSourcemap.value = config.uploadSourcemap !== false;
    deployKeepDeployedJar.value = config.keepDeployedJar !== false;
    deployKeepJarCount.value = Math.min(9, Math.max(0, Math.floor(Number(config.keepJarCount) || 0)));
    deployDeleteBesFiles.value = !!config.deleteBesFiles;
  } catch (error) {
    console.error("加载部署选项失败:", error);
  }
}

// 保存部署选项
async function saveDeploymentOptions() {
  // 风险告知：开启了任何破坏性选项时二次确认
  if (deployKeepJarCount.value > 0 || deployDeleteBesFiles.value) {
    const confirmed = await showConfirm({
      type: "warning",
      title: "风险提示",
      message: "部署选项包含破坏性操作（远端 jar 包清理 / 删除 bes 文件）。确认保存并应用？",
      confirmText: "确认保存",
      cancelText: "取消",
    });
    if (!confirmed) {
      return;
    }
  }
  try {
    await window.electronAPI.saveDeploymentConfig({
      uploadSourcemap: deployUploadSourcemap.value,
      keepDeployedJar: deployKeepDeployedJar.value,
      keepJarCount: Math.min(9, Math.max(0, Math.floor(Number(deployKeepJarCount.value) || 0))),
      deleteBesFiles: deployDeleteBesFiles.value,
    });
    showSuccess("操作成功", "部署选项已保存！");
  } catch (error) {
    console.error("保存部署选项失败:", error);
    showError("操作失败", "保存部署选项失败，请重试");
  }
}

// 更新主题
async function updateTheme() {
  try {
    await window.electronAPI.saveThemeConfig(theme.value);
    applyTheme(theme.value);
    showSuccess("操作成功", "主题设置已保存！");
  } catch (error) {
    console.error("保存主题失败:", error);
    showError("操作失败", "保存主题失败，请重试");
  }
}

// 应用主题
function applyTheme(themeMode: "dark" | "light" | "system") {
  document.documentElement.setAttribute("data-theme", themeMode);
}

// 加载主题配置
async function loadThemeConfig() {
  try {
    const savedTheme = await window.electronAPI.getThemeConfig();
    // 类型断言，确保savedTheme是有效的主题类型
    theme.value = savedTheme as "dark" | "light" | "system";
    applyTheme(savedTheme as "dark" | "light" | "system");
  } catch (error) {
    console.error("加载主题配置失败:", error);
  }
}

// 更新自动检查更新设置
async function updateAutoCheckUpdate() {
  try {
    await window.electronAPI.saveUpdateConfig({
      autoCheckUpdate: autoCheckUpdate.value,
    });
    showSuccess("操作成功", "更新设置已保存！");
  } catch (error) {
    console.error("保存更新设置失败:", error);
    showError("操作失败", "保存更新设置失败，请重试");
  }
}

// 加载更新配置
async function loadUpdateConfig() {
  try {
    const config = await window.electronAPI.getUpdateConfig();
    autoCheckUpdate.value = config.autoCheckUpdate !== false; // 默认为true

    if (config.lastCheck) {
      const date = new Date(config.lastCheck);
      lastCheckTime.value = date.toLocaleString();
    }
  } catch (error) {
    console.error("加载更新配置失败:", error);
  }
}

// 手动检查更新
async function checkForUpdates() {
  try {
    const result = await window.electronAPI.checkForUpdates();

    if (result.hasUpdate) {
      // 有更新，显示更新信息弹窗
      updateInfo.value = result;
    } else if (result.ignored) {
      // 已忽略此版本
      showSuccess("检查完成", "已是最新版本或已忽略当前版本");
    } else {
      // 没有更新
      showSuccess("检查完成", "已是最新版本");
    }

    // 更新最后检查时间
    const now = new Date();
    lastCheckTime.value = now.toLocaleString();

    // 保存最后检查时间
    await window.electronAPI.saveUpdateConfig({
      autoCheckUpdate: autoCheckUpdate.value,
      lastCheck: now.getTime(),
    });
  } catch (error) {
    console.error("检查更新失败:", error);
    showError("操作失败", "检查更新失败，请重试");
  }
}

// 打开项目地址
async function openProjectUrl() {
  await window.electronAPI.openUpdateUrl("https://gitee.com/just-jasper/auto-web-upload");
}

// 获取版本信息
const loadAuthorAndVersionInfo = async () => {
  try {
    const info = await window.electronAPI.getAppInfo();
    appVersion.value = info.version;
    appAuthor.value = info.author;
  } catch (error) {
    console.error("获取应用信息失败:", error);
  }
};

onMounted(async () => {
  loadThemeConfig();
  loadUpdateConfig();
  loadAuthorAndVersionInfo();
  loadDeploymentOptions();
});
</script>

<style scoped>
.section {
  padding: 20px;
  border-radius: 8px;
  transition: all 0.2s;
}

.section:hover {
  background: rgba(64, 158, 255, 0.05);
}
</style>
