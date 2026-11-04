import { fail } from './errors.js'

/**
 * 只保存可 JSON 序列化的普通数据，不承担安全凭证存储。
 * @param {Object} platform get/set/removeStorageSync 适配器。
 * @param {string} [namespace='mini-framework'] 只访问此前缀下的键。
 * @param {Function} [now=Date.now] 返回毫秒时间戳，便于固定 TTL 测试时钟。
 * @returns {Object} get(key,fallback)、set(key,value,ttlMs)、remove(key)。
 * get 读取失败/损坏时返回 fallback；版本不符/过期只尝试删除当前键；null/undefined 也返回 fallback。
 * TTL 为正毫秒或 null（永不过期）；set/remove 失败抛 STORAGE，不清空其它存储。
 *
 * 创建命名空间 JSON 偏好服务；读取容错，写删失败明确抛 STORAGE。
 * platform：注入的 uni 同形 API 适配器；生产来自 platform/uni，测试不得调用真实平台。
 * namespace：存储键前缀，默认 mini-framework；只访问此前缀，不全清平台存储。
 * now：返回毫秒时间戳的同步时钟，默认 Date.now；测试可固定以验证 TTL。
 */
export function createStorage(platform, namespace = 'mini-framework', now = Date.now) {
  // keyOf：把逻辑偏好键限定到当前 namespace 的纯函数。
  const keyOf =
    /**
     * 组合命名空间和逻辑键，不访问其它应用前缀。
     * key：普通非敏感偏好的逻辑键，不用于安全凭据。
     */
    (key) => `${namespace}:${key}`
  return {
    /**
     * 读取版本 1 未过期值；异常回退，过期仅删除此键。
     * key：普通非敏感偏好的逻辑键，不用于安全凭据。
     * fallback：缺失/损坏/版本不符/到期/读取失败时的返回值，默认 null。
     */
    get(key, fallback = null) {
      try {
        // raw：平台同步读取的 JSON 文本，缺失时直接回退。
        const raw = platform.getStorageSync(keyOf(key))
        if (!raw) return fallback
        // entry：version/expiresAt/value 包装对象；只接受 version=1 的本格式。
        const entry = JSON.parse(raw)
        if (entry.version !== 1 || (entry.expiresAt !== null && entry.expiresAt <= now())) {
          platform.removeStorageSync(keyOf(key))
          return fallback
        }
        return entry.value ?? fallback
      } catch {
        return fallback
      }
    },
    /**
     * 校验 TTL 后写版本信封；失败不伪造保存成功。
     * key：普通非敏感偏好的逻辑键，不用于安全凭据。
     * value：待序列化的普通偏好值；循环对象等序列化失败拒绝 STORAGE。
     * ttlMs：有效期毫秒，null 表示永不过期，其余必须为有限正数。
     */
    set(key, value, ttlMs = null) {
      if (ttlMs !== null && (!Number.isFinite(ttlMs) || ttlMs <= 0)) throw new RangeError('TTL 必须大于 0')
      try {
        platform.setStorageSync(
          keyOf(key),
          JSON.stringify({ version: 1, expiresAt: ttlMs === null ? null : now() + ttlMs, value }),
        )
      } catch (error) {
        // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

        throw fail('STORAGE', '无法保存本地数据', error)
      }
    },
    /**
     * 只删除当前逻辑键，失败继续以 STORAGE 抛出。
     * key：普通非敏感偏好的逻辑键，不用于安全凭据。
     */
    remove(key) {
      try {
        platform.removeStorageSync(keyOf(key))
      } catch (error) {
        // error：当前捕获的失败值；取消类错误不生成新的用户失败提示，其余按所在入口反馈。

        throw fail('STORAGE', '无法清理本地数据', error)
      }
    },
  }
}
