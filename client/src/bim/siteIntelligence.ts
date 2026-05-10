import type { SiteIntelligenceRequest, SiteIntelligenceResponse } from '../../../shared/types/siteIntelligence'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

export type { SiteIntelligenceRequest, SiteIntelligenceResponse }

export async function fetchSiteIntelligence(request: SiteIntelligenceRequest): Promise<SiteIntelligenceResponse> {
  const response = await fetch(`${apiBase}/api/site-intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Site intelligence request failed with ${response.status}`)
  }
  const payload = await response.json() as { siteIntelligence: SiteIntelligenceResponse }
  return payload.siteIntelligence
}
