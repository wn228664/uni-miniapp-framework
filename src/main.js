import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import uviewPlus from 'uview-plus'
import { usePreferencesStore } from './stores/preferences.js'
import App from './App.vue'
export function createApp() {
  const app = createSSRApp(App)
  const pinia = Pinia.createPinia()
  app.use(pinia)
  app.use(uviewPlus, () => ({
    options: { config: { unit: 'px', nativeThemeSync: true }, color: { primary: '#2864dc' } },
  }))
  // H5 随包字体可离线加载；微信 loadFontFace 按平台规范使用库的 HTTPS 字体源。
  // #ifdef H5
  uni.$u.setConfig({ config: { iconUrl: '/static/uview/upicon.ttf' } })
  // #endif
  uni.$u.setThemePreference(usePreferencesStore(pinia).theme)
  return { app, Pinia }
}
