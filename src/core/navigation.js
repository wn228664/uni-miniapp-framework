import { createOperation } from './operation.js'
import { fail } from './errors.js'
import { encodeQuery } from '../utils/index.js'

/**
 * 只导航到注册页面，同一实例只允许一个跳转；客户端权限不能代替服务端鉴权。
 * @param {Object} options platform、routes、session 必需，getPages 返回当前平台页面栈。
 * @returns {Object} go(path,{query,replace}) 和 back(fallback)，均返回 Promise。
 * route 可指定 tab/requiresAuth/permission；query 仅标量，Tab 不接收 query。
 * back 无上一页时替换到 fallback；失败或 8000 毫秒超时释放锁，迟到平台跳转无法撤回。
 */
export function createNavigation({ platform, routes, session, getPages = () => [] }) {
  let pending = false
  const go = async (path, { query = {}, replace = false } = {}) => {
    const route = routes.find((item) => item.path === path)
    if (!route) throw fail('INVALID_ROUTE', '页面未注册')
    if (pending) throw fail('BUSY', '页面正在跳转')
    if (route.requiresAuth && !session.state.token) throw fail('AUTH_REQUIRED', '请先登录')
    if (route.permission && !session.state.permissions.includes(route.permission))
      throw fail('FORBIDDEN', '没有访问权限')
    pending = true
    try {
      const url = path + (Object.keys(query).length ? '?' + encodeQuery(query) : '')
      const method = route.tab ? 'switchTab' : replace ? 'redirectTo' : 'navigateTo'
      if (route.tab && Object.keys(query).length) throw fail('INVALID_QUERY', 'Tab 页面不接受 URL 参数')
      return await createOperation(
        (resolve, reject) => {
          platform[method]({
            url,
            success: resolve,
            fail: (error) => reject(fail('NAVIGATION', '页面跳转失败', error)),
          })
        },
        { timeoutMs: 8000 },
      ).promise
    } finally {
      pending = false
    }
  }
  return {
    go,
    async back(fallback = '/pages/index/index') {
      if (getPages().length <= 1) return go(fallback, { replace: true })
      if (pending) throw fail('BUSY', '页面正在跳转')
      pending = true
      try {
        return await createOperation(
          (resolve, reject) => {
            platform.navigateBack({
              success: resolve,
              fail: (error) => reject(fail('NAVIGATION', '返回失败', error)),
            })
          },
          { timeoutMs: 8000 },
        ).promise
      } finally {
        pending = false
      }
    },
  }
}
