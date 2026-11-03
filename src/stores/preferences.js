import { ref } from 'vue'
import { defineStore } from 'pinia'
import { platform } from '../platform/uni.js'
import { createStorage } from '../core/storage.js'
/**
 * 仅持久化非敏感外观偏好；存储写成功后更新 theme 并同步 uView。
 * setTheme 只接受 light/dark，错误向调用者抛出；必须在 main.js 完成 uView 初始化后调用。
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const storage = createStorage(platform)
  const theme = ref(storage.get('theme', 'light') === 'dark' ? 'dark' : 'light')
  function setTheme(value) {
    if (!['light', 'dark'].includes(value)) throw new TypeError('无效主题')
    storage.set('theme', value)
    theme.value = value
    uni.$u.setThemePreference(value)
  }
  return { theme, setTheme }
})
