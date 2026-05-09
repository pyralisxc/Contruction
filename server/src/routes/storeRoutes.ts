import { Router } from 'express'
import {
  searchProducts,
  getProductsByStore,
  comparePrices,
  createCart,
  getNearbyStores,
  getSettings,
  updateSettings,
} from '../controllers/storeController'

const router = Router()

router.get('/search', searchProducts)
router.get('/stores/:storeId/products', getProductsByStore)
router.get('/compare', comparePrices)
router.post('/cart', createCart)
router.get('/nearby', getNearbyStores)
router.get('/settings', getSettings)
router.put('/settings', updateSettings)

export default router
