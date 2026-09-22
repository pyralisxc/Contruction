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
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }

test('water capability creates connected tank, pipe, and pump interfaces', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createRainwaterSystemTransaction(0, {
    name: 'Cabin water',
    capacityGallons: 1000,
    pipeRunFeet: 12,
    targetFlowGpm: 6,
  }, human))

  const world = store.snapshot()
  assert.equal(world.entities.filter((entity) => entity.kind === 'water.storage.tank').length, 1)
  assert.equal(world.entities.filter((entity) => entity.kind === 'water.pipe').length, 1)
  assert.equal(world.entities.filter((entity) => entity.kind === 'water.pump').length, 1)
  assert.equal(world.relations.filter((relation) => relation.kind === 'fluid-connects').length, 2)
  assert.equal(world.relations.every((relation) => Boolean(relation.fromPortId && relation.toPortId)), true)
})

test('water capability contributes conceptual sourcing requirements through registry', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createRainwaterSystemTransaction(0, {
    capacityGallons: 500,
    pipeRunFeet: 20,
  }, human))

  const registry = new CapabilityRegistry()
  registry.register(waterCapability)

  const graph = deriveBuildGraph(
    store.snapshot(),
    '2026-09-22T00:00:00.000Z',
    registry.buildRequirementProviders(),
  )

  assert.equal(graph.requirements.length, 4)
  assert.equal(graph.totals.conceptualCount, 4)
  assert.equal(graph.requirements.every((requirement) => requirement.capabilityId === 'water'), true)
  assert.equal(graph.requirements.find((requirement) => requirement.name === 'Water pipe')?.quantity, 20)
})
