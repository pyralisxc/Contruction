import { getCache, setCache } from './simpleCache'

const DEFAULT_HOST = 'https://www.homedepot.com'
const CACHE_KEY = 'robots:homedepot'
const CACHE_TTL = Number(process.env.ROBOTS_CACHE_TTL_MS) || 60 * 60 * 1000 // 1 hour

type RobotsRules = {
  allow: string[]
  disallow: string[]
}

function patternToRegex(pattern: string): RegExp {
  if (!pattern) return /^$/ // won't match
  const anchorEnd = pattern.endsWith('$')
  let p = anchorEnd ? pattern.slice(0, -1) : pattern
  // escape regex specials except * (we'll handle it) and keep ? as literal
  p = p.replace(/([.+^${}()|[\]\\])/g, '\\$1')
  // escape question mark so it is treated literally (robots.txt may include ?)
  p = p.replace(/\?/g, '\\?')
  // convert wildcard * to .*
  p = p.replace(/\*/g, '.*')
  const regex = '^' + p + (anchorEnd ? '$' : '')
  return new RegExp(regex)
}

function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  let collect = false
  const allow: string[] = []
  const disallow: string[] = []

  for (const raw of lines) {
    if (!raw || raw.startsWith('#')) continue
    const idx = raw.indexOf(':')
    if (idx === -1) continue
    const field = raw.slice(0, idx).trim().toLowerCase()
    const value = raw.slice(idx + 1).trim()
    if (field === 'user-agent') {
      collect = value === '*'
      continue
    }
    if (!collect) continue
    if (field === 'allow') {
      allow.push(value)
    } else if (field === 'disallow') {
      // empty Disallow means allow all; represent as empty string (skip)
      if (value.length > 0) disallow.push(value)
    }
  }
  return { allow, disallow }
}

async function fetchRobots(host = DEFAULT_HOST): Promise<RobotsRules> {
  const cached = await getCache(CACHE_KEY)
  if (cached) return cached as RobotsRules

  try {
    const res = await fetch(new URL('/robots.txt', host).toString(), { headers: { 'User-Agent': 'ConstructionApp/1.0 (+https://your-app.example)' } })
    if (!res.ok) {
      // On failure, return permissive default (so we don't break dev), but log a warning
      console.warn('robotsChecker: failed to fetch robots.txt', res.status)
      const empty: RobotsRules = { allow: [], disallow: [] }
      await setCache(CACHE_KEY, empty, CACHE_TTL)
      return empty
    }
    const txt = await res.text()
    const rules = parseRobots(txt)
    await setCache(CACHE_KEY, rules, CACHE_TTL)
    return rules
  } catch (e) {
    console.warn('robotsChecker: exception fetching robots.txt', e)
    const empty: RobotsRules = { allow: [], disallow: [] }
    await setCache(CACHE_KEY, empty, CACHE_TTL)
    return empty
  }
}

function isPathAllowedByRules(pathWithQuery: string, rules: RobotsRules): boolean {
  let bestType: 'allow' | 'disallow' | null = null
  let bestLen = -1

  for (const a of rules.allow) {
    try {
      const re = patternToRegex(a)
      if (re.test(pathWithQuery) && a.length > bestLen) {
        bestType = 'allow'
        bestLen = a.length
      }
    } catch (_) {
      // ignore malformed pattern
    }
  }

  for (const d of rules.disallow) {
    try {
      const re = patternToRegex(d)
      if (re.test(pathWithQuery) && d.length > bestLen) {
        bestType = 'disallow'
        bestLen = d.length
      }
    } catch (_) {
      // ignore
    }
  }

  if (!bestType) return true
  return bestType === 'allow'
}

export async function isAllowedUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr)
    // only enforce for homedepot domains
    if (!/(^|\.)homedepot\.com$/.test(url.hostname)) return true
    const pathWithQuery = url.pathname + (url.search || '')
    const rules = await fetchRobots()
    return isPathAllowedByRules(pathWithQuery, rules)
  } catch (e) {
    // on parsing error, be permissive
    return true
  }
}

export async function getRobots(host = DEFAULT_HOST): Promise<RobotsRules> {
  return fetchRobots(host)
}

export default { isAllowedUrl, getRobots }
