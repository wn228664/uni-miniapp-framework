import { createOperation } from './operation.js'
import { fail } from './errors.js'

/**
 * 系统选择器无法强制关闭时，取消只停止消费结果；压缩能力按目标平台验证。
 * @param {Object} platform chooseImage/compressImage 平台适配器。
 * @returns {Object} chooseImage({token})、compressImage(src,{quality,token})，均返回任务句柄。
 * 选择最多一张图，结果保留平台结构；压缩返回临时路径，quality 为 0..100 整数。
 * 选择/压缩超时分别为 120000/20000 毫秒；quality 越界同步抛 RangeError，其它失败走 promise。
 */
export function createMedia(platform) {
  return {
    chooseImage({ token } = {}) {
      return createOperation(
        (resolve, reject) => {
          platform.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            success: resolve,
            fail: (error) =>
              reject(fail(error.errMsg?.includes('cancel') ? 'CANCELLED' : 'MEDIA', '无法选择图片', error)),
          })
        },
        { token, timeoutMs: 120000 },
      )
    },
    compressImage(src, { quality = 80, token } = {}) {
      if (!Number.isInteger(quality) || quality < 0 || quality > 100)
        throw new RangeError('quality 为 0..100 的整数')
      return createOperation(
        (resolve, reject) => {
          if (typeof platform.compressImage !== 'function')
            return reject(fail('UNSUPPORTED', '当前平台不支持压缩'))
          platform.compressImage({
            src,
            quality,
            success: (result) =>
              result.tempFilePath ? resolve(result.tempFilePath) : reject(fail('MEDIA', '压缩结果为空')),
            fail: (error) => reject(fail('MEDIA', '图片压缩失败', error)),
          })
        },
        { token, timeoutMs: 20000 },
      )
    },
  }
}
