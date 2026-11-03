import { createOperation } from './operation.js'
import { apiUrl } from './http.js'
import { fail } from './errors.js'

/**
 * 一个本地文件对应一个可取消任务；decode(raw) 必须同步返回 HTTP(S) 资源 URL。
 * onProgress 接收 0..100；完成、取消和超时均释放进度监听，旧会话结果不能回填。
 * 上传参数和业务响应结构由服务层依据真实接口提供，不猜 data.url 等字段。
 * @param {Object} options platform、session 为必需适配器，timeoutMs 默认 60000 毫秒。
 * @returns {Function} upload(path,filePath,{decode,onProgress,token,formData,name}) -> {promise,cancel}。
 * 必填参数错误同步抛出；HTTP、解析、网络和会话错误通过 promise 拒绝。
 */
export function createUpload({ platform, baseUrl = '', session, timeoutMs = 60000 }) {
  return (path, filePath, { decode, onProgress, token, formData = {}, name = 'file' } = {}) => {
    if (typeof decode !== 'function') throw new TypeError('必须提供上传响应 decode')
    if (!filePath || typeof filePath !== 'string') throw new TypeError('请选择文件')
    const url = apiUrl(baseUrl, path),
      revision = session.state.revision
    return createOperation(
      (resolve, reject) => {
        let ended = false,
          task
        const current = () => !ended && revision === session.state.revision
        const finish = (fn, value) => {
          ended = true
          task?.offProgressUpdate?.(progress)
          fn(value)
        }
        const progress = (event) => {
          if (current()) onProgress?.(Math.max(0, Math.min(100, event.progress)))
        }
        // uni.uploadFile 是异步平台接口，回调结束即解除文件进度监听。
        task = platform.uploadFile({
          url,
          filePath,
          name,
          formData,
          timeout: timeoutMs,
          header: session.state.token ? { Authorization: `Bearer ${session.state.token}` } : {},
          success(response) {
            if (!current()) return finish(reject, fail('STALE', '会话已变化'))
            if (
              !Number.isInteger(response.statusCode) ||
              response.statusCode < 100 ||
              response.statusCode > 599
            )
              return finish(reject, fail('DECODE', '响应缺少有效 HTTP 状态'))
            if (response.statusCode === 401) session.clear()
            if (response.statusCode < 200 || response.statusCode >= 300)
              return finish(reject, fail('HTTP', `HTTP ${response.statusCode}`))
            try {
              const result = decode(response.data)
              if (typeof result !== 'string' || !/^https?:\/\//i.test(result))
                throw new Error('缺少有效图片 URL')
              finish(resolve, result)
            } catch (error) {
              finish(reject, fail('DECODE', '上传响应无效', error))
            }
          },
          fail(error) {
            finish(
              reject,
              current() ? fail('UPLOAD', '上传失败，请重试', error) : fail('STALE', '会话已变化'),
            )
          },
        })
        if (ended) task?.offProgressUpdate?.(progress)
        else task?.onProgressUpdate?.(progress)
        return () => {
          ended = true
          task.offProgressUpdate?.(progress)
          task.abort?.()
        }
      },
      { token, timeoutMs },
    )
  }
}
