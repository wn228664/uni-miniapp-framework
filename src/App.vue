<script>
/** uni 应用异常入口：同步异常与未处理拒绝统一交给有限日志投影；不序列化令牌、用户输入或平台原始错误。 */

import { reportError } from './core/logger.js'
export default {
  /**
   * 记录应用异常类别，不把异常当成成功。
   * error：uni 应用异常值，只交给 reportError 读取错误类别。
   */
  onError(error) {
    reportError('app', error)
  },
  /**
   * 记录未处理 Promise 的错误类别，不输出完整 reason。
   * event：未处理 Promise 拒绝事件；仅取 reason，不保存整份事件。
   */
  onUnhandledRejection(event) {
    reportError('promise', event.reason)
  },
}
</script>
<style lang="scss">
@import 'uview-plus/index.scss';
@import './styles/app.scss';
</style>
