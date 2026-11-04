/** 回归同步操作工厂抛错后的动作锁恢复；无效等待参数不得启动副作用，也不能阻塞随后合法调用。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAction } from '../src/core/action.js'

/**
 * 逐个验证无效超时拒绝后 pending 清空，并可再次成功执行。
 */
test('action recovers after synchronous operation construction failure', async () => {
  // timeoutMs：createOperation 必须同步拒绝的非正数或非有限超时。
  for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    // action：当前用例独占的动作控制器，用于验证互斥、取消和销毁。
    const action = createAction()
    // executions：真正进入 execute 的次数，无效配置时必须保持零。
    let executions = 0
    await assert.rejects(
      action.run(
        /**
         * 记录副作用是否开始；本用例要求工厂抛错前不进入此回调。
         */
        () => {
          executions++
        },
        { timeoutMs },
      ),
      RangeError,
    )
    assert.equal(action.state.pending, false)
    assert.equal(executions, 0)
    assert.equal(
      await action.run(
        /**
         * 提供合法的重试结果，验证动作锁已恢复。
         */
        () => 'recovered',
      ),
      'recovered',
    )
    assert.equal(action.state.error, '')
    action.dispose()
  }
})
