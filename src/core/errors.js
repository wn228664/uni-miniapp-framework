/** 稳定错误 code 供调用方分类，message 用于提示；cause 保留内部诊断，不直接展示或上报。 */
export class FrameworkError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'FrameworkError'
    this.code = code
  }
}
/** CANCELLED/STALE/DISPOSED 都属于主动失效，UI 通常不应为它们追加失败提示。 */
export const isCancelled = (error) => ['CANCELLED', 'STALE', 'DISPOSED'].includes(error?.code)
/** 构造 FrameworkError 而不抛出；由调用位置决定同步 throw 还是 Promise reject。 */
export const fail = (code, message, cause) => new FrameworkError(code, message, cause)
