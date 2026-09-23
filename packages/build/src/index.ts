import { WorldDocument, WorldEntity } from '../../world/src/index'

export type RequirementKind = 'part' | 'material' | 'consumable' | 'equipment' | 'unknown'
export type RequirementConfidence = 'conceptual' | 'estimated' | 'specified' | 'verified'

export interface BuildRequirement {
  id: string
  sourceEntityId: string
  parentEntityId?: string
  kind: RequirementKind
  name: string
  specification?: string
  quantity: number
  unit: string
  acquisition: 'unresolved' | 'buy' | 'fabricate' | 'reuse' | 'owned'
  confidence?: RequirementConfidence
  basis?: string
  assumptions?: string[]
  capabilityId?: string
}

export interface BuildRequirementProvider {
  id: string
  capabilityId: string
  derive: (world: WorldDocument) => BuildRequirement[]
}

export interface BuildGraph {
  worldId: string
  worldRevision: number
  generatedAt: string
  requirements: BuildRequirement[]
  totals: {
    requirementCount: number
    unresolvedCount: number
    conceptualCount: number
  }
}

function numberProperty(entity: WorldEntity, key: string, fallback: number): number {
  const value = entity.properties[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringProperty(entity: WorldEntity, key: string): string | undefined {
  const value = entity.properties[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function requirementKind(entity: WorldEntity): RequirementKind | null {
  if (entity.kind === 'part' || entity.kind.startsWith('part.')) return 'part'
  if (entity.kind === 'material' || entity.kind.startsWith('material.')) return 'material'
  if (entity.kind === 'consumable' || entity.kind.startsWith('consumable.')) return 'consumable'
  if (entity.properties.buildRequirement === true) return 'unknown'
  return null
}

function acquisition(entity: WorldEntity): BuildRequirement['acquisition'] {
  const value = stringProperty(entity, 'acquisition') ?? stringProperty(entity, 'sourcing')
  if (value === 'buy' || value === 'fabricate' || value === 'reuse' || value === 'owned') return value
  return 'unresolved'
}

function requirementConfidence(entity: WorldEntity): RequirementConfidence | undefined {
  const value = stringProperty(entity, 'requirementConfidence')
  if (value === 'conceptual' || value === 'estimated' || value === 'specified' || value === 'verified') {
    return value
  }
  return undefined
}

function explicitRequirements(world: WorldDocument): BuildRequirement[] {
  return world.entities.flatMap<BuildRequirement>((entity) => {
    const kind = requirementKind(entity)
    if (!kind) return []

    return [{
      id: `requirement:${entity.id}`,
      sourceEntityId: entity.id,
      parentEntityId: entity.parentId,
      kind,
      name: entity.name,
      specification: stringProperty(entity, 'specification'),
      quantity: Math.max(0, numberProperty(entity, 'quantity', 1)),
      unit: stringProperty(entity, 'unit') ?? 'each',
      acquisition: acquisition(entity),
      confidence: requirementConfidence(entity),
      basis: stringProperty(entity, 'requirementBasis'),
    }]
  })
}

function assertUniqueRequirementIds(requirements: BuildRequirement[]) {
  const ids = new Set<string>()
  for (const requirement of requirements) {
    if (ids.has(requirement.id)) {
      throw new Error(`Duplicate Build requirement id: ${requirement.id}`)
    }
    ids.add(requirement.id)
  }
}

export function deriveBuildGraph(
  world: WorldDocument,
  generatedAt = new Date().toISOString(),
  providers: BuildRequirementProvider[] = [],
): BuildGraph {
  const requirements = [
    ...explicitRequirements(world),
    ...providers.flatMap((provider) => provider.derive(world).map((requirement) => ({
      ...requirement,
      capabilityId: requirement.capabilityId ?? provider.capabilityId,
    }))),
  ]

  assertUniqueRequirementIds(requirements)

  return {
    worldId: world.id,
    worldRevision: world.revision,
    generatedAt,
    requirements,
    totals: {
      requirementCount: requirements.length,
      unresolvedCount: requirements.filter((requirement) => requirement.acquisition === 'unresolved').length,
      conceptualCount: requirements.filter((requirement) => requirement.confidence === 'conceptual').length,
    },
  }
}
