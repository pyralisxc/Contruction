import type { BuildRequirement, BuildRequirementProvider } from '../../../packages/build/src/index'
import type { CapabilityDefinition } from '../../../packages/capabilities/src/index'
import {
  ActorRef,
  Vec3,
  WorldDocument,
  WorldEntity,
  WorldTransaction,
  createBoxEntity,
  createId,
  createTransaction,
} from '../../../packages/world/src/index'

export interface RainwaterSystemInput {
  name?: string
  capacityGallons: number
  pipeRunFeet: number
  targetFlowGpm?: number
  origin?: Vec3
}

function requirePositive(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`)
  }
}

function numberProperty(entity: WorldEntity, key: string, fallback: number): number {
  const value = entity.properties[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const waterRequirements: BuildRequirementProvider = {
  id: 'water-rainwater-requirements-v0',
  capabilityId: 'water',
  derive(world: WorldDocument): BuildRequirement[] {
    return world.entities.flatMap<BuildRequirement>((entity) => {
      if (entity.kind === 'water.storage.tank') {
        const capacity = numberProperty(entity, 'capacityGallons', 0)
        return [{
          id: `water:${entity.id}:tank`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Rainwater storage tank',
          specification: capacity > 0 ? `${capacity} gallon nominal storage capacity` : 'Storage capacity unresolved',
          quantity: 1,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept rainwater storage entity.',
          assumptions: ['Tank rating, foundation/support, potable suitability, freezing, access, overflow, and local requirements are unresolved.'],
        }]
      }

      if (entity.kind === 'water.pump') {
        const flow = numberProperty(entity, 'targetFlowGpm', 0)
        return [{
          id: `water:${entity.id}:pump`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Water pump',
          specification: flow > 0 ? `Concept target flow ${flow} gpm; pressure/head unresolved` : 'Pump duty point unresolved',
          quantity: 1,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept rainwater distribution pump.',
          assumptions: ['Static head, friction loss, pressure target, controls, power, duty cycle, water quality, and certification are unresolved.'],
        }]
      }

      if (entity.kind === 'water.pipe') {
        const length = numberProperty(entity, 'lengthFeet', 0)
        if (length <= 0) return []
        return [
          {
            id: `water:${entity.id}:pipe`,
            sourceEntityId: entity.id,
            parentEntityId: entity.parentId,
            kind: 'material',
            name: 'Water pipe',
            specification: '1 in nominal water pipe, material and pressure rating unresolved',
            quantity: length,
            unit: 'ft',
            acquisition: 'unresolved',
            confidence: 'conceptual',
            basis: 'Concept connection run length.',
            assumptions: ['Route, fittings, burial/support, pressure rating, freeze protection, treatment compatibility, and code requirements are unresolved.'],
          },
          {
            id: `water:${entity.id}:fittings`,
            sourceEntityId: entity.id,
            parentEntityId: entity.parentId,
            kind: 'part',
            name: 'Water-system connection fittings',
            specification: 'Connection/fitting set, exact types unresolved',
            quantity: 4,
            unit: 'each',
            acquisition: 'unresolved',
            confidence: 'conceptual',
            basis: 'Starter allowance for tank-to-pipe-to-pump interfaces.',
            assumptions: ['Exact adapter, valve, union, check-valve, filter, and service requirements are not yet derived.'],
          },
        ]
      }

      return []
    })
  },
}

export function createRainwaterSystemTransaction(
  baseRevision: number,
  input: RainwaterSystemInput,
  actor: ActorRef,
): WorldTransaction {
  requirePositive('capacityGallons', input.capacityGallons)
  requirePositive('pipeRunFeet', input.pipeRunFeet)
  if (input.targetFlowGpm !== undefined) requirePositive('targetFlowGpm', input.targetFlowGpm)

  const origin = input.origin ?? { x: 0, y: 0, z: 0 }
  const at = new Date().toISOString()
  const systemId = createId('rainwater')
  const tankId = createId('tank')
  const pumpId = createId('pump')
  const pipeId = createId('water-pipe')
  const name = input.name?.trim() || 'Rainwater system'

  const tankOutletPort = createId('port')
  const tankInletPort = createId('port')
  const tankOverflowPort = createId('port')
  const pumpInletPort = createId('port')
  const pumpOutletPort = createId('port')
  const pumpPowerPort = createId('port')
  const pipeStartPort = createId('port')
  const pipeEndPort = createId('port')

  const system = createBoxEntity({
    id: systemId,
    kind: 'system.water.rainwater',
    name,
    position: origin,
    size: { x: 10, y: 6, z: 7 },
    properties: {
      capability: 'water',
      fidelity: 'concept',
    },
    actor,
    at,
  })

  const tank = createBoxEntity({
    id: tankId,
    kind: 'water.storage.tank',
    name: `${name} tank`,
    parentId: systemId,
    position: origin,
    size: { x: 5, y: 5, z: 7 },
    properties: {
      capability: 'water',
      fidelity: 'concept',
      capacityGallons: input.capacityGallons,
    },
    ports: [
      { id: tankInletPort, kind: 'fluid.water.in', name: 'Catchment inlet' },
      { id: tankOutletPort, kind: 'fluid.water.out', name: 'Distribution outlet' },
      { id: tankOverflowPort, kind: 'fluid.water.out.overflow', name: 'Overflow' },
    ],
    actor,
    at,
  })

  const pipe = createBoxEntity({
    id: pipeId,
    kind: 'water.pipe',
    name: `${name} supply run`,
    parentId: systemId,
    position: { x: origin.x + 5.5, y: origin.y + 2, z: origin.z },
    size: { x: Math.max(1, input.pipeRunFeet), y: 0.12, z: 0.12 },
    properties: {
      capability: 'water',
      fidelity: 'concept',
      lengthFeet: input.pipeRunFeet,
    },
    ports: [
      { id: pipeStartPort, kind: 'fluid.water.in', name: 'Pipe start' },
      { id: pipeEndPort, kind: 'fluid.water.out', name: 'Pipe end' },
    ],
    actor,
    at,
  })

  const pump = createBoxEntity({
    id: pumpId,
    kind: 'water.pump',
    name: `${name} pump`,
    parentId: systemId,
    position: { x: origin.x + 6 + input.pipeRunFeet, y: origin.y + 1.5, z: origin.z },
    size: { x: 2, y: 1.5, z: 1.5 },
    properties: {
      capability: 'water',
      fidelity: 'concept',
      targetFlowGpm: input.targetFlowGpm ?? 5,
    },
    ports: [
      { id: pumpInletPort, kind: 'fluid.water.in', name: 'Pump inlet' },
      { id: pumpOutletPort, kind: 'fluid.water.out', name: 'Pump outlet' },
      { id: pumpPowerPort, kind: 'electrical.power.in', name: 'Power input' },
    ],
    actor,
    at,
  })

  const provenance = {
    origin: actor.kind === 'human' ? 'user' as const : actor.kind === 'agent' ? 'agent' as const : 'system' as const,
    actorId: actor.id,
    at,
  }

  return createTransaction({
    baseRevision,
    actor,
    at,
    note: `Create conceptual water system: ${name}`,
    mutations: [
      { kind: 'createEntity', entity: system },
      { kind: 'createEntity', entity: tank },
      { kind: 'createEntity', entity: pipe },
      { kind: 'createEntity', entity: pump },
      {
        kind: 'addRelation',
        relation: {
          id: createId('relation'),
          kind: 'fluid-connects',
          fromEntityId: tankId,
          fromPortId: tankOutletPort,
          toEntityId: pipeId,
          toPortId: pipeStartPort,
          properties: { fluid: 'water' },
          provenance,
        },
      },
      {
        kind: 'addRelation',
        relation: {
          id: createId('relation'),
          kind: 'fluid-connects',
          fromEntityId: pipeId,
          fromPortId: pipeEndPort,
          toEntityId: pumpId,
          toPortId: pumpInletPort,
          properties: { fluid: 'water' },
          provenance,
        },
      },
    ],
  })
}

export const waterCapability: CapabilityDefinition = {
  id: 'water',
  version: '0.1.0',
  name: 'Water',
  description: 'Water storage, conveyance, treatment, distribution, drainage, and reuse. Current slice proves connected rainwater storage with explicit ports.',
  entityKinds: [
    'system.water.rainwater',
    'water.storage.tank',
    'water.pipe',
    'water.pump',
  ],
  buildRequirementProviders: [waterRequirements],
}
