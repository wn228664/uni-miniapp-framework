import { createCancellation, createOperation } from './operation.js'
import { fail, isCancelled } from './errors.js'

/**
 * 同步占锁；每个周期独立，旧 finally 不能解开新任务的锁。
 * @param {{pending: boolean, error: string}} [state] 可传 reactive；pending 由控制器独占写入。
 * @returns {Object} run(execute, {timeoutMs})、cancel、dispose 和同一 state。
 * run 将取消 token 传给 execute；BUSY/DISPOSED 拒绝新调用，失败或超时后可重试。
 * cancel 只终止客户端消费，不撤销服务端副作用；dispose 后句柄不可复用。
 */
export function createAction(state = { pending: false, error: '' }) {
  let revision = 0,
    disposed = false,
    current
  function cancel() {
    revision++
    current?.cancel()
    current = null
    state.pending = false
  }
  return {
    state,
    cancel,
    dispose() {
      cancel()
      disposed = true
    },
    async run(execute, { timeoutMs = 30000 } = {}) {
      if (disposed) throw fail('DISPOSED', '任务已销毁')
      if (state.pending) throw fail('BUSY', '操作正在进行')
      const mine = ++revision,
        token = createCancellation()
      state.pending = true
      state.error = ''
      current = createOperation(
        (resolve, reject) => {
          Promise.resolve()
            .then(() => {
              if (token.cancelled) throw token.reason
              return execute(token)
            })
            .then(resolve, reject)
          return () => token.cancel()
        },
        { timeoutMs },
      )
      try {
        return await current.promise
      } catch (error) {
        if (mine === revision && !isCancelled(error)) state.error = error.message || '操作失败'
        throw error
      } finally {
        if (mine === revision) {
          state.pending = false
          current = null
        }
      }
    },
  }
}
