import { Router } from 'express'
import {
  searchProducts,
  getProductsByStore,
  getOffersByStore,
  mapMaterialToSku,
  comparePrices,
  createCart,
  createShareableCart,
  getShareableCart,
  revokeShareableCart,
  getShortShareable,
  getNearbyStores,
  getSettings,
  updateSettings,
} from '../controllers/storeController'
import adminAuth from '../middleware/adminAuth'

const router = Router()

router.get('/search', searchProducts)
router.get('/stores/:storeId/products', getProductsByStore)
router.get('/stores/:storeId/offers', getOffersByStore)
router.post('/stores/:storeId/map', mapMaterialToSku)
router.get('/compare', comparePrices)
router.post('/cart', createCart)
router.post('/cart/share', createShareableCart)
router.get('/cart/share/:id', getShareableCart)
router.delete('/cart/share/:id', adminAuth, revokeShareableCart)
router.get('/s/:id', getShortShareable)
router.get('/nearby', getNearbyStores)
router.get('/settings', getSettings)
router.put('/settings', updateSettings)

export default router
