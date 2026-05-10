/**
 * Home Depot adapter — compliance notes
 *
 * WARNING: This adapter includes an "unofficial" scraping mode that calls Home Depot
 * JSON endpoints and uses heuristic parsing. Running in `unofficial` or `live` mode
 * may violate Home Depot's Terms of Service or robots.txt. Keep `HOMEDPOT_MODE=mock`
 * by default. See docs/HOMEDEPOT_ADAPTER_COMPLIANCE.md for a full checklist and
 * recommended remediation steps before enabling on shared infrastructure.
 *
 * Key risks:
 *  - Unauthorized scraping may result in IP blocks or legal action.
 *  - Inventory/price endpoints can be rate-limited or change format without notice.
 *  - Do NOT automate checkout flows or place orders using this adapter.
 *
 * Engineering controls in this repo:
 *  - Per-adapter token bucket rate limiter (`RateLimiter`).
 *  - Best-effort caching via `simpleCache` (Redis optional).
 *  - `HOMEDPOT_MODE` env toggle to keep unsafe paths opt-in.
 */
import StoreDataProvider from '../services/storeDataProvider'
import { Material, NormalizedOffer, StoreAdapter as SharedStoreAdapter } from '../../../shared/types/store'
import { getCache, setCache } from '../utils/simpleCache'
import { RateLimiter } from '../utils/rateLimiter'
import { isAllowedUrl } from '../utils/robotsChecker'
import { collectProductEntries, extractNumericStoreId } from '../experimental/homedepotScrapers'

function safeFetch(): typeof fetch {
  if (typeof fetch !== 'undefined') return fetch
  throw new Error('Global fetch is not available in this runtime. Run on Node 18+ or add a fetch polyfill.')
}

export class HomeDepotAdapter implements SharedStoreAdapter {
  readonly storeId = 'hd-1001'
  readonly storeType = 'homeDepot'

  private mode = (process.env.HOMEDPOT_MODE || 'mock')

  private isUnofficialEnabled(): boolean {
    // require explicit opt-in and local development environment
    return this.mode === 'unofficial' && process.env.ALLOW_UNOFFICIAL === 'true' && process.env.NODE_ENV === 'development'
  }

  private async fetchJson(url: string, ttlMs = 0) {
    const limiter = (HomeDepotAdapter as any)._rateLimiter as RateLimiter | undefined
    if (limiter) {
      // wait up to 2s for a token
      await limiter.waitForToken(2000)
    }
    const key = `hd:${url}`
    const cached = await getCache(key)
    if (cached) return cached
    const f = safeFetch()
    // check robots.txt first — log and throw a descriptive error when disallowed
    try {
      const allowed = await isAllowedUrl(url)
      if (!allowed) {
        console.warn(`[robotsChecker] SKIP URL disallowed by robots.txt: ${url}`)
        throw new Error(`robots_disallowed:${url}`)
      }
    } catch (err) {
      // If fetch of robots.txt failed, `isAllowedUrl` is permissive; only log unexpected exceptions
      if (err instanceof Error && err.message.startsWith('robots_disallowed')) throw err
      // otherwise log and continue — be permissive on robots fetch errors
    }

    const res = await f(url, {
      headers: {
        'User-Agent': 'ConstructionApp/1.0 (+https://your-app.example)',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    })
    if (!res.ok) throw new Error(`fetch ${url} failed ${res.status}`)
    const json = await res.json().catch(() => null)
    if (ttlMs && json) setCache(key, json, ttlMs)
    return json
  }

  async search(query: string, params?: any): Promise<NormalizedOffer[]> {
    // If unofficial scraping is not enabled (requires explicit opt-in + dev env), fall back to provider
    if (!this.isUnofficialEnabled()) {
      const products = await StoreDataProvider.searchProducts({ query, zipCode: params?.zipCode || '96813', ...params })
      return products.map((p: any) => this.normalizeFromProvider(p))
    }

    // Unofficial search endpoint
    try {
      const searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(query)}.json`
      const searchJson = await this.fetchJson(searchUrl, 5 * 60 * 1000)
      const entries = collectProductEntries(searchJson || [])
      const ids = Array.from(new Set(entries.map((e: any) => e.productId || e.product_id || e.itemId || e.id))).filter(Boolean).slice(0, 12)

      const offers: NormalizedOffer[] = []
      const storeNum = extractNumericStoreId(params?.storeId)

      for (const id of ids) {
        try {
          const prodUrl = `https://www.homedepot.com/product/api/product/${id}`
          const prodJson = await this.fetchJson(prodUrl, 15 * 60 * 1000)
          const sku = prodJson?.sku || prodJson?.itemId || prodJson?.productId || (prodJson?.product || {}).sku || String(id)
          const title = prodJson?.productTitle || prodJson?.productName || prodJson?.title || (prodJson?.product || {}).title || prodJson?.name || ''
          const price = Number(prodJson?.price || prodJson?.pricePerUnit || (prodJson?.pricing && prodJson.pricing?.price) || 0) || 0
          let quantityAvailable = prodJson?.inventory || 0
          let inStock = prodJson?.inStock ?? !!quantityAvailable

          // If a specific store is requested, fetch inventory for that store
          if (storeNum) {
            try {
              const invUrl = `https://www.homedepot.com/product/api/inventory?storeId=${storeNum}&productId=${id}`
              const inv = await this.fetchJson(invUrl, 30 * 1000)
              // heuristics to find inventory
              const invQty = inv?.available || inv?.inventory || inv?.quantity || (inv?.stores && inv.stores[0] && (inv.stores[0].available || inv.stores[0].inventory))
              if (typeof invQty === 'number') quantityAvailable = invQty
              const invInStock = inv?.inStock ?? (quantityAvailable > 0)
              if (typeof invInStock === 'boolean') inStock = invInStock
            } catch (e) {
              // ignore inventory errors, leave product-level values
            }
          }

          const offer: NormalizedOffer = {
            offerId: `hd-unofficial-${id}-${sku}`,
            storeId: params?.storeId || this.storeId,
            storeName: params?.storeName || 'Home Depot (unofficial)',
            storeType: 'homeDepot',
            sku: String(sku),
            title: String(title),
            price: Number(price) || 0,
            currency: 'USD',
            unit: 'each',
            packSize: 1,
            unitPrice: Number(price) || 0,
            quantityAvailable: Number(quantityAvailable) || 0,
            inStock: !!inStock,
            leadTimeDays: undefined,
            productUrl: `https://www.homedepot.com/p/${id}`,
            imageUrl: (prodJson?.product || prodJson)?.images?.[0] || prodJson?.image || null,
            meta: { raw: prodJson },
            lastUpdated: new Date().toISOString(),
          }
          offers.push(offer)
        } catch (e) {
          // skip a single product failure
        }
      }

