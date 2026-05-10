/**
 * Experimental Home Depot scraping helpers.
 * This file is purposely located under `experimental/` so reviewers can
 * find unofficial heuristics easily. Do NOT enable these on shared infra.
 */
export function extractNumericStoreId(storeId: string | undefined) {
  if (!storeId) return undefined
  const m = storeId.match(/(\d+)/)
  return m ? m[1] : undefined
}

export function collectProductEntries(obj: any, out: any[] = []) {
  if (!obj) return out
  if (Array.isArray(obj)) {
    for (const el of obj) collectProductEntries(el, out)
    return out
  }
  if (typeof obj === 'object') {
    // Heuristic: objects that contain a productId/sku/title
    if (obj.productId || obj.product_id || obj.sku || obj.title || obj.productIdStr || obj.itemId) {
      out.push(obj)
    }
    for (const k of Object.keys(obj)) collectProductEntries(obj[k], out)
  }
  return out
}
