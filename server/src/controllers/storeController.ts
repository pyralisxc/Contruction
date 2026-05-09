import { Request, Response } from 'express'
import { StoreService, CartItem } from '../services/storeService'
import { PriceComparisonService } from '../services/priceComparisonService'

const storeService = new StoreService()
const priceComparisonService = new PriceComparisonService()

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