      return offers
    } catch (err) {
      // If the outer search failed (for example robots blocked the search endpoint), log and fall back to provider
      if (err instanceof Error && err.message.startsWith('robots_disallowed')) {
        console.warn('[HomeDepotAdapter] Search skipped; robots disallowed:', String(err.message))
      }
      const products = await StoreDataProvider.searchProducts({ query, zipCode: params?.zipCode || '96813', ...params })
      return products.map((p: any) => this.normalizeFromProvider(p))
    }
  }

  async getBySku(sku: string): Promise<NormalizedOffer | null> {
    if (!this.isUnofficialEnabled()) {
      const products = await StoreDataProvider.searchProducts({ query: sku })
      const product = products.find((p: any) => p.sku === sku)
      return product ? this.normalizeFromProvider(product) : null
    }
    // best effort: search and match sku
    const offers = await this.search(sku, {})
    return offers.find((o) => o.sku === sku) ?? null
  }

  async getProductsByStore(storeId: string): Promise<NormalizedOffer[]> {
    // If unofficial scraping is not enabled, fall back to provider mock
    if (!this.isUnofficialEnabled()) {
      const products = await StoreDataProvider.getProductsByStore(storeId)
      return products.map((p: any) => this.normalizeFromProvider(p))
    }
    // For now, product enumeration is not supported in unofficial mode; return provider data
    const products = await StoreDataProvider.getProductsByStore(storeId)
    return products.map((p: any) => this.normalizeFromProvider(p))
  }

  normalizeFromProvider(product: any): NormalizedOffer {
    const offerId = `hd-${product.sku}-${product.id}`
    const packSize = product.unit === 'box' || product.unit === 'each' ? 1 : undefined
    const unitPrice = product.price
    return {
      offerId,
      storeId: product.storeId,
      storeName: product.storeName,
      storeType: 'homeDepot',
      sku: product.sku,
      title: product.productName,
      price: product.price,
      currency: 'USD',
      unit: product.unit,
      packSize,
      unitPrice,
      quantityAvailable: product.quantityAvailable,
      inStock: product.inStock,
      leadTimeDays: undefined,
      productUrl: product.productUrl,
      imageUrl: product.imageUrl,
      meta: { category: product.category, subcategory: product.subcategory },
      lastUpdated: product.lastUpdated?.toString?.() ?? new Date().toISOString(),
    }
  }

  async mapMaterialToSku(material: Material) {
    const offers = await this.search(material.name, {})
    if (!offers || offers.length === 0) return null
    const exact = offers.find((o) => o.title.toLowerCase() === material.name.toLowerCase())
    const match = exact || offers[0]
    const confidence = exact ? 0.95 : 0.6
    return { materialId: material.id, storeId: match.storeId, sku: match.sku, confidence, mappedAt: new Date().toISOString(), notes: 'fuzzy match (unofficial)' }
  }
}

// configure a per-adapter rate limiter (requests per minute)
(HomeDepotAdapter as any)._rateLimiter = new RateLimiter(Number(process.env.HOMEDPOT_RATE_LIMIT_PER_MIN) || 30)

export default new HomeDepotAdapter()
