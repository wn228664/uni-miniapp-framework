import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 官方插件以 CommonJS 发布；ESM 工程需要取出其默认导出。
const createUni = typeof uni === 'function' ? uni : uni.default
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appid = process.env.UNI_MP_APPID || env.UNI_MP_APPID || ''
  if (appid && !/^wx[0-9a-f]{16}$/i.test(appid)) throw new Error('UNI_MP_APPID 格式无效')
  return {
    plugins: [
      // easycom 已负责按需组件解析；跳过 uView H5 的整库 eager 注册，避免带入未使用的动画等模块。
      // 匹配已锁定 3.8.138 的入口，升级时不匹配即失败，要求重新核对上游接入方式。
      {
        name: 'framework:uview-easycom',
        enforce: 'pre',
        transform(source, id) {
          if (process.env.UNI_PLATFORM !== 'h5' || !id.replace(/\\/g, '/').endsWith('/uview-plus/index.js'))
            return
          const pattern = /import\.meta\.glob\('\.\/components\/u-\*\/u-\*\.vue', \{ eager: true \}\)/
          if (!pattern.test(source)) throw new Error('uview-plus 入口已变化，请检查 easycom 接入')
          return { code: source.replace(pattern, '{}'), map: null }
        },
      },
      createUni(),
      {
        name: 'framework:weixin-config',
        closeBundle() {
          if (process.env.UNI_PLATFORM !== 'mp-weixin') return
          const file = resolve(process.env.UNI_OUTPUT_DIR, 'project.config.json')
          if (!existsSync(file)) return
          const config = JSON.parse(readFileSync(file, 'utf8'))
          if (appid) config.appid = appid
          config.setting = { ...config.setting, urlCheck: true }
          writeFileSync(file, JSON.stringify(config, null, 2))
        },
      },
    ],
    server: { host: '127.0.0.1', port: 5175, cors: false },
  }
})
