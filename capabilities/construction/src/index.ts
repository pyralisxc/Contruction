import type { BuildRequirement, BuildRequirementProvider } from '../../packages/build/src/index'
import type { CapabilityDefinition } from '../../packages/capabilities/src/index'
import {
  ActorRef,
  Vec3,
  WorldDocument,
  WorldEntity,
  WorldTransaction,
  createBoxEntity,
  createId,
  createTransaction,
} from '../../packages/world/src/index'

export interface ConceptShedInput {
  name?: string
  width: number
  depth: number
  wallHeight: number
  origin?: Vec3
}

function requirePositive(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`)
  }
}

function boxArea(entity: WorldEntity): number {
  if (!entity.geometry || entity.geometry.type !== 'box') return 0
  return entity.geometry.size.x * entity.geometry.size.y
}

function wallLength(entity: WorldEntity): number {
  if (!entity.geometry || entity.geometry.type !== 'box') return 0
  return Math.max(entity.geometry.size.x, entity.geometry.size.y)
}

function wallHeight(entity: WorldEntity): number {
  if (!entity.geometry || entity.geometry.type !== 'box') return 0
  return entity.geometry.size.z
}

function numberProperty(entity: WorldEntity, key: string, fallback: number): number {
  const value = entity.properties[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const constructionRequirements: BuildRequirementProvider = {
  id: 'construction-shell-requirements-v0',
  capabilityId: 'construction',
  derive(world: WorldDocument): BuildRequirement[] {
    return world.entities.flatMap<BuildRequirement>((entity) => {
      if (entity.kind === 'construction.floor') {
        const area = boxArea(entity)
        if (area <= 0) return []
        return [{
          id: `construction:${entity.id}:subfloor`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'material',
          name: 'Subfloor sheathing',
          specification: '3/4 in structural subfloor, conceptual default',
          quantity: area,
          unit: 'sqft',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Gross floor plan area from concept geometry.',
          assumptions: ['Openings, edge waste, sheet layout, framing support, and local requirements are not yet resolved.'],
        }]
      }

      if (entity.kind === 'construction.wall') {
        const length = wallLength(entity)
        const height = wallHeight(entity)
        if (length <= 0 || height <= 0) return []

        const spacingInches = Math.max(1, numberProperty(entity, 'framingSpacingInches', 16))
        const spacingFeet = spacingInches / 12
        const studs = Math.ceil(length / spacingFeet) + 1
        const area = length * height

        return [
          {
            id: `construction:${entity.id}:studs`,
            sourceEntityId: entity.id,
            parentEntityId: entity.parentId,
            kind: 'part',
            name: 'Wall studs',
            specification: '2x4 framing stud, length/species/grade unresolved',
            quantity: studs,
            unit: 'each',
            acquisition: 'unresolved',
            confidence: 'conceptual',
            basis: `Concept wall length at ${spacingInches} in nominal spacing.`,
            assumptions: ['Corners, openings, plates, blocking, backing, loads, species, grade, and code requirements are not included.'],
          },
          {
            id: `construction:${entity.id}:sheathing`,
            sourceEntityId: entity.id,
            parentEntityId: entity.parentId,
            kind: 'material',
            name: 'Wall sheathing',
            specification: '7/16 in OSB wall sheathing, conceptual default',
            quantity: area,
            unit: 'sqft',
            acquisition: 'unresolved',
            confidence: 'conceptual',
            basis: 'Gross wall face area from concept geometry.',
            assumptions: ['Openings, panel layout, waste, bracing, weather barrier, and local requirements are not deducted or added.'],
          },
        ]
      }

      if (entity.kind === 'construction.roof') {
        const area = boxArea(entity)
        if (area <= 0) return []
        return [{
          id: `construction:${entity.id}:roof-sheathing`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'material',
          name: 'Roof sheathing',
          specification: '7/16 in roof sheathing, conceptual default',
          quantity: area,
          unit: 'sqft',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Plan-projected roof area from concept geometry.',
          assumptions: ['Pitch, overhang, waste, panel layout, structural framing, underlayment, and roofing are not yet resolved.'],
        }]
      }

      return []
    })
  },
}

export function createConceptShedTransaction(
  baseRevision: number,
  input: ConceptShedInput,
  actor: ActorRef,
): WorldTransaction {
  requirePositive('width', input.width)
  requirePositive('depth', input.depth)
  requirePositive('wallHeight', input.wallHeight)

  const origin = input.origin ?? { x: 0, y: 0, z: 0 }
  const at = new Date().toISOString()
  const structureId = createId('shed')
  const name = input.name?.trim() || 'Concept shed'
  const wallThickness = 0.5

  const entities = [
    createBoxEntity({
      id: structureId,
      kind: 'structure.shed',
      name,
      position: origin,
      size: { x: input.width, y: input.depth, z: input.wallHeight },
      properties: {
        capability: 'construction',
        fidelity: 'concept',
      },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('floor'),
      kind: 'construction.floor',
      name: `${name} floor`,
      parentId: structureId,
      position: origin,
      size: { x: input.width, y: input.depth, z: 0.75 / 12 },
      properties: {
        capability: 'construction',
        fidelity: 'concept',
      },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('wall'),
      kind: 'construction.wall',
      name: `${name} north wall`,
      parentId: structureId,
      position: origin,
      size: { x: input.width, y: wallThickness, z: input.wallHeight },
      properties: { capability: 'construction', fidelity: 'concept', framingSpacingInches: 16 },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('wall'),
      kind: 'construction.wall',
      name: `${name} south wall`,
      parentId: structureId,
      position: { x: origin.x, y: origin.y + input.depth - wallThickness, z: origin.z },
      size: { x: input.width, y: wallThickness, z: input.wallHeight },
      properties: { capability: 'construction', fidelity: 'concept', framingSpacingInches: 16 },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('wall'),
      kind: 'construction.wall',
      name: `${name} west wall`,
      parentId: structureId,
      position: origin,
      size: { x: wallThickness, y: input.depth, z: input.wallHeight },
      properties: { capability: 'construction', fidelity: 'concept', framingSpacingInches: 16 },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('wall'),
      kind: 'construction.wall',
      name: `${name} east wall`,
      parentId: structureId,
      position: { x: origin.x + input.width - wallThickness, y: origin.y, z: origin.z },
      size: { x: wallThickness, y: input.depth, z: input.wallHeight },
      properties: { capability: 'construction', fidelity: 'concept', framingSpacingInches: 16 },
      actor,
      at,
    }),
    createBoxEntity({
      id: createId('roof'),
      kind: 'construction.roof',
      name: `${name} conceptual roof`,
      parentId: structureId,
      position: { x: origin.x, y: origin.y, z: origin.z + input.wallHeight },
      size: { x: input.width, y: input.depth, z: 0.5 },
      properties: {
        capability: 'construction',
        fidelity: 'concept',
        roofForm: 'unresolved',
      },
      actor,
      at,
    }),
  ]

  return createTransaction({
    baseRevision,
    actor,
    at,
    mutations: entities.map((entity) => ({ kind: 'createEntity' as const, entity })),
    note: `Create conceptual construction shell: ${name}`,
  })
}

export const constructionCapability: CapabilityDefinition = {
  id: 'construction',
  version: '0.1.0',
  name: 'Construction',
  description: 'Concept-to-detailed building and assembly intelligence. Current slice proves semantic shell creation and conceptual material derivation.',
  entityKinds: [
    'structure.shed',
    'construction.floor',
    'construction.wall',
    'construction.roof',
  ],
  buildRequirementProviders: [constructionRequirements],
}
