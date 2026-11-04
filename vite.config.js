/** uni-app 双产物构建入口；微信 appid 从外部环境注入，域名校验始终开启，H5 依赖通过 easycom 按需解析。 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 官方插件以 CommonJS 发布；ESM 工程需要取出其默认导出。
// createUni：兼容 CommonJS 默认导出形状后的 uni-app 插件工厂。
const createUni = typeof uni === 'function' ? uni : uni.default
export default defineConfig(
  /**
   * 读取并校验外部 appid，组装 uni-app 与微信产物配置插件。
   * mode：当前 Vite 环境模式，用于选择 .env 文件。
   */
  ({ mode }) => {
    // env：当前构建模式加载的环境变量。
    const env = loadEnv(mode, process.cwd(), '')
    // appid：外部注入的微信 appid；缺失时保留模板配置，不生成虚构值。
    const appid = process.env.UNI_MP_APPID || env.UNI_MP_APPID || ''
    if (appid && !/^wx[0-9a-f]{16}$/i.test(appid)) throw new Error('UNI_MP_APPID 格式无效')
    return {
      plugins: [
        // easycom 已负责按需组件解析；跳过 uView H5 的整库 eager 注册，避免带入未使用的动画等模块。
        // 匹配已锁定 3.8.138 的入口，升级时不匹配即失败，要求重新核对上游接入方式。
        {
          name: 'framework:uview-easycom',
          enforce: 'pre',
          /**
           * 仅对 H5 的已知 uView 入口移除整库 eager 注册，保留 easycom 的按需组件路径。
           * source：插件 transform 接收到的模块原始代码。
           * id：模块实际文件标识，只匹配 uview-plus 的入口。
           */
          transform(source, id) {
            if (process.env.UNI_PLATFORM !== 'h5' || !id.replace(/\\/g, '/').endsWith('/uview-plus/index.js'))
              return
            // pattern：已锁定 uView 版本的 eager 组件注册表达式，匹配失效必须显式报错。
            const pattern = /import\.meta\.glob\('\.\/components\/u-\*\/u-\*\.vue', \{ eager: true \}\)/
            if (!pattern.test(source)) throw new Error('uview-plus 入口已变化，请检查 easycom 接入')
            return { code: source.replace(pattern, '{}'), map: null }
          },
        },
        createUni(),
        {
          name: 'framework:weixin-config',
          /**
           * 微信构建完成后写入显式 appid 并开启 urlCheck；不影响 H5 产物。
           */
          closeBundle() {
            if (process.env.UNI_PLATFORM !== 'mp-weixin') return
            // file：本次微信构建产物的 project.config.json 路径。
            const file = resolve(process.env.UNI_OUTPUT_DIR, 'project.config.json')
            if (!existsSync(file)) return
            // config：从产物读取的开发者工具配置，保留其他字段并强制域名校验。
            const config = JSON.parse(readFileSync(file, 'utf8'))
            if (appid) config.appid = appid
            config.setting = { ...config.setting, urlCheck: true }
            writeFileSync(file, JSON.stringify(config, null, 2))
          },
        },
      ],
      server: { host: '127.0.0.1', port: 5175, cors: false },
    }
  },
)
