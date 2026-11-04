/**
 *  稳定错误 code 供调用方分类，message 用于提示；cause 保留内部诊断，不直接展示或上报。
 * 框架可分类异常：code 为稳定类别，message 为公开文本，cause 仅用于内部诊断，不能直接输出原始内容。
 */
export class FrameworkError extends Error {
  /**
   * 创建带稳定 code 的 Error，name 固定 FrameworkError，保留可选 cause。
   * code：稳定错误码字符串，供消费者分支判断，不依赖中文文案。
   * message：可公开错误文本；不能夹带凭证或完整响应。
   * cause：可选原始失败，仅保留诊断因果，日志不得直接序列化。
   */
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'FrameworkError'
    this.code = code
  }
}
/** CANCELLED/STALE/DISPOSED 都属于主动失效，UI 通常不应为它们追加失败提示。 */
// isCancelled：判断 CANCELLED/STALE/DISPOSED 三种不应额外报错的结束状态。
export const isCancelled =
  /**
   * 区分取消/过期/销毁，避免页面对正常离开发失败提示。
   * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
   */
  (error) => ['CANCELLED', 'STALE', 'DISPOSED'].includes(error?.code)
/** 构造 FrameworkError 而不抛出；由调用位置决定同步 throw 还是 Promise reject。 */
// fail：FrameworkError 的简洁构造入口；不吞错，不决定业务成功。
export const fail =
  /**
   * 创建新的分类异常，调用方决定同步抛出还是 Promise 拒绝。
   * code：稳定错误码字符串，供消费者分支判断，不依赖中文文案。
   * message：可公开错误文本；不能夹带凭证或完整响应。
   * cause：可选原始失败，仅保留诊断因果，日志不得直接序列化。
   */
  (code, message, cause) => new FrameworkError(code, message, cause)
