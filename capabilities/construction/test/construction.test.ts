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


test('editing wall path geometry immediately changes derived material requirements', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  store.apply(createConceptShedTransaction(0, {
    name: 'Editable shed',
    width: 12,
    depth: 10,
    wallHeight: 8,
  }, human))

  const registry = new CapabilityRegistry()
  registry.register(constructionCapability)

  const wall = store.snapshot().entities.find(
    (entity) => entity.kind === 'construction.wall' && entity.name.includes('north wall'),
  )
  assert.ok(wall)
  assert.equal(wall.geometry?.type, 'polyline')

  const before = deriveBuildGraph(
    store.snapshot(),
    '2026-09-23T00:00:00.000Z',
    registry.buildRequirementProviders(),
  )
  const beforeSheathing = before.requirements.find(
    (requirement) => requirement.id === `construction:${wall.id}:sheathing`,
  )
  assert.equal(beforeSheathing?.quantity, 96)

  const points = wall.geometry?.type === 'polyline' ? wall.geometry.points : []
  store.apply({
    id: 'stretch-wall',
    baseRevision: 1,
    actor: human,
    createdAt: '2026-09-23T00:01:00.000Z',
    mutations: [{
      kind: 'setGeometryPoint',
      entityId: wall.id,
      index: 1,
      point: { x: points[1].x + 4, y: points[1].y, z: points[1].z },
    }],
  })

  const after = deriveBuildGraph(
    store.snapshot(),
    '2026-09-23T00:01:01.000Z',
    registry.buildRequirementProviders(),
  )
  const afterSheathing = after.requirements.find(
    (requirement) => requirement.id === `construction:${wall.id}:sheathing`,
  )
  assert.equal(afterSheathing?.quantity, 128)
})
