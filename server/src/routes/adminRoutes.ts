import { Router } from 'express'
import adminAuth from '../middleware/adminAuth'
import { getRobotsHandler, checkUrlHandler } from '../controllers/adminController'

const router = Router()

// protected admin endpoints
router.use(adminAuth)

// GET /api/admin/robots?host=https://www.homedepot.com
router.get('/robots', getRobotsHandler)

// GET /api/admin/robots/check?url=https://www.homedepot.com/product/123
router.get('/robots/check', checkUrlHandler)

export default router
