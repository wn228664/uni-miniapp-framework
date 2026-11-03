import { createAction } from './action.js'
import { fail } from './errors.js'

/**
 * load({ page, pageSize, token }) -> Promise<{ items, hasMore }>，页码从 1 开始。
 * keyOf 提供稳定项标识；刷新取消旧页，失败保留内容与页码，dispose 后拒绝新任务。
 * state 可传 Vue reactive；控制器本身不依赖 Vue，列表组件应使用相同的 key 规则。
 * @param {Object} options load 必需，pageSize 为正整数；keyOf 默认读取 item.id。
 * @returns {Object} state、next/refresh（Promise）、cancel/dispose；所有拒绝均由调用方处理。
 * items 必须为数组、hasMore 必须为布尔值，缺少稳定 key 以 DECODE 拒绝。
 */
export function createPagination({
  load,
  pageSize = 10,
  keyOf = (item) => item.id,
  state = { items: [], page: 0, pending: false, refreshing: false, hasMore: true, error: '' },
}) {
  if (typeof load !== 'function') throw new TypeError('分页必须提供 load')
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new RangeError('pageSize 必须为正整数')
  const action = createAction(state)
  let epoch = 0
  async function fetchPage(refresh = false) {
    if (!refresh && (!state.hasMore || state.pending)) return
    if (refresh) {
      epoch++
      action.cancel()
      state.refreshing = true
    }
    const mine = epoch
    const page = refresh ? 1 : state.page + 1
    try {
      const response = await action.run((token) => load({ page, pageSize, token }))
      if (mine !== epoch) throw fail('STALE', '分页任务已变化')
      if (!Array.isArray(response?.items) || typeof response.hasMore !== 'boolean')
        throw fail('DECODE', '分页响应无效')
      const items = refresh ? [] : state.items
      const known = new Set(items.map(keyOf))
      const next = []
      for (const item of response.items) {
        const key = keyOf(item)
        if (key === undefined || key === null) throw fail('DECODE', '列表项缺少稳定 key')
        if (!known.has(key)) {
          known.add(key)
          next.push(item)
        }
      }
      state.items = [...items, ...next]
      state.page = page
      state.hasMore = response.hasMore
    } catch (error) {
      if (mine === epoch && !['CANCELLED', 'STALE'].includes(error.code)) state.error = error.message
      throw error
    } finally {
      if (mine === epoch && !state.pending) state.refreshing = false
    }
  }
  return {
    state,
    next: () => fetchPage(),
    refresh: () => fetchPage(true),
    cancel() {
      epoch++
      action.cancel()
      state.refreshing = false
    },
    dispose() {
      epoch++
      action.dispose()
      state.refreshing = false
    },
  }
}
