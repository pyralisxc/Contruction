type CacheEntry = { value: any; expiresAt: number }

const store: Map<string, CacheEntry> = new Map()

let redisClient: any = null
if (process.env.REDIS_URL) {
  try {
    // require at runtime so installation is optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require('ioredis')
    redisClient = new IORedis(process.env.REDIS_URL)
  } catch (e) {
    // ignore - fall back to in-memory store
    console.warn('Redis not available, falling back to in-memory cache')
    redisClient = null
  }
}

export async function getCache(key: string) {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key)
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch (e) {
          return raw
        }
      }
    } catch (e) {
      // fall back to memory
    }
  }

  const e = store.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    store.delete(key)
    return null
  }
  return e.value
}

export function setCache(key: string, value: any, ttlMs = 0) {
  if (redisClient) {
    try {
      const ttlSec = Math.max(1, Math.floor(ttlMs / 1000))
      // best-effort async set (don't await)
      redisClient.set(key, JSON.stringify(value), 'EX', ttlSec).catch(() => {})
      // also set the in-memory cache so reads are immediately consistent for this process
      // (Redis writes are async; this avoids race conditions between create/get/delete flows)
    } catch (e) {
      // fall through to memory cache
    }
  }

  const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : Number.POSITIVE_INFINITY
  store.set(key, { value, expiresAt })
}

export function delCache(key: string) {
  if (redisClient) {
    try {
      redisClient.del(key).catch(() => {})
    } catch (e) {
      // ignore
    }
  }
  store.delete(key)
}

export default { getCache, setCache, delCache }
