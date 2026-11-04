import { ref } from 'vue'
import { defineStore } from 'pinia'
import { platform } from '../platform/uni.js'
import { createStorage } from '../core/storage.js'
/**
 * 仅持久化非敏感外观偏好；存储写成功后更新 theme 并同步 uView。
 * setTheme 只接受 light/dark，错误向调用者抛出；必须在 main.js 完成 uView 初始化后调用。
 */
// usePreferencesStore：当前 Pinia 非敏感偏好 store 工厂，不包含凭证。
export const usePreferencesStore = defineStore(
  'preferences',
  /**
   * 读取合法主题并建立存储先行的更新动作。
   */
  () => {
    // storage：mini-framework 命名空间的同步 JSON 偏好服务。
    const storage = createStorage(platform)
    // theme：light/dark ref；持久化非法/缺失时回退 light。
    const theme = ref(storage.get('theme', 'light') === 'dark' ? 'dark' : 'light')
    /**
     * 先保存偏好，再更新 theme 并通知已初始化的 uView；失败向上抛出。
     * value：拟保存的主题，只接受 light/dark；其它输入同步抛 TypeError。
     */
    function setTheme(value) {
      if (!['light', 'dark'].includes(value)) throw new TypeError('无效主题')
      storage.set('theme', value)
      theme.value = value
      uni.$u.setThemePreference(value)
    }
    return { theme, setTheme }
  },
)
