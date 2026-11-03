/** 默认只输出错误类别；不记录请求头、凭证、用户输入或完整平台错误对象。 */
export function reportError(scope, error) {
  console.error(`[${scope}]`, error?.code || error?.name || 'UNEXPECTED')
}
