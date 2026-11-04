import { createOperation } from './operation.js'
import { fail } from './errors.js'

/**
 * 系统选择器无法强制关闭时，取消只停止消费结果；压缩能力按目标平台验证。
 * @param {Object} platform chooseImage/compressImage 平台适配器。
 * @returns {Object} chooseImage({token})、compressImage(src,{quality,token})，均返回任务句柄。
 * 选择最多一张图，结果保留平台结构；压缩返回临时路径，quality 为 0..100 整数。
 * 选择/压缩超时分别为 120000/20000 毫秒；quality 越界同步抛 RangeError，其它失败走 promise。
 *
 * 创建图片能力适配器；选择/压缩各有独立 timeout 与取消 token。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 */
export function createMedia(platform) {
  return {
    /**
     * 最多选择一张压缩尺寸图片，等待上限 120000ms；系统选择器未必可强制关闭。
     * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
     */
    chooseImage({ token } = {}) {
      return createOperation(
        /**
         * 把平台选择结果原样交付，失败交给取消分类器。
         * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
         * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
         */
        (resolve, reject) => {
          platform.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            success: resolve,
            fail:
              /**
               * 识别平台 cancel 文本，取消不当作媒体故障反馈。
               * error：平台选择/压缩失败值；选择取消转 CANCELLED，其余转 MEDIA 并保留 cause。
               */
              (error) =>
                reject(fail(error.errMsg?.includes('cancel') ? 'CANCELLED' : 'MEDIA', '无法选择图片', error)),
          })
        },
        { token, timeoutMs: 120000 },
      )
    },
    /**
     * 校验 quality 后压缩临时图，等待上限 20000ms，不持久化。
     * src：待压缩的本地临时图片路径；由平台选择结果提供。
     * quality：压缩质量整数 0..100，默认 80；非法值同步抛 RangeError。
     * token：本次任务的可取消 token；取消后不能再交付结果，已发生的外部副作用不能撤销。
     */
    compressImage(src, { quality = 80, token } = {}) {
      if (!Number.isInteger(quality) || quality < 0 || quality > 100)
        throw new RangeError('quality 为 0..100 的整数')
      return createOperation(
        /**
         * 能力缺失拒绝 UNSUPPORTED，否则启动平台压缩。
         * resolve：当前 Promise 的成功终结器；交付载荷，不代表业务接口成功。
         * reject：当前 Promise 的失败终结器；保留取消、超时和平台失败的拒绝通道。
         */
        (resolve, reject) => {
          if (typeof platform.compressImage !== 'function')
            return reject(fail('UNSUPPORTED', '当前平台不支持压缩'))
          platform.compressImage({
            src,
            quality,
            success:
              /**
               * 只交付非空 tempFilePath，空压缩结果拒绝 MEDIA。
               * result：平台压缩回调结果；tempFilePath 非空才交付临时路径。
               */
              (result) =>
                result.tempFilePath ? resolve(result.tempFilePath) : reject(fail('MEDIA', '压缩结果为空')),
            fail:
              /**
               * 将平台压缩失败映射成 MEDIA，保留原错误为 cause。
               * error：平台选择/压缩失败值；选择取消转 CANCELLED，其余转 MEDIA 并保留 cause。
               */
              (error) => reject(fail('MEDIA', '图片压缩失败', error)),
          })
        },
        { token, timeoutMs: 20000 },
      )
    },
  }
}
