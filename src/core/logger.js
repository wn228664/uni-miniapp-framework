/**
 *  默认只输出错误类别；不记录请求头、凭证、用户输入或完整平台错误对象。
 *
 * 仅记录错误类别，禁止完整请求、响应或凭证进入默认日志。
 * scope：固定诊断范围标签，由框架入口提供，不包含用户输入。
 * error：原始异常，只读取 code/name，缺失时用 UNEXPECTED；不输出 stack/config。
 */
export function reportError(scope, error) {
  console.error(`[${scope}]`, error?.code || error?.name || 'UNEXPECTED')
}
