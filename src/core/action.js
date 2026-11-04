import { createCancellation, createOperation } from './operation.js'
import { fail, isCancelled } from './errors.js'

/**
 * 同步占锁；每个周期独立，旧 finally 不能解开新任务的锁。
 * @param {{pending: boolean, error: string}} [state] 可传 reactive；pending 由控制器独占写入。
 * @returns {Object} run(execute, {timeoutMs})、cancel、dispose 和同一 state。
 * run 将取消 token 传给 execute；BUSY/DISPOSED 拒绝新调用，失败或超时后可重试。
 * cancel 只终止客户端消费，不撤销服务端副作用；dispose 后句柄不可复用。
 *
 * 创建同步互斥动作 owner；失败、超时和创建异常均可恢复，销毁不可复用。
 * state：调用方可注入 reactive 的 pending/error；锁控制器独占 pending 写入。
 */
export function createAction(state = { pending: false, error: '' }) {
  // revision：动作周期号，初值 0；cancel/run 递增使旧 finally 无权改新周期。
  // disposed：不可恢复的销毁标记，初值 false；dispose 后 run 拒绝 DISPOSED。
  // current：当前 createOperation 句柄；cancel/本周期 finally 清空。
  let revision = 0,
    disposed = false,
    current
  /**
   * 先推进周期再取消旧任务并释放锁，旧 finally 不得干扰新调用。
   */
  function cancel() {
    revision++
    current?.cancel()
    current = null
    state.pending = false
  }
  return {
    state,
    cancel,
    /**
     * 取消当前任务并永久标记销毁。
     */
    dispose() {
      cancel()
      disposed = true
    },
    /**
     * 同步占锁，创建和等待均处于 try/finally，所有当前周期出口释放锁。
     * execute：调用方动作，接收独立 token，可返回值/Promise；不自动重试。
     * timeoutMs：本周期等待上限，毫秒默认 30000；非有限或不大于 0 时拒绝 RangeError。
     */
    async run(execute, { timeoutMs = 30000 } = {}) {
      if (disposed) throw fail('DISPOSED', '任务已销毁')
      if (state.pending) throw fail('BUSY', '操作正在进行')
      // mine：run 开始时的周期快照；catch/finally 只在它仍有效时写状态。
      // token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
      const mine = ++revision,
        token = createCancellation()
      state.pending = true
      state.error = ''
      try {
        // createOperation 会同步校验 timeoutMs；创建失败也必须经过 finally 释放本周期的锁。
        current = createOperation(
          /**
           * 把 execute 的同步/异步结果接到统一 operation，并提供取消 token 的中止函数。
           * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
           * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
           */
          (resolve, reject) => {
            Promise.resolve()
              .then(
                /**
                 * 实际执行前再查 token，避免同一微任务前取消仍触发副作用。
                 */
                () => {
                  if (token.cancelled) throw token.reason
                  return execute(token)
                },
              )
              .then(resolve, reject)
            return (
              /**
               * 取消 operation 时同步取消下游 token，不重放动作。
               */
              () => token.cancel()
            )
          },
          { timeoutMs },
        )
        return await current.promise
      } catch (error) {
        // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

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
