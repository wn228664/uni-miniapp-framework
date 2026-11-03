import { createFeedback } from '../core/feedback.js'
import { createMedia } from '../core/media.js'
import { createHttp } from '../core/http.js'
import { createUpload } from '../core/upload.js'
import { createNavigation } from '../core/navigation.js'
import { useSessionStore } from '../stores/session.js'
import { platform } from '../platform/uni.js'
import { config } from '../core/config.js'
const feedback = createFeedback(platform)
const media = createMedia(platform)
const instances = new WeakMap()
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
 */
export function useServices() {
  const session = useSessionStore()
  if (instances.has(session)) return instances.get(session)
  const services = {
    feedback,
    media,
    request: createHttp({ platform, baseUrl: config.apiBaseUrl, session }),
    upload: createUpload({ platform, baseUrl: config.apiBaseUrl, session }),
    navigation: createNavigation({ platform, routes, session, getPages: () => getCurrentPages() }),
  }
  // 同一应用的组件共用导航锁，避免不同调用方同时 navigateTo。
  instances.set(session, services)
  return services
}
