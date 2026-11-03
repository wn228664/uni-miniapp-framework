import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { createSession } from '../core/session.js'
/** 每个 Pinia 应用独立持有内存会话；状态与 set/clear 契约由 createSession 统一维护。 */
export const useSessionStore = defineStore('session', () => {
  const state = reactive({ token: '', permissions: [], revision: 0 })
  return createSession(state)
})
