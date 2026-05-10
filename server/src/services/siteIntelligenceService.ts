import type {
  ClimateZoneResult,
  ElevationResult,
  HazardProviderStatus,
  SiteIntelligenceRequest,
  SiteIntelligenceResponse,
  SiteIntelligenceSource,
  WeatherResult,
} from '../../../shared/types/siteIntelligence'

const retrievedAt = () => new Date().toISOString()

const sourceUrls = {
  usgsEpqs: 'https://epqs.nationalmap.gov/v1/json',
  weatherGov: 'https://api.weather.gov',
  doeClimate: 'https://basc.pnnl.gov/guide-determining-climate-zone-county-data-files',
  asceHazard: 'https://www.asce.org/publications-and-news/asce-hazard-tool/api',
  iccDevelopers: 'https://www.iccsafe.org/developers/',
}

const stateClimateDefaults: Record<string, Pick<ClimateZoneResult, 'ieccZone' | 'buildingAmericaRegion' | 'note'>> = {
  HI: {
    ieccZone: '1A',
    buildingAmericaRegion: 'Hot-Humid',
    note: 'Hawaii is treated as hot-humid / IECC 1A for early envelope planning. Confirm local amendments before permit use.',
  },
  AK: {
    ieccZone: '7/8',
    buildingAmericaRegion: 'Cold / Very Cold',
    note: 'Alaska varies by locality; use this only as a broad early planning flag.',
  },
  FL: {
    ieccZone: '1A/2A',
    buildingAmericaRegion: 'Hot-Humid',
    note: 'Florida varies by county between hot-humid climate zones. County lookup should refine this.',
  },
  CA: {
    ieccZone: '2B-5C',
    buildingAmericaRegion: 'Hot-Dry / Mixed-Dry / Marine',
    note: 'California varies sharply by coast, valley, and mountain location. County or local energy-code lookup is required.',
  },
}

export async function getSiteIntelligence(input: SiteIntelligenceRequest): Promise<SiteIntelligenceResponse> {
  const request = normalizeRequest(input)
  const generatedAt = retrievedAt()
  const sources: SiteIntelligenceSource[] = []

  const elevation = await getElevation(request, sources)
  const weather = await getWeather(request, sources)
  const climateZone = getClimateZone(request, sources)
  const providers = getProviderStatuses(sources)
  const advisories = buildAdvisories(elevation, weather, climateZone, providers)

  return { request, generatedAt, elevation, weather, climateZone, providers, advisories, sources }
}

function normalizeRequest(input: SiteIntelligenceRequest): SiteIntelligenceRequest {
  return {
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    state: input.state?.trim().toUpperCase() || undefined,
    county: input.county?.trim() || undefined,
    zipCode: input.zipCode?.trim() || undefined,
  }
}

async function getElevation(request: SiteIntelligenceRequest, sources: SiteIntelligenceSource[]): Promise<ElevationResult> {
  const source = addSource(sources, {
    id: 'usgs-epqs',
    name: 'USGS Elevation Point Query Service',
    url: sourceUrls.usgsEpqs,
    status: 'available',
    note: 'Interpolated 3DEP elevation. Use for planning, not surveyed foundation certification.',
  })

  try {
    const url = `${sourceUrls.usgsEpqs}?x=${request.longitude}&y=${request.latitude}&units=Feet&output=json`
    const data = await fetchJson(url)
    const raw = Number(data?.value ?? data?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation)
    return {
      elevation: Number.isFinite(raw) && raw > -100000 ? raw : null,
      unit: 'ft',
      confidence: 'planning',
      sourceId: source.id,
      note: 'Elevation is suitable for early terrain/post-height modeling. Require survey data before final foundation design.',
    }
  } catch (error) {
    source.status = 'error'
    source.note = error instanceof Error ? error.message : 'USGS elevation lookup failed.'
    return {
      elevation: null,
      unit: 'ft',
      confidence: 'surveyRequired',
      sourceId: source.id,
      note: 'Elevation lookup failed. Enter survey elevations or retry with a valid US land coordinate.',
    }
  }
}

async function getWeather(request: SiteIntelligenceRequest, sources: SiteIntelligenceSource[]): Promise<WeatherResult> {
  const source = addSource(sources, {
    id: 'weather-gov',
    name: 'National Weather Service API',
    url: sourceUrls.weatherGov,
    status: 'available',
    note: 'Open weather.gov grid metadata for jobsite planning and forecast context.',
  })

  try {
    const url = `${sourceUrls.weatherGov}/points/${request.latitude.toFixed(4)},${request.longitude.toFixed(4)}`
    const data = await fetchJson(url)
    const props = data?.properties ?? {}
    return {
      gridId: props.gridId,
      gridX: props.gridX,
      gridY: props.gridY,
      forecastOffice: props.cwa,
      forecastUrl: props.forecast,
      sourceId: source.id,
      note: 'Weather metadata can support construction scheduling and jobsite risk, but design wind/snow should come from ASCE hazard data.',
    }
  } catch (error) {
    source.status = 'error'
    source.note = error instanceof Error ? error.message : 'weather.gov lookup failed.'
    return {
      sourceId: source.id,
      note: 'Weather lookup failed. This does not block BIM modeling, but schedule/weather guidance is unavailable.',
    }
  }
}

