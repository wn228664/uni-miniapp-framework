/**
 * Loading 按 owner 计数，先结束的任务不能隐藏其它仍在执行的任务。
 * @param {Object} platform showToast/showLoading/hideLoading 平台适配器。
 * @returns {Object} toast(title) 与 withLoading(title,execute)；后者返回 execute 的异步结果。
 * withLoading 在 finally 释放 owner；调用方必须让 execute 有取消/超时，不能传永不结束的任务。
 * 此模块不负责错误弹窗，不自动捕获或重试调用方的失败。
 *
 * 创建平台提示服务，多动作加载层按 owner 合并，不按布尔值互相抢关。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 */
export function createFeedback(platform) {
  // owners：每个 withLoading 用 Symbol 记录独立标题；最后一个完成才关闭全局加载层。
  const owners = new Map()
  /**
   * 无 owner 时隐藏，有 owner 时展示最后活动标题。
   */
  function render() {
    if (!owners.size) platform.hideLoading()
    else {
      // titles：按 owner 插入顺序的标题快照；当前展示最后一个尚存标题。
      const titles = [...owners.values()]
      platform.showLoading({ title: titles[titles.length - 1], mask: true })
    }
  }
  return {
    /**
     * 显示最多 80 字符的无图标公开文本，不记录原始异常。
     * title：调用方确认可公开的提示文案；toast 最多 80 字符，loading 使用最后活动标题。
     */
    toast(title) {
      platform.showToast({ title: String(title).slice(0, 80), icon: 'none' })
    },
    /**
     * 登记独立加载 owner，等待动作，任意终态只释放本 owner 再刷新显示。
     * title：调用方确认可公开的提示文案；toast 最多 80 字符，loading 使用最后活动标题。
     * execute：需要加载提示的动作；失败继续向外拒绝，finally 必须释放提示 owner。
     */
    async withLoading(title, execute) {
      // owner：本次 withLoading 的唯一 Symbol；finally 仅移除此 owner。
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
