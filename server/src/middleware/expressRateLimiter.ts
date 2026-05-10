import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

const storeApiLimiter = rateLimit({
  windowMs: Number(process.env.STORE_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: Number(process.env.STORE_RATE_LIMIT_MAX) || 60, // max requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'rate_limited', message: 'Too many requests, please slow down' })
  },
})

export default storeApiLimiter
