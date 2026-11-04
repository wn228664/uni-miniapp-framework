import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import uviewPlus from 'uview-plus'
import { usePreferencesStore } from './stores/preferences.js'
import App from './App.vue'
/**
 * uni 标准入口：装配 Pinia/uView、平台字体与偏好主题，返回 app/Pinia。
 */
export function createApp() {
  // app：uni 为每个应用入口创建的 Vue SSRApp；只安装本实例的插件。
  const app = createSSRApp(App)
  // pinia：本次 createApp 的唯一 Pinia，先于 uView 主题 store 使用。
  const pinia = Pinia.createPinia()
  app.use(pinia)
  app.use(
    uviewPlus,
    /**
     * 向 uView 提供 px 单位和主题配置，不向客户端注入秘密。
     */
    () => ({
      options: { config: { unit: 'px', nativeThemeSync: true }, color: { primary: '#2864dc' } },
    }),
  )
  // H5 随包字体可离线加载；微信 loadFontFace 按平台规范使用库的 HTTPS 字体源。
  // #ifdef H5
  uni.$u.setConfig({ config: { iconUrl: '/static/uview/upicon.ttf' } })
  // #endif
  uni.$u.setThemePreference(usePreferencesStore(pinia).theme)
  return { app, Pinia }
}
