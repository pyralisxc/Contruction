export type SiteIntelligenceStatus = 'available' | 'unavailable' | 'needsApiKey' | 'error'

export interface SiteIntelligenceSource {
  id: string
  name: string
  url: string
  retrievedAt: string
  status: SiteIntelligenceStatus
  note?: string
}

export interface SiteIntelligenceRequest {
  latitude: number
  longitude: number
  state?: string
  county?: string
  zipCode?: string
}

export interface ElevationResult {
  elevation: number | null
  unit: 'ft' | 'm'
  confidence: 'planning' | 'surveyRequired'
  sourceId: string
  note: string
}

export interface WeatherResult {
  gridId?: string
  gridX?: number
  gridY?: number
  forecastOffice?: string
  forecastUrl?: string
  sourceId: string
  note: string
}

export interface ClimateZoneResult {
  ieccZone?: string
  buildingAmericaRegion?: string
  basis: 'state' | 'county' | 'zip' | 'manualRequired'
  sourceId: string
  note: string
}

export interface HazardProviderStatus {
  provider: 'asceHazardTool' | 'iccCodeConnect' | 'iccCodeAdoption'
  status: SiteIntelligenceStatus
  sourceId: string
  note: string
}

export interface SiteIntelligenceResponse {
  request: SiteIntelligenceRequest
  generatedAt: string
  elevation: ElevationResult
  weather: WeatherResult
  climateZone: ClimateZoneResult
  providers: HazardProviderStatus[]
  advisories: string[]
  sources: SiteIntelligenceSource[]
}
