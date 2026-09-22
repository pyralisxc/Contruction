import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveBuildGraph } from '../../../packages/build/src/index'
import { CapabilityRegistry } from '../../../packages/capabilities/src/index'
import {
  InMemoryWorldStore,
  createEmptyWorld,
} from '../../../packages/world/src/index'
import {
  constructionCapability,
  createConceptShedTransaction,
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }

test('construction capability creates a semantic shed through one transaction', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  const transaction = createConceptShedTransaction(0, {
    name: 'Test shed',
    width: 12,
    depth: 10,
    wallHeight: 8,
  }, human)

  store.apply(transaction)
  const world = store.snapshot()

  assert.equal(world.revision, 1)
  assert.equal(world.entities.filter((entity) => entity.kind === 'structure.shed').length, 1)
  assert.equal(world.entities.filter((entity) => entity.kind === 'construction.wall').length, 4)
  assert.equal(world.entities.filter((entity) => entity.kind === 'construction.floor').length, 1)
  assert.equal(world.entities.filter((entity) => entity.kind === 'construction.roof').length, 1)
})

test('construction requirements remain explicitly conceptual', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createConceptShedTransaction(0, {
    width: 12,
    depth: 10,
    wallHeight: 8,
  }, human))

  const registry = new CapabilityRegistry()
  registry.register(constructionCapability)

  const graph = deriveBuildGraph(
    store.snapshot(),
    '2026-09-22T00:00:00.000Z',
    registry.buildRequirementProviders(),
  )

  assert.equal(graph.requirements.length, 10)
  assert.equal(graph.totals.conceptualCount, 10)
  assert.equal(graph.requirements.every((requirement) => requirement.capabilityId === 'construction'), true)
  assert.equal(graph.requirements.every((requirement) => requirement.confidence === 'conceptual'), true)
  assert.equal(graph.requirements.some((requirement) => requirement.assumptions?.length), true)
})
