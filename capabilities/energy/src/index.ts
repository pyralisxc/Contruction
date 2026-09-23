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

export interface SolarMicrogridInput {
  name?: string
  panelCount: number
  panelWatts: number
  batteryKwh: number
  inverterKw: number
  origin?: Vec3
  loadEntityId?: string
  loadPortId?: string
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

const energyRequirements: BuildRequirementProvider = {
  id: 'energy-solar-microgrid-requirements-v0',
  capabilityId: 'energy',
  derive(world: WorldDocument): BuildRequirement[] {
    return world.entities.flatMap<BuildRequirement>((entity) => {
      if (entity.kind === 'energy.solar.array') {
        const panelCount = Math.max(1, Math.round(numberProperty(entity, 'panelCount', 1)))
        const panelWatts = numberProperty(entity, 'panelWatts', 0)
        return [{
          id: `energy:${entity.id}:modules`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Solar modules',
          specification: panelWatts > 0 ? `${panelWatts} W module, exact electrical/mechanical specification unresolved` : 'PV module specification unresolved',
          quantity: panelCount,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept PV array module count.',
          assumptions: ['Module model, voltage/current stringing, roof/ground attachment, wind/snow loading, rapid shutdown, conductor sizing, and local requirements are unresolved.'],
        }]
      }

      if (entity.kind === 'energy.battery') {
        const capacity = numberProperty(entity, 'capacityKwh', 0)
        return [{
          id: `energy:${entity.id}:battery`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Battery storage',
          specification: capacity > 0 ? `${capacity} kWh nominal storage, chemistry/model unresolved` : 'Battery storage specification unresolved',
          quantity: 1,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept storage capacity.',
          assumptions: ['Usable capacity, voltage, BMS, enclosure, thermal environment, clearances, listing, protection, and local requirements are unresolved.'],
        }]
      }

      if (entity.kind === 'energy.inverter') {
        const rating = numberProperty(entity, 'continuousKw', 0)
        return [{
          id: `energy:${entity.id}:inverter`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Inverter',
          specification: rating > 0 ? `${rating} kW conceptual continuous rating` : 'Inverter rating unresolved',
          quantity: 1,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept microgrid conversion equipment.',
          assumptions: ['DC window, surge power, topology, grid interaction, transfer equipment, grounding, protection, listing, and local requirements are unresolved.'],
        }]
      }

      if (entity.kind === 'electrical.panel') {
        return [{
          id: `energy:${entity.id}:distribution`,
          sourceEntityId: entity.id,
          parentEntityId: entity.parentId,
          kind: 'equipment',
          name: 'Electrical distribution equipment',
          specification: 'Concept AC distribution panel; service rating and breaker schedule unresolved',
          quantity: 1,
          unit: 'each',
          acquisition: 'unresolved',
          confidence: 'conceptual',
          basis: 'Concept microgrid AC distribution node.',
          assumptions: ['Calculated loads, fault current, conductor sizes, breakers, grounding, disconnects, transfer equipment, and local requirements are unresolved.'],
        }]
      }

      return []
    })
  },
}

export function createSolarMicrogridTransaction(
  baseRevision: number,
  input: SolarMicrogridInput,
  actor: ActorRef,
): WorldTransaction {
  requirePositive('panelCount', input.panelCount)
  requirePositive('panelWatts', input.panelWatts)
  requirePositive('batteryKwh', input.batteryKwh)
  requirePositive('inverterKw', input.inverterKw)
  if (!Number.isInteger(input.panelCount)) throw new Error('panelCount must be an integer')
  if ((input.loadEntityId && !input.loadPortId) || (!input.loadEntityId && input.loadPortId)) {
    throw new Error('loadEntityId and loadPortId must be provided together')
  }

  const origin = input.origin ?? { x: 0, y: 0, z: 0 }
  const at = new Date().toISOString()
  const systemId = createId('microgrid')
  const arrayId = createId('solar-array')
  const batteryId = createId('battery')
  const inverterId = createId('inverter')
  const panelId = createId('panel')
  const name = input.name?.trim() || 'Solar microgrid'

  const arrayDcOut = createId('port')
  const batteryDc = createId('port')
  const inverterDcIn = createId('port')
  const inverterBattery = createId('port')
  const inverterAcOut = createId('port')
  const panelAcIn = createId('port')
  const panelAcOut = createId('port')

  const system = createBoxEntity({
    id: systemId,
    kind: 'system.energy.solar-microgrid',
    name,
    position: origin,
    size: { x: 12, y: 8, z: 6 },
    properties: { capability: 'energy', fidelity: 'concept' },
    actor,
    at,
  })

  const array = createBoxEntity({
    id: arrayId,
    kind: 'energy.solar.array',
    name: `${name} array`,
    parentId: systemId,
    position: origin,
    size: { x: Math.max(4, Math.ceil(input.panelCount / 2) * 3.5), y: 6, z: 0.3 },
    properties: {
      capability: 'energy',
      fidelity: 'concept',
      panelCount: input.panelCount,
      panelWatts: input.panelWatts,
      nominalDcWatts: input.panelCount * input.panelWatts,
    },
    ports: [{ id: arrayDcOut, kind: 'electrical.dc.out', name: 'PV DC output' }],
    actor,
    at,
  })

  const battery = createBoxEntity({
    id: batteryId,
    kind: 'energy.battery',
    name: `${name} battery`,
    parentId: systemId,
    position: { x: origin.x + 1, y: origin.y + 7, z: origin.z },
    size: { x: 2, y: 1.2, z: 3 },
    properties: {
      capability: 'energy',
      fidelity: 'concept',
      capacityKwh: input.batteryKwh,
    },
    ports: [{ id: batteryDc, kind: 'electrical.dc.bidirectional', name: 'Battery DC' }],
    actor,
    at,
  })

  const inverter = createBoxEntity({
    id: inverterId,
    kind: 'energy.inverter',
    name: `${name} inverter`,
    parentId: systemId,
    position: { x: origin.x + 4, y: origin.y + 7, z: origin.z },
    size: { x: 1.5, y: 0.8, z: 2.5 },
    properties: {
      capability: 'energy',
      fidelity: 'concept',
      continuousKw: input.inverterKw,
    },
    ports: [
      { id: inverterDcIn, kind: 'electrical.dc.in', name: 'PV DC input' },
      { id: inverterBattery, kind: 'electrical.dc.bidirectional', name: 'Battery DC interface' },
      { id: inverterAcOut, kind: 'electrical.ac.out', name: 'AC output' },
    ],
    actor,
    at,
  })

  const panel = createBoxEntity({
    id: panelId,
    kind: 'electrical.panel',
    name: `${name} distribution`,
    parentId: systemId,
    position: { x: origin.x + 7, y: origin.y + 7, z: origin.z },
    size: { x: 1.5, y: 0.6, z: 2.5 },
    properties: {
      capability: 'energy',
      fidelity: 'concept',
    },
    ports: [
      { id: panelAcIn, kind: 'electrical.ac.in', name: 'Main AC input' },
      { id: panelAcOut, kind: 'electrical.ac.out', name: 'Load output' },
    ],
    actor,
    at,
  })

  const provenance = {
    origin: actor.kind === 'human' ? 'user' as const : actor.kind === 'agent' ? 'agent' as const : 'system' as const,
    actorId: actor.id,
    at,
  }

  const mutations: WorldTransaction['mutations'] = [
    { kind: 'createEntity', entity: system },
    { kind: 'createEntity', entity: array },
    { kind: 'createEntity', entity: battery },
    { kind: 'createEntity', entity: inverter },
    { kind: 'createEntity', entity: panel },
    {
      kind: 'addRelation',
      relation: {
        id: createId('relation'),
        kind: 'electrical.dc-connects',
        fromEntityId: arrayId,
        fromPortId: arrayDcOut,
        toEntityId: inverterId,
        toPortId: inverterDcIn,
        properties: { role: 'pv-source' },
        provenance,
      },
    },
    {
      kind: 'addRelation',
      relation: {
        id: createId('relation'),
        kind: 'electrical.dc-connects',
        fromEntityId: batteryId,
        fromPortId: batteryDc,
        toEntityId: inverterId,
        toPortId: inverterBattery,
        properties: { role: 'storage' },
        provenance,
      },
    },
    {
      kind: 'addRelation',
      relation: {
        id: createId('relation'),
        kind: 'electrical.ac-connects',
        fromEntityId: inverterId,
        fromPortId: inverterAcOut,
        toEntityId: panelId,
        toPortId: panelAcIn,
        properties: { role: 'distribution-feed' },
        provenance,
      },
    },
  ]

  if (input.loadEntityId && input.loadPortId) {
    mutations.push({
      kind: 'addRelation',
      relation: {
        id: createId('relation'),
        kind: 'electrical.supplies-power',
        fromEntityId: panelId,
        fromPortId: panelAcOut,
        toEntityId: input.loadEntityId,
        toPortId: input.loadPortId,
        properties: { status: 'concept' },
        provenance,
      },
    })
  }

  return createTransaction({
    baseRevision,
    actor,
    at,
    mutations,
    note: `Create conceptual energy system: ${name}`,
  })
}

export const energyCapability: CapabilityDefinition = {
  id: 'energy',
  version: '0.1.0',
  name: 'Energy / Electrical',
  description: 'Generation, storage, conversion, and electrical distribution. Current slice proves a connected solar microgrid and cross-capability load connection.',
  entityKinds: [
    'system.energy.solar-microgrid',
    'energy.solar.array',
    'energy.battery',
    'energy.inverter',
    'electrical.panel',
  ],
  buildRequirementProviders: [energyRequirements],
}
