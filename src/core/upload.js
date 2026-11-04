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
 *
 * 创建绑定可信来源和会话的上传器，不内置业务端点。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 * baseUrl：可信 API 基址，默认空；上传路径同样经 apiUrl 限定来源。
 * session：当前身份 owner，上传回调必须校验发送时代次。
 * timeoutMs：整个上传等待上限，毫秒默认 60000；超时取消并释放进度监听。
 */
export function createUpload({ platform, baseUrl = '', session, timeoutMs = 60000 }) {
  return (
    /**
     * 校验必填 decode/文件路径并捕获会话，返回独立可取消句柄。
     * path：站内上传端点路径；真实 method/字段/响应由接入服务契约提供。
     * filePath：本地临时文件路径，必需非空字符串；不允许把远端 URL 当成本地授权。
     * decode：同步响应解码器，必需；成功须返回 HTTP(S) 资源 URL，不猜 data.url。
     * onProgress：可选公开进度观察者，接收 0..100；不能代替上传完成判定。
     * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
     * formData：额外标量表单字段，默认 {}；字段契约由服务层提供。
     * name：multipart 文件字段名，默认 file；接入服务须核对真实契约。
     */
    (path, filePath, { decode, onProgress, token, formData = {}, name = 'file' } = {}) => {
      if (typeof decode !== 'function') throw new TypeError('必须提供上传响应 decode')
      if (!filePath || typeof filePath !== 'string') throw new TypeError('请选择文件')
      // url：固定 API 基址与站内路径组合的上传 URL。
      // revision：开始上传时的身份代次，旧会话结果拒绝 STALE。
      const url = apiUrl(baseUrl, path),
        revision = session.state.revision
      return createOperation(
        /**
         * 启动一次平台上传，进度和终态共用当前周期约束。
         * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
         * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
         */
        (resolve, reject) => {
          // ended：本轮上传是否已结束，初值 false；阻止结束后继续进度反馈。
          // task：uni UploadTask；终态 offProgressUpdate，取消再 abort。
          let ended = false,
            task
          // current：同时检查 ended 与会话代次的有效性闭包。
          const current =
            /**
             * 只有未结束且身份未变的上传才有效。
             */
            () => !ended && revision === session.state.revision
          // finish：统一结束上传并移除进度观察，再执行 resolve/reject。
          const finish =
            /**
             * 先标记结束并解绑进度，再交付结果或错误。
             * fn：本轮所选的成功/失败终结器；finish 必须先释放观察者。
             * value：交给所选终结器的 URL 或分类失败。
             */
            (fn, value) => {
              ended = true
              task?.offProgressUpdate?.(progress)
              fn(value)
            }
          // progress：上传平台进度监听引用；只在有效周期转发 0..100。
          const progress =
            /**
             * 有效周期内夹取平台进度并通知观察者。
             * event：平台进度事件；progress 夹取到 0..100 后才通知。
             */
            (event) => {
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
            /**
             * 隔离旧身份、校验 HTTP 并调用同步 decode；非法业务输出拒绝 DECODE。
             * response：平台上传响应，须有有效 HTTP 状态；2xx 仍需 decode 校验 URL。
             */
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
                // result：decode 解析出的候选 HTTP(S) URL，不是原始响应对象。
                const result = decode(response.data)
                if (typeof result !== 'string' || !/^https?:\/\//i.test(result))
                  throw new Error('缺少有效图片 URL')
                finish(resolve, result)
              } catch (error) {
                // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

                finish(reject, fail('DECODE', '上传响应无效', error))
              }
            },
            /**
             * 上传失败保持拒绝，旧身份优先 STALE。
             * error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。
             */
            fail(error) {
              finish(
                reject,
                current() ? fail('UPLOAD', '上传失败，请重试', error) : fail('STALE', '会话已变化'),
              )
            },
          })
          if (ended) task?.offProgressUpdate?.(progress)
          else task?.onProgressUpdate?.(progress)
          return (
            /**
             * 取消时先屏蔽进度，再解绑观察并中止底层上传。
             */
            () => {
              ended = true
              task.offProgressUpdate?.(progress)
              task.abort?.()
            }
          )
        },
        { token, timeoutMs },
      )
    }
  )
}
