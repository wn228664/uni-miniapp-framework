import { fail } from './errors.js'

/**
 * 平台任务与普通 Promise 共用句柄；取消/超时立即结束 promise，迟到回调不再交付。
 * @param {Function} start 同步接收 resolve/reject，可返回中止函数；不应在此返回 Promise。
 * @param {Object} [options] token 为本模块取消 token，timeoutMs 为正毫秒，默认 15000。
 * @returns {Object} {promise,cancel(reason?)}；调用方必须处理 promise 拒绝。
 * 无效超时同步抛 RangeError；start 异常通过 promise 拒绝；已取消 token 不启动任务。
 *
 * 创建统一可取消任务，清 timer/订阅且屏蔽晚到结果；无效超时同步失败。
 * start：同步启动器，接收 resolve/reject，可返回中止函数；不能返回 Promise 当中止句柄。
 * token：可共享的单次取消 token；cancelled/reason 只从未取消变为已取消，不可恢复。
 * timeoutMs：等待上限，正且有限的毫秒数，默认 15000；非法值在创建任务前同步抛出。
 */
export function createOperation(start, { token, timeoutMs = 15000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs 必须大于 0')
  // settled：首个终态闩锁；true 后所有晚到回调忽略。
  // abort：平台中止函数，初值无副作用；start 返回后赋值。
  // abortNeeded：start 还未返回时就收到取消的标记；取得 abort 后必须补调。
  // unsubscribe：取消 token 订阅清理器，初值空函数；finish 时调用。
  // timer：本轮本地等待的 setTimeout 句柄；取消函数清除，不跨任务共享。
  let settled = false,
    abort =
      /**
       * start 尚未提供中止器时的无副作用默认函数。
       */
      () => {},
    abortNeeded = false,
    unsubscribe =
      /**
       * 尚无 token 订阅时的幂等空清理器。
       */
      () => {},
    timer
  // resolvePromise：当前 Promise 的成功终结器引用，只由 finish 调用。
  // rejectPromise：当前 Promise 的拒绝终结器引用，只由 finish 调用。
  let resolvePromise, rejectPromise
  // promise：对外交付的一次性 Promise；所有拒绝需由调用方处理。
  const promise = new Promise(
    /**
     * 保存 Promise 终结器，使取消和平台回调共用 finish。
     * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
     * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
     */
    (resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    },
  )
  /**
   * 先占终态、清计时器/订阅，再成功或拒绝交付；重复调用无效。
   * ok：finish 的终态类别，true 成功、false 拒绝。
   * value：平台结果或失败值；由 ok 决定送成功还是失败终结器。
   */
  function finish(ok, value) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubscribe()
    if (ok) resolvePromise(value)
    else rejectPromise(value)
  }
  /**
   * 先拒绝当前等待，再尽力调用底层 abort，平台 abort 异常不改变已终结结果。
   * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
   */
  function cancel(error = fail('CANCELLED', '操作已取消')) {
    if (settled) return
    abortNeeded = true
    finish(false, error)
    try {
      abort()
    } catch {
      /* 已终结的任务不会被平台 abort 异常改写。 */
    }
  }
  if (token?.cancelled) cancel(token.reason)
  else {
    unsubscribe = token?.subscribe(cancel) || unsubscribe
    timer = setTimeout(
      /**
       * 等待达到上限时以 TIMEOUT 结束，不自动重试操作。
       */
      () => cancel(fail('TIMEOUT', '操作超时，请重试')),
      timeoutMs,
    )
    try {
      abort =
        start(
          /**
           * 平台成功经 finish 至多交付一次。
           * value：平台结果或失败值；由 ok 决定送成功还是失败终结器。
           */
          (value) => finish(true, value),
          /**
           * 平台失败经 finish 至多拒绝一次。
           * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
           */
          (error) => finish(false, error),
        ) || abort
      if (abortNeeded) abort()
    } catch (error) {
      // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

      finish(false, error)
    }
  }
  return { promise, cancel }
}

/**
 * 创建可共享的取消 token，不依赖浏览器 AbortController，取消后不可恢复。
 * @returns {Object} cancelled、reason、cancel(reason?)、subscribe(listener)；订阅返回解除函数。
 * 已取消时新订阅立即收到 reason。listener 必须同步且不抛错，不能阻断其它订阅释放。
 *
 * 创建不依赖浏览器 AbortController 的平台通用单次取消 token。
 */
export function createCancellation() {
  // listeners：单个取消 token 的订阅 Set；首次取消后清空。
  const listeners = new Set()
  // token：可共享的单次取消 token；cancelled/reason 只从未取消变为已取消，不可恢复。
  const token = {
    cancelled: false,
    reason: null,
    /**
     * 登记同步 listener；已取消立即通知并返回空解除函数。
     * fn：待登记的同步取消订阅者；已取消时立即收到既有 reason。
     */
    subscribe(fn) {
      if (token.cancelled) {
        fn(token.reason)
        return (
          /**
           * 已取消 token 不再持有订阅，所以解除时无副作用。
           */
          () => {}
        )
      }
      listeners.add(fn)
      return (
        /**
         * 取消前解除单个订阅，不影响其它监听者。
         */
        () => listeners.delete(fn)
      )
    },
    /**
     * 首次取消记录 reason，逐个通知并清空订阅；后续调用无效。
     * reason：取消原因，默认 CANCELLED；只能第一次 cancel 确定，后续不覆盖。
     */
    cancel(reason = fail('CANCELLED', '操作已取消')) {
      if (token.cancelled) return
      token.cancelled = true
      token.reason = reason
      // listener：已登记的同步取消订阅者；契约要求不抛错，以免阻断其它清理。
      for (const listener of listeners) listener(reason)
      listeners.clear()
    },
  }
  return token
}
