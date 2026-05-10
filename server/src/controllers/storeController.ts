import { Request, Response } from 'express'
import { StoreService, CartItem } from '../services/storeService'
import { PriceComparisonService } from '../services/priceComparisonService'
import { HomeDepotAdapter } from '../adapters'
import ShareCartService from '../services/shareCartService'

const storeService = new StoreService()
const priceComparisonService = new PriceComparisonService()
const shareCartService = new ShareCartService()

// GET /api/store/search?query=&category=&zipCode=&inStockOnly=&sortBy=&sortOrder=
export function searchProducts(req: Request, res: Response): void {
  const { query = '', category, zipCode = '96813', inStockOnly, sortBy, sortOrder, maxPrice, minPrice } = req.query
  const results = storeService.searchProducts({
    query: String(query),
    category: category ? String(category) : undefined,
    zipCode: String(zipCode),
    inStockOnly: inStockOnly === 'true',
    sortBy: (sortBy as 'price' | 'distance' | 'availability') ?? 'price',
    sortOrder: (sortOrder as 'asc' | 'desc') ?? 'asc',
    maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
    minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
  })
  res.json({ products: results })
}

// GET /api/store/stores/:storeId/products
export function getProductsByStore(req: Request, res: Response): void {
  const { storeId } = req.params
  res.json({ products: storeService.getProductsByStore(storeId) })
}

// GET /api/store/stores/:storeId/offers
export async function getOffersByStore(req: Request, res: Response): Promise<void> {
  const { storeId } = req.params
  const query = typeof req.query.query === 'string' ? req.query.query : undefined
  const zipCode = typeof req.query.zipCode === 'string' ? req.query.zipCode : undefined
  try {
    const offers = await storeService.getOffersByStore(storeId, { query, zipCode })
    res.json({ offers })
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch offers' })
  }
}

// POST /api/store/stores/:storeId/map
export async function mapMaterialToSku(req: Request, res: Response): Promise<void> {
  const { storeId } = req.params
  const material = req.body?.material ?? req.body
  if (!material) {
    res.status(400).json({ error: 'missing_material' })
    return
  }

  try {
    if (storeId && storeId.startsWith('hd-') && (HomeDepotAdapter as any).mapMaterialToSku) {
      const mapping = await (HomeDepotAdapter as any).mapMaterialToSku(material)
      res.json({ mapping })
      return
    }
    // fallback: not supported
    res.status(400).json({ error: 'unsupported_store' })
  } catch (err) {
    console.error('mapMaterialToSku error', err)
    res.status(500).json({ error: 'failed_to_map' })
  }
}

// GET /api/store/compare?productNames=2x4,2x6&zipCode=96813
export function comparePrices(req: Request, res: Response): void {
  const raw = req.query.productNames
  const names = typeof raw === 'string' ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const zipCode = typeof req.query.zipCode === 'string' ? req.query.zipCode : '96813'
  const comparisons = priceComparisonService.comparePrices(names, { zipCode })
  res.json({ comparisons })
}

// POST /api/store/cart  body: { items: [{ productId, quantity }] }
export function createCart(req: Request, res: Response): void {
  const items: CartItem[] = Array.isArray(req.body?.items) ? req.body.items : []
  res.json({ cart: storeService.createCart(items) })
}

// POST /api/store/cart/share  body: { items: [{ sku, quantity }] }
export async function createShareableCart(req: Request, res: Response): Promise<void> {
  const items: CartItem[] = Array.isArray(req.body?.items) ? req.body.items : []
  try {
    const cart = storeService.createCart(items)
    const id = await shareCartService.create(cart)
    const shareUrl = `/api/store/cart/share/${id}`
    const shortUrl = `/s/${id}`
    res.json({ id, shareUrl, shortUrl })
  } catch (err) {
    console.error('createShareableCart error', err)
    res.status(500).json({ error: 'failed_to_create_shareable_cart' })
  }
}

