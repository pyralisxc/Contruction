import { Request, Response, NextFunction } from 'express'

export default function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY
  if (!expected) {
    res.status(403).json({ error: 'Admin API key not configured on server' })
    return
  }
  const provided = (req.header('x-admin-api-key') || req.query.api_key || '') as string
  if (provided !== expected) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
