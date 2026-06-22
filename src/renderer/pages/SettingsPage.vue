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
            class="text-md font-semibold text-[#409EFF] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-purple-400 to-purple-600"></div>
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
                    class="accent-[#409EFF]"
                    @change="updateTheme" />
                  <span class="text-[var(--foreground)]">深色主题</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="theme"
                    type="radio"
                    value="light"
                    class="accent-[#409EFF]"
                    @change="updateTheme" />
                  <span class="text-[var(--foreground)]">浅色主题</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="theme"
                    type="radio"
                    value="system"
                    class="accent-[#409EFF]"
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
            class="text-md font-semibold text-[#409EFF] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-blue-400 to-blue-600"></div>
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
                  class="accent-[#409EFF]"
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

        <!-- 3. 关于 -->
        <div class="section">
          <h3
            class="text-md font-semibold text-[#409EFF] mb-4 flex items-center gap-2">
            <div
              class="w-4 h-4 rounded bg-gradient-to-br from-green-400 to-green-600"></div>
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
                class="text-[#409EFF] hover:underline break-all text-left">
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
import UpdateDialog from "../components/UpdateDialog.vue";

// 主题相关
const theme = ref<"dark" | "light" | "system">("system");

// 更新相关
const autoCheckUpdate = ref(true);
const lastCheckTime = ref("");
const updateInfo = ref<any>(null);
const appVersion = ref("1.0.0");
const appAuthor = ref("");

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
