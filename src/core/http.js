import { createOperation } from './operation.js'
import { fail } from './errors.js'

/**
 * 组合受信任 API 基地址与站内路径，不允许路径覆盖服务端主机。
 * @param {string} baseUrl HTTP(S) 地址，可有路径前缀，不含凭证、查询或片段。
 * @param {string} path 以单个 / 开头，不接受协议地址、空白或反斜杠。
 * @returns {string} 非法基地址/路径分别抛 API_NOT_CONFIGURED / INVALID_PATH。
 *
 * 校验可信基址和站内路径，组合 URL；不允许路径替换主机。
 * baseUrl：可信 HTTP(S) API 基址，可有路径前缀，不含凭证/查询/片段；默认空需接入方配置。
 * path：以单个 / 开头的站内 API 路径；拒绝绝对/协议相对/反斜杠/空白。
 */
export function apiUrl(baseUrl, path) {
  if (!/^https?:\/\/[^/\s?#@]+(?:\/[^\s?#]*)?$/i.test(baseUrl))
    throw fail('API_NOT_CONFIGURED', '请先配置 API 地址')
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\\\s]/.test(path) ||
    path.includes('://')
  )
    throw fail('INVALID_PATH', '只允许站内 API 路径')
  return baseUrl.replace(/\/+$/, '') + path
}

/**
 * 注入平台 request 与会话，返回 { promise, cancel }，promise 只交付原始响应 data。
 * 超时单位毫秒；默认携带当前 Bearer，会话变化后旧响应以 STALE 拒绝。
 * 不重试写操作，不解释业务成功码；authenticated=false 的公开请求不清理会话。
 * @param {Object} options platform、session 为必需适配器，baseUrl 可留空直到接入服务。
 * @returns {Function} request(path, {method,data,headers,authenticated,token})。
 * 配置/路径错误同步抛出；平台/HTTP/会话错误通过返回任务的 promise 拒绝。
 *
 * 创建绑定平台/身份的请求函数，不绑定具体业务端点。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 * baseUrl：可信 HTTP(S) API 基址，可有路径前缀，不含凭证/查询/片段；默认空需接入方配置。
 * session：带 state.revision/token 和 clear 的会话 owner；HTTP 401 仅当前身份可清理。
 * timeoutMs：传输与等待超时毫秒，默认 15000；调用不自动重试。
 */
export function createHttp({ platform, baseUrl = '', session, timeoutMs = 15000 }) {
  return (
    /**
     * 捕获身份代次并创建一次有超时、可取消的传输。
     * path：以单个 / 开头的站内 API 路径；拒绝绝对/协议相对/反斜杠/空白。
     * method：请求方法，默认 GET；写操作是否幂等由接入服务定义。
     * data：传给平台的请求载荷；不猜接口字段、不序列化到 URL 日志。
     * headers：调用方显式头部，默认 {}；认证 token 由当前 session 注入。
     * authenticated：是否捕获应用身份并自动附带 Bearer，默认 true；false 不因 401 清身份。
     * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
     */
    function request(path, { method = 'GET', data, headers = {}, authenticated = true, token } = {}) {
      // url：校验后由固定基址加站内路径形成的目标地址。
      // revision：发送时的会话代次快照；终态比较决定是否拒绝 STALE。
      const url = apiUrl(baseUrl, path),
        revision = session.state.revision
      return createOperation(
        /**
         * 启动平台请求并把回调接到统一终态，返回底层 abort 清理。
         * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
         * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
         */
        (resolve, reject) => {
          // stale：仅认证请求判断会话代次是否变化的闭包。
          const stale =
            /**
             * 判断该认证请求是否属于旧会话，公开请求始终不归旧身份。
             */
            () => authenticated && revision !== session.state.revision
          // task：uni RequestTask，取消时尽力 abort；旧回调仍由 operation 一次终结屏蔽。
          const task = platform.request({
            url,
            method,
            data,
            timeout: timeoutMs,
            header: {
              ...headers,
              ...(authenticated && session.state.token
                ? { Authorization: `Bearer ${session.state.token}` }
                : {}),
            },
            /**
             * 先隔离旧身份再校验 HTTP，只有当前 401 清身份，2xx 返回原始数据。
             * response：平台响应，须有 100..599 整数状态；仅 2xx 交付原始 data。
             */
            success(response) {
              if (stale()) return reject(fail('STALE', '会话已变化'))
              if (
                !Number.isInteger(response.statusCode) ||
                response.statusCode < 100 ||
                response.statusCode > 599
              )
                return reject(fail('DECODE', '响应缺少有效 HTTP 状态'))
              if (response.statusCode === 401 && authenticated) session.clear()
              if (response.statusCode < 200 || response.statusCode >= 300)
                return reject(fail('HTTP', `HTTP ${response.statusCode}`))
              resolve(response.data)
            },
            /**
             * 网络失败仍是拒绝；旧身份优先映射 STALE。
             * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
             */
            fail(error) {
              reject(stale() ? fail('STALE', '会话已变化') : fail('NETWORK', '网络连接失败，请重试', error))
            },
          })
          return (
            /**
             * 取消等待时尽力中止 RequestTask，不能保证服务端副作用已撤销。
             */
            () => task?.abort?.()
          )
        },
        { token, timeoutMs },
      )
    }
  )
}
