export type StoreType = 'homeDepot' | 'lowes' | 'ace' | 'menards' | 'local'

export type Unit = 'each' | 'sqft' | 'linearft' | 'ft' | 'lb' | 'gallon' | 'box' | 'sheet'

export interface MaterialSpec {
  thickness?: number
  length?: number
  width?: number
  height?: number
  grade?: string
  density?: number
  color?: string
  manufacturer?: string
  [key: string]: any
}

export interface Material {
  id: string
  name: string
  bimCategory: string
  baseUnit: Unit
  specs?: MaterialSpec
}

export interface NormalizedOffer {
  offerId: string
  storeId: string
  storeName: string
  storeType: StoreType
  sku: string
  title: string
  price: number
  currency?: string
  unit: Unit
  packSize?: number
  unitPrice?: number
  quantityAvailable: number
  inStock: boolean
  leadTimeDays?: number
  productUrl?: string
  imageUrl?: string
  meta?: Record<string, any>
  lastUpdated?: string
}

export interface MaterialToSkuMapping {
  materialId: string
  storeId: string
  sku: string
  confidence: number // 0..1
  mappedAt?: string
  notes?: string
}

export interface StoreAdapter {
  readonly storeId: string
  readonly storeType: StoreType
  search(query: string, params?: any): Promise<NormalizedOffer[]>
  getBySku(sku: string): Promise<NormalizedOffer | null>
  getProductsByStore?(storeId: string, params?: any): Promise<NormalizedOffer[]>
  mapMaterialToSku(material: Material): Promise<MaterialToSkuMapping | null>
}
