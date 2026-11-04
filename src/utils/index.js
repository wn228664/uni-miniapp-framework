/** 中性同步工具：查询编码、展示格式、可取消防抖、前沿节流、字段验证与本地日历转换。展示函数不承担接口精度/时区契约；定时器由返回句柄所属页面负责清理，节流/防抖不能替代异步动作锁。 */
// isBlank：空值谓词，仅 null/undefined/空白文本为空；0/false 有效。
export const isBlank =
  /**
   * 判断可接受的空值集合，不把 0 和 false 当空。
   * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
   */
  (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
/**
 * 编码平铺查询参数，跳过 null/undefined，保留 0、false 和空字符串。
 * @param {Object<string, string|number|boolean|null|undefined>} params 不接受嵌套对象或数组。
 * @returns {string} 不包含开头问号的查询串；非法参数值抛 TypeError。
 *
 * 编码平铺标量 query，保留 0/false/空串，拒绝对象和数组。
 * params：平铺查询键值对象，过滤 null/undefined，禁止嵌套对象/数组。
 */
export function encodeQuery(params) {
  return Object.entries(params)
    .filter(
      /**
       * 只过滤 null/undefined 查询值。
       * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
       */
      ([, value]) => value !== undefined && value !== null,
    )
    .map(
      /**
       * 校验标量类型后分别编码键和值，不保留原始分隔符。
       * key：查询键或当前验证字段名；查询时 encodeURIComponent，验证时索引模型。
       * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
       */
      ([key, value]) => {
        if (!['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('Query 只接受标量')
        return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
      },
    )
    .join('&')
}
/**
 * 生成当前运行环境的本地化日期文案；不能用作接口传输或跨时区日期标识。
 * @param {string|number|Date} value 数字为毫秒时间戳；空值或无效日期返回空串。
 * @param {string} [locale='zh-CN'] 由运行时支持的 locale，输出格式随平台变化。
 * @returns {string}
 *
 * 按本地运行时 locale 展示日期，空/无效返回空。
 * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
 * locale：运行时支持的日期 locale，默认 zh-CN，不作为接口日期格式。
 */
export function formatDate(value, locale = 'zh-CN') {
  if (isBlank(value)) return ''
  // date：由输入解析的本地 Date；无效值返回空/ null，不用 UTC 截日历。
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale)
}
/**
 * 数字或数字字符串的展示格式化；空值和非有限数返回空串，不承担高精度计算。
 * @param {number|string} value
 * @param {number} [digits=2] 小数位，调用方传整数；有效显示范围限制为 0..8。
 * @returns {string} toFixed 的舍入结果，不包含千分位。
 *
 * 有限数值展示为固定小数，不用于高精度资金计算。
 * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
 * digits：展示小数位，默认 2，调用方提供整数；夹取到 0..8。
 */
export function formatNumber(value, digits = 2) {
  if (isBlank(value) || !Number.isFinite(Number(value))) return ''
  return Number(value).toFixed(Math.max(0, Math.min(8, digits)))
}
/**
 * 按 1024 进位显示非负字节数；负数或非有限数返回空串。
 * @param {number} value 单位为字节；KB/MB 保留一位小数。
 * @returns {string} 仅用于体积文案，不代表压缩后或网络传输体积。
 *
 * 以 1024 进位展示非负字节，非法输入返回空。
 * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
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
 *
 * 创建独立尾沿防抖器，返回 run.cancel 释放未执行 timer。
 * fn：待防抖/节流调用的函数，不自动绑定 this；异步幂等由调用方处理。
 * wait：等待/最短间隔毫秒，默认 250；契约要求非负有效数值。
 */
export function debounce(fn, wait = 250) {
  // timer：本轮本地等待的 setTimeout 句柄；取消函数清除，不跨任务共享。
  let timer
  // run：单个 debounce 句柄，覆盖旧 timer；附带 cancel，调用不返回 fn 结果。
  const run =
    /**
     * 以最新参数替换等待，不保存 this 或旧参数队列。
     * args：该次调用的参数列表；防抖只保留最后一次，节流只接受间隔外调用。
     */
    (...args) => {
      clearTimeout(timer)
      timer = setTimeout(
        /**
         * 到时只调用最后一组参数，异常由运行时/调用方处理。
         */
        () => fn(...args),
        wait,
      )
    }
  run.cancel =
    /**
     * 取消尚未执行的防抖 timer，不触发尾调用。
     */
    () => clearTimeout(timer)
  return run
}
/**
 * 前沿节流：首次立即执行，间隔内调用直接丢弃，不安排尾调用或排队。
 * @param {Function} fn 不绑定 this；异常由当前调用方处理。
 * @param {number} [wait=250] 非负毫秒数，使用运行时墙钟计算间隔。
 * @returns {Function} 仅真正执行时返回 fn 的结果；此函数不能代替异步提交锁。
 *
 * 创建独立前沿节流器，不排队也不安排尾调用。
 * fn：待防抖/节流调用的函数，不自动绑定 this；异步幂等由调用方处理。
 * wait：等待/最短间隔毫秒，默认 250；契约要求非负有效数值。
 */
export function throttle(fn, wait = 250) {
  // last：上次实际节流执行的墙钟毫秒，初值 -Infinity 让首调用立即执行。
  let last = -Infinity
  return (
    /**
     * 间隔足够才执行并记录本次墙钟，否则丢弃。
     * args：该次调用的参数列表；防抖只保留最后一次，节流只接受间隔外调用。
     */
    (...args) => {
      // now：本次节流调用采样的 Date.now 毫秒，用于与 last 比间隔。
      const now = Date.now()
      if (now - last >= wait) {
        last = now
        return fn(...args)
      }
    }
  )
}
/**
 * 按字段顺序执行同步规则，每个字段只保留第一个非空错误文本。
 * @param {Object} model 供规则读取的字段对象，规则不得修改它。
 * @param {Object<string, Function[]>} rules 规则签名为 (value, model) => 文本或空值。
 * @returns {Object<string, string>} 无错误时为空对象；非空的非文本结果（含 Promise）会抛 TypeError。
 *
 * 按字段顺序同步验证，每字段只留第一条错误，拒绝异步规则。
 * model：同步字段验证所读模型；规则不能修改它。
 * rules：字段名到同步规则数组的映射；每规则返回错误文本或空值。
 */
export function validateFields(model, rules) {
  // errors：按字段只保存第一条非空错误的结果对象；无错误为空。
  const errors = {}
  // key：查询键或当前验证字段名；查询时 encodeURIComponent，验证时索引模型。
  // list：当前字段的有序规则列表，逐项执行直到第一个错误。
  for (const [key, list] of Object.entries(rules)) {
    // rule：当前同步验证函数，接收 value/model；Promise 或非空非文本结果拒绝。
    for (const rule of list) {
      // message：当前规则错误文本，或 required 的默认提示；空串表示无错误。
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
// required：必填规则工厂，0/false 通过，不检查集合或对象内容。
export const required =
  /**
   * 构造指定公开提示的必填规则，不猜复杂对象有效性。
   * message：当前规则错误文本，或 required 的默认提示；空串表示无错误。
   */
  (message = '请填写此项') =>
    /**
     * 只对明确定义的空值返回 required 提示，其余返回空串。
     * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
     */
    (value) =>
      isBlank(value) ? message : ''

/**
 * 日期字段保存本地日历 YYYY-MM-DD，不经 UTC ISO 转换，避免时区偏移。
 * @param {number|string|Date} value 数字为毫秒时间戳；空值或无效日期返回空串。
 * @returns {string}
 *
 * 从本地 Date 生成 YYYY-MM-DD，空/无效返回空，避免 UTC 日期偏移。
 * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
 */
export function dateInput(value) {
  if (isBlank(value)) return ''
  // date：由输入解析的本地 Date；无效值返回空/ null，不用 UTC 截日历。
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
/**
 * 将 YYYY-MM-DD 解析为本地正午的毫秒时间戳，不让 Date 自动滚到下个月。
 * @param {string} value 仅接受四位年份日期，按 Date 的本地日历往返核对。
 * @returns {number|null} 空值、格式错误、越界日期或无法往返的日期返回 null。
 *
 * 严格日历文本转本地正午毫秒，往返不一致返回 null。
 * value：待编码/展示/校验的标量；具体空值、日期单位和数值约束见所在函数。
 */
export function dateTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  // year：YYYY-MM-DD 拆出的四位日历年份，需经往返校验避免 Date 自动归一。
  // month：输入的一基月数，构造 Date 时减 1，往返不符拒绝。
  // day：输入的月内日，不能靠 Date 自动溢出到下月接受非法日期。
  const [year, month, day] = value.split('-').map(Number)
  // date：由输入解析的本地 Date；无效值返回空/ null，不用 UTC 截日历。
  const date = new Date(year, month - 1, day, 12)
  return dateInput(date) === value ? date.getTime() : null
}
