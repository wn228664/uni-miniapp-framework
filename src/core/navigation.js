import { createOperation } from './operation.js'
import { fail } from './errors.js'
import { encodeQuery } from '../utils/index.js'

/**
 * 只导航到注册页面，同一实例只允许一个跳转；客户端权限不能代替服务端鉴权。
 * @param {Object} options platform、routes、session 必需，getPages 返回当前平台页面栈。
 * @returns {Object} go(path,{query,replace}) 和 back(fallback)，均返回 Promise。
 * route 可指定 tab/requiresAuth/permission；query 仅标量，Tab 不接收 query。
 * back 无上一页时替换到 fallback；失败或 8000 毫秒超时释放锁，迟到平台跳转无法撤回。
 *
 * 创建单实例共享导航锁，所有组件应复用此服务避免同时跳转。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 * routes：注册页白名单，包含可选 tab/requiresAuth/permission 元数据。
 * session：当前会话 owner；入口判断只改善体验，真实权限仍在后端。
 * getPages：同步读取页面栈的函数，缺省 [] 导致 back 使用后备首页。
 */
export function createNavigation({
  platform,
  routes,
  session,
  /**
   * 缺省页面栈为空，不能假设存在可后退页。
   */
  getPages = () => [],
}) {
  // pending：本服务共享导航互斥锁，初值 false；所有成功/失败/超时后释放。
  let pending = false
  // go：共享 go 句柄；按白名单校验后选择 navigateTo/redirectTo/switchTab。
  const go =
    /**
     * 校验路由、入口权限和 query，有限等待跳转并在 finally 解锁。
     * path：目标已注册页面的精确路径；不允许任意外部 URL。
     * query：标量查询对象，默认 {}；Tab 页禁止携带参数。
     * replace：是否替换当前页，默认 false；Tab 始终使用 switchTab。
     */
    async (path, { query = {}, replace = false } = {}) => {
      // route：白名单中匹配 path 的注册项；不存在立即拒绝 INVALID_ROUTE。
      const route = routes.find(
        /**
         * 在注册白名单内精确匹配目标路径。
         * item：待匹配的注册路由，只比较其 path。
         */
        (item) => item.path === path,
      )
      if (!route) throw fail('INVALID_ROUTE', '页面未注册')
      if (pending) throw fail('BUSY', '页面正在跳转')
      if (route.requiresAuth && !session.state.token) throw fail('AUTH_REQUIRED', '请先登录')
      if (route.permission && !session.state.permissions.includes(route.permission))
        throw fail('FORBIDDEN', '没有访问权限')
      pending = true
      try {
        // url：path 加安全编码的标量 query；不承担业务参数校验。
        const url = path + (Object.keys(query).length ? '?' + encodeQuery(query) : '')
        // method：由 tab/replace 派生的平台跳转方法名，不来自用户任意输入。
        const method = route.tab ? 'switchTab' : replace ? 'redirectTo' : 'navigateTo'
        if (route.tab && Object.keys(query).length) throw fail('INVALID_QUERY', 'Tab 页面不接受 URL 参数')
        return await createOperation(
          /**
           * 启动已选平台跳转并保留失败拒绝通道。
           * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
           * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
           */
          (resolve, reject) => {
            platform[method]({
              url,
              success: resolve,
              fail:
                /**
                 * 将平台前进/替换失败映射为 NAVIGATION。
                 * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
                 */
                (error) => reject(fail('NAVIGATION', '页面跳转失败', error)),
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
    /**
     * 有上一页则互斥后退，否则走校验过的后备 go；上限 8000ms。
     * fallback：无可返回页面时使用的注册路径，默认 /pages/index/index。
     */
    async back(fallback = '/pages/index/index') {
      if (getPages().length <= 1) return go(fallback, { replace: true })
      if (pending) throw fail('BUSY', '页面正在跳转')
      pending = true
      try {
        return await createOperation(
          /**
           * 启动平台后退；结果等待由 operation 终结。
           * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
           * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
           */
          (resolve, reject) => {
            platform.navigateBack({
              success: resolve,
              fail:
                /**
                 * 将平台返回失败映射为 NAVIGATION，不宣称已返回。
                 * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
                 */
                (error) => reject(fail('NAVIGATION', '返回失败', error)),
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
