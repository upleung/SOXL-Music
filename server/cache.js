/**
 * 简单的内存缓存模块，带 TTL（过期时间）
 * 替代 Cloudflare 的 caches.default API
 */

class SimpleCache {
  constructor() {
    /** @type {Map<string, { body: Buffer|string, contentType: string, expires: number }>} */
    this._map = new Map();

    // 每 5 分钟清理一次过期条目，防止内存泄漏
    setInterval(() => this._cleanup(), 5 * 60 * 1000).unref();
  }

  /**
   * 存入缓存
   * @param {string} key
   * @param {{ body: Buffer|string, contentType: string }} value
   * @param {number} ttlSeconds 默认 300 秒
   */
  set(key, value, ttlSeconds = 300) {
    this._map.set(key, {
      ...value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * 从缓存读取
   * @param {string} key
   * @returns {{ body: Buffer|string, contentType: string } | null}
   */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this._map.delete(key);
      return null;
    }
    const { expires, ...value } = entry;
    return value;
  }

  /** 清理过期条目 */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._map) {
      if (now > entry.expires) this._map.delete(key);
    }
  }
}

module.exports = new SimpleCache();
