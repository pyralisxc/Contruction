import { StoreProduct, StoreSearchParams, PriceComparison } from './storeService'

export class PriceComparisonService {
  private mockStores: Record<string, StoreProduct[]> = {
    'hd-1001': [
      {
        id: 'prod-hd-1', storeId: 'hd-1001', storeName: 'Home Depot - Downtown', storeType: 'homeDepot',
        address: { street: '123 Main St', city: 'Honolulu', state: 'HI', zip: '96813', country: 'USA' },
        lat: 21.3069, lng: -157.8583, productName: '2x4 Lumber 8ft SPF', category: 'lumber', subcategory: 'dimensional',
        sku: '345678', upc: '041100012345', price: 3.98, unit: 'each', quantityAvailable: 300, inStock: true,
        imageUrl: '', productUrl: 'https://www.homedepot.com/p/2x4-8ft', lastUpdated: new Date().toISOString(),
      },
    ],
    'lowes-2001': [
      {
        id: 'prod-lowes-1', storeId: 'lowes-2001', storeName: "Lowe's - Waipahu", storeType: 'lowes',
        address: { street: '456 Lau St', city: 'Waipahu', state: 'HI', zip: '96797', country: 'USA' },
        lat: 21.4152, lng: -157.9995, productName: '2x4 Lumber 8ft #2 KD-HT', category: 'lumber', subcategory: 'dimensional',
        sku: 'L-2x4-8', upc: '041200012345', price: 3.79, unit: 'each', quantityAvailable: 420, inStock: true,
        imageUrl: '', productUrl: 'https://www.lowes.com/pd/2x4-8ft', lastUpdated: new Date().toISOString(),
      },
    ],
  }

  comparePrices(productNames: string[], params: Partial<StoreSearchParams>): PriceComparison[] {
    const allProducts = Object.values(this.mockStores).flat()

    return productNames.flatMap((productName) => {
      const lowerName = productName.toLowerCase()
      const matches = allProducts.filter((p) => p.productName.toLowerCase().includes(lowerName))
      if (matches.length === 0) return []

      const options = matches.map((p) => {
        const estimatedTax = p.price * 0.05
        return {
          storeId: p.storeId, storeName: p.storeName, storeType: p.storeType,
          distance: 5.0, price: p.price, totalPrice: p.price,
          inStock: p.inStock, quantityAvailable: p.quantityAvailable,
          productUrl: p.productUrl, estimatedTax, estimatedTotal: p.price + estimatedTax,
        }
      })

      const bestPrice = options.reduce((best, opt) => (opt.totalPrice < best.totalPrice ? opt : best))
      const avgTotal = options.reduce((sum, opt) => sum + opt.totalPrice, 0) / options.length
      const savings = parseFloat(Math.max(0, avgTotal - bestPrice.totalPrice).toFixed(2))

      return [{ productName, category: matches[0].category, quantity: 1, unit: matches[0].unit, options, bestPrice, savings }]
    })
  }
}

export default PriceComparisonService
