import { SupplierProduct, TakeoffLine } from './types'

const homeDepotCatalog: SupplierProduct[] = [
  { supplier: 'homeDepot', sku: '058449', title: '2 in. x 6 in. x 8 ft. SPF Dimensional Lumber', materialId: 'stud-2x6', unitPrice: 7.98, unit: 'linearFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 240, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '603682', title: '2 in. x 10 in. x 12 ft. Dimensional Lumber', materialId: 'joist-2x10', unitPrice: 29.88, unit: 'linearFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 88, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '122089', title: '7/16 in. OSB Sheathing 4 ft. x 8 ft.', materialId: 'osb-7-16', unitPrice: 18.75, unit: 'sqFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 120, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '920924', title: '3/4 in. Tongue and Groove Subfloor 4 ft. x 8 ft.', materialId: 'subfloor-3-4', unitPrice: 52.5, unit: 'sqFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 68, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '100043', title: 'Concrete Deck Block', materialId: 'concrete-pier-block', unitPrice: 14.48, unit: 'each', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 76, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '288282', title: '12/2 Solid Romex SIMpull CU NM-B W/G Wire', materialId: 'romex-12-2', unitPrice: 0.82, unit: 'linearFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 500, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
  { supplier: 'homeDepot', sku: '100382', title: '1/2 in. PEX Pipe Coil', materialId: 'pex-1-2', unitPrice: 0.48, unit: 'linearFt', storeName: 'Home Depot preferred store', zipCode: '96813', availableQty: 400, productUrl: 'https://www.homedepot.com/', lastUpdated: new Date().toISOString() },
]

export function searchHomeDepotProducts(query: string, zipCode: string): SupplierProduct[] {
  const normalized = query.toLowerCase()
  return homeDepotCatalog
    .filter((product) => product.title.toLowerCase().includes(normalized) || product.materialId.toLowerCase().includes(normalized))
    .map((product) => ({ ...product, zipCode, lastUpdated: new Date().toISOString() }))
}

export function mapTakeoffToHomeDepot(lines: TakeoffLine[], zipCode: string): SupplierProduct[] {
  const materialIds = new Set(lines.map((line) => line.materialId))
  return homeDepotCatalog
    .filter((product) => materialIds.has(product.materialId))
    .map((product) => ({ ...product, zipCode, lastUpdated: new Date().toISOString() }))
}

