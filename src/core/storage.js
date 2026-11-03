import { fail } from './errors.js'

/**
 * 只保存可 JSON 序列化的普通数据，不承担安全凭证存储。
 * @param {Object} platform get/set/removeStorageSync 适配器。
 * @param {string} [namespace='mini-framework'] 只访问此前缀下的键。
 * @param {Function} [now=Date.now] 返回毫秒时间戳，便于固定 TTL 测试时钟。
 * @returns {Object} get(key,fallback)、set(key,value,ttlMs)、remove(key)。
 * get 读取失败/损坏时返回 fallback；版本不符/过期只尝试删除当前键；null/undefined 也返回 fallback。
 * TTL 为正毫秒或 null（永不过期）；set/remove 失败抛 STORAGE，不清空其它存储。
 */
export function createStorage(platform, namespace = 'mini-framework', now = Date.now) {
  const keyOf = (key) => `${namespace}:${key}`
  return {
    get(key, fallback = null) {
      try {
        const raw = platform.getStorageSync(keyOf(key))
        if (!raw) return fallback
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
    set(key, value, ttlMs = null) {
      if (ttlMs !== null && (!Number.isFinite(ttlMs) || ttlMs <= 0)) throw new RangeError('TTL 必须大于 0')
      try {
        platform.setStorageSync(
          keyOf(key),
          JSON.stringify({ version: 1, expiresAt: ttlMs === null ? null : now() + ttlMs, value }),
        )
      } catch (error) {
        throw fail('STORAGE', '无法保存本地数据', error)
      }
    },
    remove(key) {
      try {
        platform.removeStorageSync(keyOf(key))
      } catch (error) {
        throw fail('STORAGE', '无法清理本地数据', error)
      }
    },
  }
}
