import { randomBytes } from 'crypto'
import cache from '../utils/simpleCache'

export class ShareCartService {
  ttlMs: number
  prefix: string

  constructor(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs
    this.prefix = 'sharecart:'
  }

  async create(cart: unknown): Promise<string> {
    const id = randomBytes(6).toString('hex')
    const key = this.prefix + id
    try {
      cache.setCache(key, cart, this.ttlMs)
      // If the cache backend is async (Redis) the write above is best-effort and may not be
      // immediately visible. Poll briefly (up to 1s) so callers that immediately GET or DELETE
      // the id will observe the persisted value in local dev/staging where Redis is used.
      const start = Date.now()
      while (Date.now() - start < 1000) {
        // eslint-disable-next-line no-await-in-loop
        const v = await cache.getCache(key)
        if (v != null) break
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50))
      }
    } catch (e) {
      // best-effort
      console.warn('failed to persist share cart', e)
    }
    return id
  }

  async get(id: string): Promise<unknown | null> {
    const key = this.prefix + id
    try {
      const v = await cache.getCache(key)
      return v ?? null
    } catch (e) {
      return null
    }
  }

  async del(id: string): Promise<void> {
    const key = this.prefix + id
    try {
      cache.delCache(key)
    } catch (e) {
      // ignore
    }
  }
}

export default ShareCartService
