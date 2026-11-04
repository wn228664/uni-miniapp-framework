import { createAction } from './action.js'
import { fail } from './errors.js'

/**
 * load({ page, pageSize, token }) -> Promise<{ items, hasMore }>，页码从 1 开始。
 * keyOf 提供稳定项标识；刷新取消旧页，失败保留内容与页码，dispose 后拒绝新任务。
 * state 可传 Vue reactive；控制器本身不依赖 Vue，列表组件应使用相同的 key 规则。
 * @param {Object} options load 必需，pageSize 为正整数；keyOf 默认读取 item.id。
 * @returns {Object} state、next/refresh（Promise）、cancel/dispose；所有拒绝均由调用方处理。
 * items 必须为数组、hasMore 必须为布尔值，缺少稳定 key 以 DECODE 拒绝。
 *
 * 创建分页状态机；无 load/非法 pageSize 创建失败，不发请求。
 * load：接收 {page,pageSize,token} 的 loader，必须返回 {items:Array,hasMore:boolean}。
 * pageSize：每页请求容量，默认 10，必须为正整数；不推断服务端总量。
 * keyOf：稳定 key 读取器，默认 item.id；必须与列表渲染 key 一致。
 * state：可注入 reactive 的分页状态；初始 page=0/items=[]，失败保持旧数据页码。
 */
export function createPagination({
  load,
  pageSize = 10,
  /**
   * 缺省以 item.id 作为列表稳定标识。
   * item：候选列表项；keyOf 必须给非 null/undefined 的稳定键。
   */
  keyOf = (item) => item.id,
  state = { items: [], page: 0, pending: false, refreshing: false, hasMore: true, error: '' },
}) {
  if (typeof load !== 'function') throw new TypeError('分页必须提供 load')
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new RangeError('pageSize 必须为正整数')
  // action：与 state 共用的动作 owner，负责 pending/error 和取消。
  const action = createAction(state)
  // epoch：分页上下文代次，刷新/取消/销毁递增，阻止旧页覆盖新列表。
  let epoch = 0
  /**
   * 刷新取消旧页、追加守卫重复/结束；失败保留数据和页码，当前周期才解刷新态。
   * refresh：是否替换整批数据，默认 false；true 先取消旧页并推进代次。
   */
  async function fetchPage(refresh = false) {
    if (!refresh && (!state.hasMore || state.pending)) return
    if (refresh) {
      epoch++
      action.cancel()
      state.refreshing = true
    }
    // mine：本次 fetchPage 的代次快照；catch/finally 不得污染后来的刷新。
    const mine = epoch
    // page：本轮目标 1 基页码；刷新为 1，加载更多为旧 page+1，成功前不发布。
    const page = refresh ? 1 : state.page + 1
    try {
      // response：loader 的有效周期结果；校验 items/hasMore 后才发布。
      const response = await action.run(
        /**
         * 按本次页码快照和 token 调 loader，不猜业务响应字段。
         * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
         */
        (token) => load({ page, pageSize, token }),
      )
      if (mine !== epoch) throw fail('STALE', '分页任务已变化')
      if (!Array.isArray(response?.items) || typeof response.hasMore !== 'boolean')
        throw fail('DECODE', '分页响应无效')
      // items：合并基底，刷新时为空、追加时为当前已成功列表。
      const items = refresh ? [] : state.items
      // known：已存在稳定 key 集合，用于当前批次与跨页去重。
      const known = new Set(items.map(keyOf))
      // next：此页尚未出现的项数组，先构建完整再一次发布。
      const next = []
      // item：候选列表项；keyOf 必须给非 null/undefined 的稳定键。
      for (const item of response.items) {
        // key：该项稳定标识，Set 按严格 SameValueZero 语义去重。
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
      // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

      if (mine === epoch && !['CANCELLED', 'STALE'].includes(error.code)) state.error = error.message
      throw error
    } finally {
      if (mine === epoch && !state.pending) state.refreshing = false
    }
  }
  return {
    state,
    next:
      /**
       * 请求下一页，已结束或正在加载时直接返回。
       */
      () => fetchPage(),
    refresh:
      /**
       * 以新代次加载第一页，成功后替换旧列表。
       */
      () => fetchPage(true),
    /**
     * 推进分页代次并取消等待，保留已有内容。
     */
    cancel() {
      epoch++
      action.cancel()
      state.refreshing = false
    },
    /**
     * 推进代次并永久释放动作 owner，卸载后不能复用。
     */
    dispose() {
      epoch++
      action.dispose()
      state.refreshing = false
    },
  }
}
