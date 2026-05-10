import { Request, Response } from 'express'
import { getRobots, isAllowedUrl } from '../utils/robotsChecker'

export async function getRobotsHandler(req: Request, res: Response) {
  try {
    const host = typeof req.query.host === 'string' && req.query.host.length > 0 ? req.query.host : undefined
    const rules = await getRobots(host)
    res.json({ rules })
  } catch (e) {
    res.status(500).json({ error: 'failed to fetch robots' })
  }
}

export async function checkUrlHandler(req: Request, res: Response) {
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  if (!url) {
    res.status(400).json({ error: 'url query parameter required' })
    return
  }
  try {
    const allowed = await isAllowedUrl(url)
    res.json({ url, allowed })
  } catch (e) {
    res.status(500).json({ error: 'failed to check url' })
  }
}

export default { getRobotsHandler, checkUrlHandler }