export async function getShareableCart(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '')
  try {
    const cart = await shareCartService.get(id)
    if (!cart) {
      res.status(404).send('Not found')
      return
    }
    const html = renderShareableCartHtml(cart as Record<string, any>)
    res.type('text/html').send(html)
  } catch (err) {
    console.error('getShareableCart error', err)
    res.status(500).send('error')
  }
}

// GET /s/:id - short public share URL (friendly)
export async function getShortShareable(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '')
  try {
    const cart = await shareCartService.get(id)
    if (!cart) {
      res.status(404).send('Not found')
      return
    }
    const html = renderShareableCartHtml(cart as Record<string, any>)
    res.type('text/html').send(html)
  } catch (err) {
    console.error('getShortShareable error', err)
    res.status(500).send('error')
  }
}

export async function revokeShareableCart(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '')
  try {
    const existing = await shareCartService.get(id)
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    await shareCartService.del(id)
    res.json({ ok: true })
  } catch (err) {
    console.error('revokeShareableCart error', err)
    res.status(500).json({ error: 'failed_to_revoke' })
  }
}

function renderShareableCartHtml(cart: Record<string, any>) {
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Shareable Cart</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>`
  html += `<h1>Shareable Cart</h1>`
  html += `<p>Items grouped by store. Use the buttons to open product pages or copy CSV/JSON.</p>`
  html += `<div>`
  for (const [storeId, items] of Object.entries(cart)) {
    html += `<section><h2>${(items && items[0] && items[0].product && items[0].product.storeName) || escapeHtml(storeId)}</h2><ul>`
    for (const entry of items as any[]) {
      const p = entry.product
      html += `<li><a href="${escapeAttr(p.productUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.productName ?? p.title ?? p.sku)}</a> &ndash; SKU: ${escapeHtml(String(p.sku))} &ndash; Qty: ${Number(entry.quantity)}</li>`
    }
    html += `</ul><button onclick="openStore('${escapeAttr(storeId)}')">Open all items for this store</button></section>`
  }
  html += `</div>`
  html += `<p><button id="openAll">Open all stores</button> <button id="copyJson">Copy JSON</button> <button id="downloadCsv">Download CSV</button></p>`
  html += `<script>
    const cart = ${JSON.stringify(cart)}
    function openStore(storeId) {
      const items = cart[storeId] || []
      for (const entry of items) {
        try { window.open(entry.product.productUrl, '_blank') } catch(e) {}
      }
    }
    document.getElementById('openAll').addEventListener('click', () => { for (const s of Object.keys(cart)) openStore(s) })
    document.getElementById('copyJson').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(cart, null, 2)); alert('Copied JSON to clipboard') } catch(e) { alert('Clipboard write failed') } })
    document.getElementById('downloadCsv').addEventListener('click', () => {
      const rows = [['storeId','sku','title','quantity','productUrl']]
      for (const [storeId, items] of Object.entries(cart)) {
        for (const entry of items) rows.push([storeId, entry.product.sku, entry.product.productName || entry.product.title || '', String(entry.quantity), entry.product.productUrl])
      }
      const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')
      const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'cart.csv'; document.body.appendChild(a); a.click(); a.remove();
    })
  </script>`
  html += `</body></html>`
  return html
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>\"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c] || c))
}

function escapeAttr(s: string) {
  return String(s).replace(/["']/g, (c) => (c === '"' ? '&quot;' : '&#39;'))
}

// GET /api/store/nearby?zipCode=96813&radius=10
export function getNearbyStores(req: Request, res: Response): void {
  const zipCode = typeof req.query.zipCode === 'string' ? req.query.zipCode : '96813'
  const radius = req.query.radius !== undefined ? Number(req.query.radius) : 10
  res.json({ stores: storeService.getNearbyStores(zipCode, radius) })
}

// GET /api/store/settings?userId=default
export function getSettings(req: Request, res: Response): void {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : 'default'
  res.json({ settings: storeService.getSettings(userId) })
}

// PUT /api/store/settings?userId=default  body: settings object
export function updateSettings(req: Request, res: Response): void {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : 'default'
  res.json({ settings: storeService.updateSettings(userId, req.body) })
}