function getClimateZone(request: SiteIntelligenceRequest, sources: SiteIntelligenceSource[]): ClimateZoneResult {
  const source = addSource(sources, {
    id: 'doe-pnnl-climate-zone',
    name: 'DOE/PNNL IECC climate zone data',
    url: sourceUrls.doeClimate,
    status: 'available',
    note: 'County datasets should be used for final zone lookup; state defaults are early planning fallbacks.',
  })
  const fallback = request.state ? stateClimateDefaults[request.state] : undefined
  if (fallback) {
    return {
      ieccZone: fallback.ieccZone,
      buildingAmericaRegion: fallback.buildingAmericaRegion,
      basis: request.county ? 'county' : 'state',
      sourceId: source.id,
      note: fallback.note,
    }
  }
  return {
    basis: 'manualRequired',
    sourceId: source.id,
    note: 'Climate zone needs county/ZIP lookup data before envelope requirements can be suggested.',
  }
}

function getProviderStatuses(sources: SiteIntelligenceSource[]): HazardProviderStatus[] {
  const asce = addSource(sources, {
    id: 'asce-hazard-tool',
    name: 'ASCE Hazard Tool API',
    url: sourceUrls.asceHazard,
    status: process.env.ASCE_HAZARD_API_KEY ? 'available' : 'needsApiKey',
    note: process.env.ASCE_HAZARD_API_KEY ? 'API key configured; provider adapter can be enabled next.' : 'Requires ASCE Hazard Tool API credentials.',
  })
  const iccContent = addSource(sources, {
    id: 'icc-code-connect',
    name: 'ICC Code Connect API',
    url: sourceUrls.iccDevelopers,
    status: process.env.ICC_CODE_CONNECT_API_KEY ? 'available' : 'needsApiKey',
    note: process.env.ICC_CODE_CONNECT_API_KEY ? 'API key configured; code content adapter can be enabled next.' : 'Requires ICC Code Connect access.',
  })
  const iccAdoption = addSource(sources, {
    id: 'icc-code-adoption',
    name: 'ICC Code Adoption API',
    url: sourceUrls.iccDevelopers,
    status: process.env.ICC_CODE_ADOPTION_API_KEY ? 'available' : 'needsApiKey',
    note: process.env.ICC_CODE_ADOPTION_API_KEY ? 'API key configured; adoption lookup adapter can be enabled next.' : 'Requires ICC Code Adoption API access.',
  })
  return [
    { provider: 'asceHazardTool', status: asce.status, sourceId: asce.id, note: asce.note ?? '' },
    { provider: 'iccCodeConnect', status: iccContent.status, sourceId: iccContent.id, note: iccContent.note ?? '' },
    { provider: 'iccCodeAdoption', status: iccAdoption.status, sourceId: iccAdoption.id, note: iccAdoption.note ?? '' },
  ]
}

function buildAdvisories(elevation: ElevationResult, weather: WeatherResult, climate: ClimateZoneResult, providers: HazardProviderStatus[]): string[] {
  const advisories = [
    elevation.elevation === null
      ? 'Terrain should be entered from survey data before foundation/post heights are trusted.'
      : 'Use imported elevation as a planning terrain seed only; final foundation layout needs survey verification.',
    weather.gridId
      ? 'weather.gov grid metadata is available for schedule and jobsite guidance.'
      : 'Weather guidance is unavailable for this point until weather.gov resolves the location.',
    climate.ieccZone
      ? `Envelope rules can start from IECC climate zone ${climate.ieccZone}, then be refined by jurisdiction.`
      : 'Envelope rules need a county/ZIP climate-zone lookup before insulation suggestions are reliable.',
  ]
  if (providers.some((provider) => provider.provider === 'asceHazardTool' && provider.status === 'needsApiKey')) {
    advisories.push('Configure ASCE Hazard Tool credentials before using location-specific wind, snow, seismic, or flood criteria.')
  }
  return advisories
}

function addSource(sources: SiteIntelligenceSource[], source: Omit<SiteIntelligenceSource, 'retrievedAt'>): SiteIntelligenceSource {
  const next = { ...source, retrievedAt: retrievedAt() }
  sources.push(next)
  return next
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent': 'ContractorHub/0.1 site-intelligence',
      },
    })
    if (!response.ok) throw new Error(`Request failed ${response.status} for ${url}`)
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}
