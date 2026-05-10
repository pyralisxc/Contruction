export interface Address {
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface StoreProduct {
  id: string
  storeId: string
  storeName: string
  storeType: 'homeDepot' | 'lowes' | 'ace' | 'menards' | 'local'
  address: Address
  lat: number
  lng: number
  productName: string
  category: string
  subcategory: string
  sku: string
  upc: string
  price: number
  unit: 'each' | 'sqft' | 'linearft' | 'lb' | 'gallon' | 'box'
  quantityAvailable: number
  inStock: boolean
  imageUrl: string
  productUrl: string
  lastUpdated: string
}

export interface StoreSearchParams {
  query: string
  category?: string
  zipCode: string
  radius?: number
  maxPrice?: number
  minPrice?: number
  inStockOnly?: boolean
  sortBy?: 'price' | 'distance' | 'availability'
  sortOrder?: 'asc' | 'desc'
}

export interface PriceOption {
  storeId: string
  storeName: string
  storeType: string
  distance: number
  price: number
  totalPrice: number
  inStock: boolean
  quantityAvailable: number
  productUrl: string
  estimatedTax: number
  estimatedTotal: number
}

export interface PriceComparison {
  productName: string
  category: string
  quantity: number
  unit: string
  options: PriceOption[]
  bestPrice: PriceOption
  savings: number
}

export interface CartItem {
  productId: string
  quantity: number
}

const MOCK_PRODUCTS: StoreProduct[] = [
  {
    id: 'prod-hd-1', storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
    address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
    lat: 21.3069, lng: -157.8583, productName: '2x4 Lumber 8ft SPF', category: 'lumber', subcategory: 'dimensional',
    sku: '345678', upc: '041100012345', price: 3.98, unit: 'each', quantityAvailable: 300, inStock: true,
    imageUrl: '', productUrl: 'https://www.homedepot.com/p/2x4-8ft', lastUpdated: new Date().toISOString(),
  },
  {
    id: 'prod-hd-2', storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
    address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
    lat: 21.3069, lng: -157.8583, productName: '2x6 Lumber 8ft SPF', category: 'lumber', subcategory: 'dimensional',
    sku: '058449', upc: '041100056789', price: 7.98, unit: 'each', quantityAvailable: 240, inStock: true,
    imageUrl: '', productUrl: 'https://www.homedepot.com/p/2x6-8ft', lastUpdated: new Date().toISOString(),
  },
  {
    id: 'prod-hd-3', storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
    address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
    lat: 21.3069, lng: -157.8583, productName: '2x10 Dimensional Lumber 12ft', category: 'lumber', subcategory: 'dimensional',
    sku: '603682', upc: '041100098765', price: 29.88, unit: 'each', quantityAvailable: 88, inStock: true,
    imageUrl: '', productUrl: 'https://www.homedepot.com/p/2x10-12ft', lastUpdated: new Date().toISOString(),
  },
  {
    id: 'prod-hd-4', storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
    address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
    lat: 21.3069, lng: -157.8583, productName: '3/4 in. T&G Subfloor Plywood 4x8', category: 'sheathing', subcategory: 'subfloor',
    sku: '920924', upc: '041100011111', price: 52.5, unit: 'each', quantityAvailable: 68, inStock: true,
    imageUrl: '', productUrl: 'https://www.homedepot.com/p/3-4-subfloor', lastUpdated: new Date().toISOString(),
  },
  {
    id: 'prod-lowes-1', storeId: 'lowes-2001', storeName: "Lowe's - Waipahu", storeType: 'lowes',
    address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
    lat: 21.4152, lng: -157.9995, productName: '2x4 Lumber 8ft #2 KD-HT', category: 'lumber', subcategory: 'dimensional',
    sku: 'L-2x4-8', upc: '041200012345', price: 3.79, unit: 'each', quantityAvailable: 420, inStock: true,
    imageUrl: '', productUrl: 'https://www.lowes.com/pd/2x4-8ft', lastUpdated: new Date().toISOString(),
  },
  {
    id: 'prod-lowes-2', storeId: 'lowes-2001', storeName: "Lowe's - Waipahu", storeType: 'lowes',
    address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
    lat: 21.4152, lng: -157.9995, productName: '2x10 Dimensional Lumber 12ft', category: 'lumber', subcategory: 'dimensional',
    sku: 'L-2x10-12', upc: '041200098765', price: 27.49, unit: 'each', quantityAvailable: 55, inStock: true,
    imageUrl: '', productUrl: 'https://www.lowes.com/pd/2x10-12ft', lastUpdated: new Date().toISOString(),
  },
]

const NEARBY_STORES = [
  {
    storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
    address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
    lat: 21.3069, lng: -157.8583, distance: 0.5, phone: '(808) 555-0100',
    hours: 'Mon-Sat 6am-10pm, Sun 7am-8pm',
  },
  {
    storeId: 'lowes-2001', storeName: "Lowe's - Waipahu", storeType: 'lowes',
    address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
    lat: 21.4152, lng: -157.9995, distance: 8.4, phone: '(808) 555-0200',
    hours: 'Mon-Sat 6am-10pm, Sun 8am-8pm',
  },
]

import { NormalizedOffer } from '../../../shared/types/store'
import { HomeDepotAdapter } from '../adapters'

export class StoreService {
  searchProducts(params: StoreSearchParams): StoreProduct[] {
    const { query = '', category, maxPrice, minPrice, inStockOnly = false, sortBy = 'price', sortOrder = 'asc' } = params

    let results = MOCK_PRODUCTS

    if (query) {
      const lowerQuery = query.toLowerCase()
      results = results.filter(
        (p) =>
          p.productName.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery) ||
          p.sku.toLowerCase().includes(lowerQuery),
      )
    }

    if (category) results = results.filter((p) => p.category === category)
    if (inStockOnly) results = results.filter((p) => p.inStock)
    if (maxPrice !== undefined) results = results.filter((p) => p.price <= maxPrice)
    if (minPrice !== undefined) results = results.filter((p) => p.price >= minPrice)

    results = [...results].sort((a, b) => {
      let diff = 0
      if (sortBy === 'price') diff = a.price - b.price
      else if (sortBy === 'availability') diff = a.quantityAvailable - b.quantityAvailable
      return sortOrder === 'asc' ? diff : -diff
    })

    return results
  }

  getProductsByStore(storeId: string): StoreProduct[] {
    return MOCK_PRODUCTS.filter((p) => p.storeId === storeId)
  }

  async getOffersByStore(storeId: string, opts?: { query?: string; zipCode?: string }): Promise<NormalizedOffer[]> {
    const query = opts?.query
    const zipCode = opts?.zipCode

    // If a query is provided prefer adapter search (which may include inventory for a given store)
    try {
      if (storeId && storeId.startsWith('hd-') && (HomeDepotAdapter as any)) {
        if (query) {
          return await (HomeDepotAdapter as any).search(query, { storeId, zipCode })
        }
        if ((HomeDepotAdapter as any).getProductsByStore) {
          return await (HomeDepotAdapter as any).getProductsByStore(storeId)
        }
      }
    } catch (e) {
      // fall through to mock provider
    }

    // Fallback: normalize mock products
    const products = this.getProductsByStore(storeId)
    return products.map((p) => this.normalizeToOffer(p))
  }

  normalizeToOffer(product: StoreProduct): NormalizedOffer {
    const offerId = `${product.storeId}-${product.sku}-${product.id}`
    const packSize = product.unit === 'box' || product.unit === 'each' ? 1 : undefined
    return {
      offerId,
      storeId: product.storeId,
      storeName: product.storeName,
      storeType: product.storeType,
      sku: product.sku,
      title: product.productName,
      price: product.price,
      currency: 'USD',
      unit: product.unit as any,
      packSize,
      unitPrice: product.price,
      quantityAvailable: product.quantityAvailable,
      inStock: product.inStock,
      leadTimeDays: undefined,
      productUrl: product.productUrl,
      imageUrl: product.imageUrl,
      meta: { category: product.category, subcategory: product.subcategory },
      lastUpdated: product.lastUpdated,
    }
  }

  comparePrices(productNames: string[], params: Partial<StoreSearchParams>): PriceComparison[] {
    return productNames.flatMap((productName) => {
      const matches = this.searchProducts({ query: productName, zipCode: params.zipCode ?? '96813', ...params })
      if (matches.length === 0) return []

      const options: PriceOption[] = matches.map((product) => {
        const estimatedTax = product.price * 0.05
        return {
          storeId: product.storeId, storeName: product.storeName, storeType: product.storeType,
          distance: 5.0, price: product.price, totalPrice: product.price,
          inStock: product.inStock, quantityAvailable: product.quantityAvailable,
          productUrl: product.productUrl, estimatedTax, estimatedTotal: product.price + estimatedTax,
        }
      })

      const bestPrice = options.reduce((best, opt) => (opt.totalPrice < best.totalPrice ? opt : best))
      const avgTotal = options.reduce((sum, opt) => sum + opt.totalPrice, 0) / options.length
      const savings = parseFloat(Math.max(0, avgTotal - bestPrice.totalPrice).toFixed(2))

      return [{ productName, category: matches[0].category, quantity: 1, unit: matches[0].unit, options, bestPrice, savings }]
    })
  }

  createCart(items: CartItem[]): Record<string, { product: StoreProduct; quantity: number }[]> {
    const cartByStore: Record<string, { product: StoreProduct; quantity: number }[]> = {}
    for (const item of items) {
      // accept either productId or sku for client flexibility
      const product = MOCK_PRODUCTS.find((p) => p.id === item.productId || p.sku === (item as any).sku)
      if (!product) continue
      if (!cartByStore[product.storeId]) cartByStore[product.storeId] = []
      const qty = Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Math.floor(Number(item.quantity)) : 1
      cartByStore[product.storeId].push({ product, quantity: qty })
    }
    return cartByStore
  }

  getNearbyStores(_zipCode: string, _radius = 10) {
    return NEARBY_STORES
  }

  getSettings(_userId: string) {
    return { preferredStores: ['homeDepot', 'lowes'], priceVsDistancePriority: 0.5, taxRate: 0.05, defaultZip: '96813' }
  }

  updateSettings(_userId: string, settings: unknown) {
    return settings
  }
}

export default StoreService
