import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveBuildGraph } from '../src/index'
import {
  InMemoryWorldStore,
  createBoxEntity,
  createEmptyWorld,
  createTransaction,
} from '../../world/src/index'

const human = { kind: 'human' as const, id: 'human:test' }

test('parts and materials derive into a Build Graph without becoming world authority', () => {
  const store = new InMemoryWorldStore(createEmptyWorld('Build graph test', 'world-build-test'))

  const pump = createBoxEntity({
    id: 'pump',
    kind: 'equipment',
    name: 'Transfer pump',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 1, z: 1 },
    actor: human,
  })

  const bolt = createBoxEntity({
    id: 'bolt',
    kind: 'part.fastener',
    name: 'Mounting bolt',
    parentId: 'pump',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 0.1, y: 0.1, z: 0.25 },
    properties: {
      specification: '1/4-20 stainless',
      quantity: 4,
      unit: 'each',
      acquisition: 'buy',
    },
    actor: human,
  })

  const pad = createBoxEntity({
    id: 'pad',
    kind: 'material',
    name: 'Vibration isolation pad',
    parentId: 'pump',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 1.5, y: 0.75, z: 0.1 },
    properties: {
      quantity: 1,
      unit: 'sheet',
    },
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [
      { kind: 'createEntity', entity: pump },
      { kind: 'createEntity', entity: bolt },
      { kind: 'createEntity', entity: pad },
    ],
  }))

  const before = store.snapshot()
  const graph = deriveBuildGraph(before, '2026-09-22T00:00:00.000Z')

  assert.equal(graph.worldRevision, 1)
  assert.equal(graph.totals.requirementCount, 2)
  assert.equal(graph.totals.unresolvedCount, 1)
  assert.equal(graph.requirements.find((item) => item.sourceEntityId === 'bolt')?.quantity, 4)
  assert.deepEqual(store.snapshot(), before, 'Build Graph derivation must not mutate the World')
})
