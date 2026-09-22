import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveBuildGraph } from '../../../packages/build/src/index'
import { CapabilityRegistry } from '../../../packages/capabilities/src/index'
import {
  InMemoryWorldStore,
  createEmptyWorld,
} from '../../../packages/world/src/index'
import {
  createRainwaterSystemTransaction,
  waterCapability,
} from '../../water/src/index'
import {
  createSolarMicrogridTransaction,
  energyCapability,
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }

test('energy capability can supply a power port created by another capability', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createRainwaterSystemTransaction(0, {
    capacityGallons: 1000,
    pipeRunFeet: 10,
  }, human))

  const waterWorld = store.snapshot()
  const pump = waterWorld.entities.find((entity) => entity.kind === 'water.pump')
  const powerPort = pump?.ports.find((port) => port.kind === 'electrical.power.in')
  assert.ok(pump)
  assert.ok(powerPort)

  store.apply(createSolarMicrogridTransaction(1, {
    panelCount: 6,
    panelWatts: 400,
    batteryKwh: 10,
    inverterKw: 5,
    loadEntityId: pump.id,
    loadPortId: powerPort.id,
  }, human))

  const world = store.snapshot()
  const powerRelation = world.relations.find((relation) => relation.kind === 'electrical.supplies-power')
  assert.equal(powerRelation?.toEntityId, pump.id)
  assert.equal(powerRelation?.toPortId, powerPort.id)
})

test('energy capability contributes transparent conceptual equipment requirements', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createSolarMicrogridTransaction(0, {
    panelCount: 8,
    panelWatts: 450,
    batteryKwh: 13.5,
    inverterKw: 7.6,
  }, human))

  const registry = new CapabilityRegistry()
  registry.register(energyCapability)

  const graph = deriveBuildGraph(
    store.snapshot(),
    '2026-09-22T00:00:00.000Z',
    registry.buildRequirementProviders(),
  )

  assert.equal(graph.requirements.length, 4)
  assert.equal(graph.totals.conceptualCount, 4)
  assert.equal(graph.requirements.find((requirement) => requirement.name === 'Solar modules')?.quantity, 8)
  assert.equal(graph.requirements.every((requirement) => requirement.capabilityId === 'energy'), true)
})
