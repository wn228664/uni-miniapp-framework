/**
 * 会话仅存内存；set/clear 推进 revision，使前一身份的异步响应失效。
 * @param {{token: string, permissions: string[], revision: number}} [state] 可传 reactive。
 * @returns {Object} 同一 state、set({token,permissions}) 和 clear()；不持久化或刷新凭证。
 * 权限列表仅用于客户端入口，不能代替服务端鉴权。
 *
 * 在调用方状态上建立 set/clear；身份只驻留当前应用实例。
 * state：当前应用内存身份 {token,permissions,revision}；默认匿名，不做凭证持久化。
 */
export function createSession(state = { token: '', permissions: [], revision: 0 }) {
  return {
    state,
    /**
     * 每次注入先推进代次，再收窄凭证和权限，包括同 token 的重新登录。
     * token：注入的凭证候选，默认空串；非字符串归空。
     * permissions：注入的权限候选，默认 []；只保留其中字符串，不能替代后端鉴权。
     */
    set({ token = '', permissions = [] } = {}) {
      state.revision++
      state.token = typeof token === 'string' ? token : ''
      state.permissions = Array.isArray(permissions)
        ? permissions.filter(
            /**
             * 仅保留字符串权限项，避免任意对象参与入口判断。
             * x：权限数组候选项；非字符串不能进入客户端权限判断。
             */
            (x) => typeof x === 'string',
          )
        : []
    },
    /**
     * 推进代次后清空凭证/权限，使旧认证响应失效。
     */
    clear() {
      state.revision++
      state.token = ''
      state.permissions = []
    },
  }
}
