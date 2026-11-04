/** setup 内按 Pinia 会话复用服务：无业务端点、无默认业务成功码。反馈/媒体无身份，HTTP/上传/导航绑定同一会话；页面自己绑定隐藏取消与卸载释放。 */
import { createFeedback } from '../core/feedback.js'
import { createMedia } from '../core/media.js'
import { createHttp } from '../core/http.js'
import { createUpload } from '../core/upload.js'
import { createNavigation } from '../core/navigation.js'
import { useSessionStore } from '../stores/session.js'
import { platform } from '../platform/uni.js'
import { config } from '../core/config.js'
// feedback：共享的加载提示 owner 管理器；多个动作互不提前关闭遮罩。
const feedback = createFeedback(platform)
// media：无会话的图片选择/压缩适配器；每次调用返回独立任务。
const media = createMedia(platform)
// instances：以会话 store 为键的 WeakMap，复用导航互斥锁且不永久保留已销毁应用。
const instances = new WeakMap()
// routes：允许导航的四个中性页面白名单；真实页面应显式登记。
export const routes = [
  { path: '/pages/index/index' },
  { path: '/packages/showcase/components' },
  { path: '/packages/showcase/data' },
  { path: '/packages/showcase/navigation' },
]
/**
 * 在已初始化 Pinia 的 setup 中取得服务；同一会话 store 复用实例和导航锁。
 * @returns {Object} request/upload/navigation/media/feedback，具体请求/上传仍需真实服务契约。
 * 这些句柄不自动归属页面，页面任务须自行接入隐藏取消和卸载释放。
 *
 * 取得或创建当前会话专属服务，必须在 Pinia 已初始化的 setup 调用。
 */
export function useServices() {
  // session：当前 Pinia 身份 store；作为服务缓存键和请求会话版本来源。
  const session = useSessionStore()
  if (instances.has(session)) return instances.get(session)
  // services：此会话的服务集合；不自动持有页面生命周期。
  const services = {
    feedback,
    media,
    request: createHttp({ platform, baseUrl: config.apiBaseUrl, session }),
    upload: createUpload({ platform, baseUrl: config.apiBaseUrl, session }),
    navigation: createNavigation({
      platform,
      routes,
      session,
      getPages:
        /**
         * 同步读取平台页面栈，供 back 判断是否使用后备首页。
         */
        () => getCurrentPages(),
    }),
  }
  // 同一应用的组件共用导航锁，避免不同调用方同时 navigateTo。
  instances.set(session, services)
  return services
}
