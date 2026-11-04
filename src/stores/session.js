import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { createSession } from '../core/session.js'
/** 每个 Pinia 应用独立持有内存会话；状态与 set/clear 契约由 createSession 统一维护。 */
// useSessionStore：按 Pinia 实例创建独立身份，不跨实例共享 token。
export const useSessionStore = defineStore(
  'session',
  /**
   * 创建本应用的响应式身份并接入统一会话更新协议。
   */
  () => {
    // state：响应式内存会话，初始 token 空/permissions 空/revision=0，更新交 createSession。
    const state = reactive({ token: '', permissions: [], revision: 0 })
    return createSession(state)
  },
)
