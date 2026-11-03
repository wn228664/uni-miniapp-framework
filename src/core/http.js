import { createOperation } from './operation.js'
import { fail } from './errors.js'

/**
 * 组合受信任 API 基地址与站内路径，不允许路径覆盖服务端主机。
 * @param {string} baseUrl HTTP(S) 地址，可有路径前缀，不含凭证、查询或片段。
 * @param {string} path 以单个 / 开头，不接受协议地址、空白或反斜杠。
 * @returns {string} 非法基地址/路径分别抛 API_NOT_CONFIGURED / INVALID_PATH。
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
 */
export function createHttp({ platform, baseUrl = '', session, timeoutMs = 15000 }) {
  return function request(path, { method = 'GET', data, headers = {}, authenticated = true, token } = {}) {
    const url = apiUrl(baseUrl, path),
      revision = session.state.revision
    return createOperation(
      (resolve, reject) => {
        const stale = () => authenticated && revision !== session.state.revision
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
          fail(error) {
            reject(stale() ? fail('STALE', '会话已变化') : fail('NETWORK', '网络连接失败，请重试', error))
          },
        })
        return () => task?.abort?.()
      },
      { token, timeoutMs },
    )
  }
}
