import type { BuildGraph, BuildRequirement } from '../../build/src/index'

export type SupplySourceKind =
  | 'inventory'
  | 'reuse'
  | 'local-retail'
  | 'local-trade'
  | 'local-fabricator'
  | 'regional'
  | 'online'
  | 'self-fabrication'

export interface SupplyObservation {
  id: string
  sourceId: string
  sourceName: string
  sourceKind: SupplySourceKind
  observedAt: string
  requirementId?: string
  specification?: string
  name?: string
  quantityAvailable: number
  unit: string
  unitPrice?: number
  distanceMiles?: number
  leadTimeDays?: number
  fabricationMethod?: string
  notes?: string
}

export interface SupplyCandidate {
  observationId: string
  requirementId: string
  sourceId: string
  sourceName: string
  sourceKind: SupplySourceKind
  quantityAvailable: number
  unit: string
  unitPrice?: number
  distanceMiles?: number
  leadTimeDays?: number
  fabricationMethod?: string
  observedAt: string
  matchBasis: 'requirement-id' | 'exact-specification' | 'exact-name'
  rank: number
}

export interface SupplyResolution {
  requirement: BuildRequirement
  status: 'unresolved' | 'partial' | 'covered'
  candidates: SupplyCandidate[]
  preferredCandidate?: SupplyCandidate
}

export interface SupplyGraph {
  worldId: string
  worldRevision: number
  generatedAt: string
  resolutions: SupplyResolution[]
  totals: {
    requirementCount: number
    coveredCount: number
    partialCount: number
    unresolvedCount: number
    localCandidateCount: number
    ownedCandidateCount: number
  }
}

const sourcePriority: Record<SupplySourceKind, number> = {
  inventory: 0,
  reuse: 10,
  'self-fabrication': 20,
  'local-fabricator': 25,
  'local-trade': 30,
  'local-retail': 35,
  regional: 60,
  online: 80,
}

function normalize(value?: string): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function matchBasis(
  requirement: BuildRequirement,
  observation: SupplyObservation,
): SupplyCandidate['matchBasis'] | null {
  if (observation.requirementId === requirement.id) return 'requirement-id'

  const requirementSpec = normalize(requirement.specification)
  const observationSpec = normalize(observation.specification)
  if (requirementSpec && observationSpec && requirementSpec === observationSpec) {
    return 'exact-specification'
  }

  const requirementName = normalize(requirement.name)
  const observationName = normalize(observation.name)
  if (requirementName && observationName && requirementName === observationName) {
    return 'exact-name'
  }

  return null
}

function candidateRank(
  observation: SupplyObservation,
  basis: SupplyCandidate['matchBasis'],
): number {
  const basisPenalty = basis === 'requirement-id' ? 0 : basis === 'exact-specification' ? 2 : 5
  const distancePenalty =
    typeof observation.distanceMiles === 'number'
      ? Math.min(25, Math.max(0, observation.distanceMiles) / 10)
      : 0
  const leadPenalty =
    typeof observation.leadTimeDays === 'number'
      ? Math.min(20, Math.max(0, observation.leadTimeDays))
      : 0

  return sourcePriority[observation.sourceKind] + basisPenalty + distancePenalty + leadPenalty
}

function allowedByAcquisition(
  requirement: BuildRequirement,
  observation: SupplyObservation,
): boolean {
  if (requirement.acquisition === 'unresolved') return true
  if (requirement.acquisition === 'owned') return observation.sourceKind === 'inventory'
  if (requirement.acquisition === 'reuse') return observation.sourceKind === 'reuse'
  if (requirement.acquisition === 'fabricate') {
    return observation.sourceKind === 'self-fabrication' || observation.sourceKind === 'local-fabricator'
  }
  if (requirement.acquisition === 'buy') {
    return !['inventory', 'reuse', 'self-fabrication'].includes(observation.sourceKind)
  }
  return true
}

function candidateFor(
  requirement: BuildRequirement,
  observation: SupplyObservation,
): SupplyCandidate | null {
  if (!allowedByAcquisition(requirement, observation)) return null
  if (observation.quantityAvailable <= 0) return null
  if (normalize(observation.unit) !== normalize(requirement.unit)) return null

  const basis = matchBasis(requirement, observation)
  if (!basis) return null

  return {
    observationId: observation.id,
    requirementId: requirement.id,
    sourceId: observation.sourceId,
    sourceName: observation.sourceName,
    sourceKind: observation.sourceKind,
    quantityAvailable: observation.quantityAvailable,
    unit: observation.unit,
    unitPrice: observation.unitPrice,
    distanceMiles: observation.distanceMiles,
    leadTimeDays: observation.leadTimeDays,
    fabricationMethod: observation.fabricationMethod,
    observedAt: observation.observedAt,
    matchBasis: basis,
    rank: candidateRank(observation, basis),
  }
}

function isLocal(kind: SupplySourceKind): boolean {
  return kind === 'local-retail' || kind === 'local-trade' || kind === 'local-fabricator'
}

export function deriveSupplyGraph(
  buildGraph: BuildGraph,
  observations: SupplyObservation[],
  generatedAt = new Date().toISOString(),
): SupplyGraph {
  const resolutions = buildGraph.requirements.map<SupplyResolution>((requirement) => {
    const candidates = observations
      .map((observation) => candidateFor(requirement, observation))
      .filter((candidate): candidate is SupplyCandidate => Boolean(candidate))
      .sort((a, b) => a.rank - b.rank || (a.unitPrice ?? Number.MAX_SAFE_INTEGER) - (b.unitPrice ?? Number.MAX_SAFE_INTEGER))

    const preferredCandidate = candidates[0]
    const available = preferredCandidate?.quantityAvailable ?? 0
    const status =
      !preferredCandidate
        ? 'unresolved'
        : available >= requirement.quantity
          ? 'covered'
          : 'partial'

    return {
      requirement,
      status,
      candidates,
      preferredCandidate,
    }
  })

  const allCandidates = resolutions.flatMap((resolution) => resolution.candidates)

  return {
    worldId: buildGraph.worldId,
    worldRevision: buildGraph.worldRevision,
    generatedAt,
    resolutions,
    totals: {
      requirementCount: resolutions.length,
      coveredCount: resolutions.filter((resolution) => resolution.status === 'covered').length,
      partialCount: resolutions.filter((resolution) => resolution.status === 'partial').length,
      unresolvedCount: resolutions.filter((resolution) => resolution.status === 'unresolved').length,
      localCandidateCount: allCandidates.filter((candidate) => isLocal(candidate.sourceKind)).length,
      ownedCandidateCount: allCandidates.filter((candidate) => candidate.sourceKind === 'inventory').length,
    },
  }
}
