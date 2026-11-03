import { fail } from './errors.js'

/**
 * 平台任务与普通 Promise 共用句柄；取消/超时立即结束 promise，迟到回调不再交付。
 * @param {Function} start 同步接收 resolve/reject，可返回中止函数；不应在此返回 Promise。
 * @param {Object} [options] token 为本模块取消 token，timeoutMs 为正毫秒，默认 15000。
 * @returns {Object} {promise,cancel(reason?)}；调用方必须处理 promise 拒绝。
 * 无效超时同步抛 RangeError；start 异常通过 promise 拒绝；已取消 token 不启动任务。
 */
export function createOperation(start, { token, timeoutMs = 15000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs 必须大于 0')
  let settled = false,
    abort = () => {},
    abortNeeded = false,
    unsubscribe = () => {},
    timer
  let resolvePromise, rejectPromise
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  function finish(ok, value) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubscribe()
    if (ok) resolvePromise(value)
    else rejectPromise(value)
  }
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
    timer = setTimeout(() => cancel(fail('TIMEOUT', '操作超时，请重试')), timeoutMs)
    try {
      abort =
        start(
          (value) => finish(true, value),
          (error) => finish(false, error),
        ) || abort
      if (abortNeeded) abort()
    } catch (error) {
      finish(false, error)
    }
  }
  return { promise, cancel }
}

/**
 * 创建可共享的取消 token，不依赖浏览器 AbortController，取消后不可恢复。
 * @returns {Object} cancelled、reason、cancel(reason?)、subscribe(listener)；订阅返回解除函数。
 * 已取消时新订阅立即收到 reason。listener 必须同步且不抛错，不能阻断其它订阅释放。
 */
export function createCancellation() {
  const listeners = new Set()
  const token = {
    cancelled: false,
    reason: null,
    subscribe(fn) {
      if (token.cancelled) {
        fn(token.reason)
        return () => {}
      }
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    cancel(reason = fail('CANCELLED', '操作已取消')) {
      if (token.cancelled) return
      token.cancelled = true
      token.reason = reason
      for (const listener of listeners) listener(reason)
      listeners.clear()
    },
  }
  return token
}
