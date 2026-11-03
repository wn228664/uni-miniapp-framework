/**
 * 会话仅存内存；set/clear 推进 revision，使前一身份的异步响应失效。
 * @param {{token: string, permissions: string[], revision: number}} [state] 可传 reactive。
 * @returns {Object} 同一 state、set({token,permissions}) 和 clear()；不持久化或刷新凭证。
 * 权限列表仅用于客户端入口，不能代替服务端鉴权。
 */
export function createSession(state = { token: '', permissions: [], revision: 0 }) {
  return {
    state,
    set({ token = '', permissions = [] } = {}) {
      state.revision++
      state.token = typeof token === 'string' ? token : ''
      state.permissions = Array.isArray(permissions) ? permissions.filter((x) => typeof x === 'string') : []
    },
    clear() {
      state.revision++
      state.token = ''
      state.permissions = []
    },
  }
}
