/**
 * Loading 按 owner 计数，先结束的任务不能隐藏其它仍在执行的任务。
 * @param {Object} platform showToast/showLoading/hideLoading 平台适配器。
 * @returns {Object} toast(title) 与 withLoading(title,execute)；后者返回 execute 的异步结果。
 * withLoading 在 finally 释放 owner；调用方必须让 execute 有取消/超时，不能传永不结束的任务。
 * 此模块不负责错误弹窗，不自动捕获或重试调用方的失败。
 */
export function createFeedback(platform) {
  const owners = new Map()
  function render() {
    if (!owners.size) platform.hideLoading()
    else {
      const titles = [...owners.values()]
      platform.showLoading({ title: titles[titles.length - 1], mask: true })
    }
  }
  return {
    toast(title) {
      platform.showToast({ title: String(title).slice(0, 80), icon: 'none' })
    },
    async withLoading(title, execute) {
      const owner = Symbol('loading')
      owners.set(owner, title)
      try {
        render()
        return await execute()
      } finally {
        owners.delete(owner)
        render()
      }
    },
  }
}
