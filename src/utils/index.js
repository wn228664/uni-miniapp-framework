export const isBlank = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
/**
 * 编码平铺查询参数，跳过 null/undefined，保留 0、false 和空字符串。
 * @param {Object<string, string|number|boolean|null|undefined>} params 不接受嵌套对象或数组。
 * @returns {string} 不包含开头问号的查询串；非法参数值抛 TypeError。
 */
export function encodeQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (!['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('Query 只接受标量')
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    })
    .join('&')
}
/**
 * 生成当前运行环境的本地化日期文案；不能用作接口传输或跨时区日期标识。
 * @param {string|number|Date} value 数字为毫秒时间戳；空值或无效日期返回空串。
 * @param {string} [locale='zh-CN'] 由运行时支持的 locale，输出格式随平台变化。
 * @returns {string}
 */
export function formatDate(value, locale = 'zh-CN') {
  if (isBlank(value)) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale)
}
/**
 * 数字或数字字符串的展示格式化；空值和非有限数返回空串，不承担高精度计算。
 * @param {number|string} value
 * @param {number} [digits=2] 小数位，调用方传整数；有效显示范围限制为 0..8。
 * @returns {string} toFixed 的舍入结果，不包含千分位。
 */
export function formatNumber(value, digits = 2) {
  if (isBlank(value) || !Number.isFinite(Number(value))) return ''
  return Number(value).toFixed(Math.max(0, Math.min(8, digits)))
}
/**
 * 按 1024 进位显示非负字节数；负数或非有限数返回空串。
 * @param {number} value 单位为字节；KB/MB 保留一位小数。
 * @returns {string} 仅用于体积文案，不代表压缩后或网络传输体积。
 */
export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}
/**
 * 每个句柄独立计时，仅在连续调用停止 wait 毫秒后执行最后一组参数。
 * @param {Function} fn 不绑定 this；需保持对象上下文时传闭包或已 bind 的函数。
 * @param {number} [wait=250] 非负毫秒数，由调用方提供有效数值。
 * @returns {Function} 调用不返回 fn 的结果；附带 cancel()，页面离开时应取消未执行任务。
 */
export function debounce(fn, wait = 250) {
  let timer
  const run = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
  run.cancel = () => clearTimeout(timer)
  return run
}
/**
 * 前沿节流：首次立即执行，间隔内调用直接丢弃，不安排尾调用或排队。
 * @param {Function} fn 不绑定 this；异常由当前调用方处理。
 * @param {number} [wait=250] 非负毫秒数，使用运行时墙钟计算间隔。
 * @returns {Function} 仅真正执行时返回 fn 的结果；此函数不能代替异步提交锁。
 */
export function throttle(fn, wait = 250) {
  let last = -Infinity
  return (...args) => {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      return fn(...args)
    }
  }
}
/**
 * 按字段顺序执行同步规则，每个字段只保留第一个非空错误文本。
 * @param {Object} model 供规则读取的字段对象，规则不得修改它。
 * @param {Object<string, Function[]>} rules 规则签名为 (value, model) => 文本或空值。
 * @returns {Object<string, string>} 无错误时为空对象；非空的非文本结果（含 Promise）会抛 TypeError。
 */
export function validateFields(model, rules) {
  const errors = {}
  for (const [key, list] of Object.entries(rules)) {
    for (const rule of list) {
      const message = rule(model[key], model)
      if (message && typeof message !== 'string') throw new TypeError('校验规则必须同步返回错误文本或空值')
      if (message) {
        errors[key] = message
        break
      }
    }
  }
  return errors
}
/**
 * 构造必填规则；空白字符串/null/undefined 判空，0 和 false 是合法值。
 * @param {string} [message='请填写此项'] 集合或对象的有效性应另设规则。
 * @returns {Function} (value) => 错误文本或空字符串。
 */
export const required =
  (message = '请填写此项') =>
  (value) =>
    isBlank(value) ? message : ''

/**
 * 日期字段保存本地日历 YYYY-MM-DD，不经 UTC ISO 转换，避免时区偏移。
 * @param {number|string|Date} value 数字为毫秒时间戳；空值或无效日期返回空串。
 * @returns {string}
 */
export function dateInput(value) {
  if (isBlank(value)) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
/**
 * 将 YYYY-MM-DD 解析为本地正午的毫秒时间戳，不让 Date 自动滚到下个月。
 * @param {string} value 仅接受四位年份日期，按 Date 的本地日历往返核对。
 * @returns {number|null} 空值、格式错误、越界日期或无法往返的日期返回 null。
 */
export function dateTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return dateInput(date) === value ? date.getTime() : null
}
