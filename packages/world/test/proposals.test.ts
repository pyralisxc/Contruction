import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InMemoryWorldStore,
  createBoxEntity,
  createEmptyWorld,
  createTransaction,
  previewTransaction,
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }
const agent = { kind: 'agent' as const, id: 'agent:test' }

test('proposal preview produces a diff without mutating accepted World state', () => {
  const store = new InMemoryWorldStore(createEmptyWorld())
  const entity = createBoxEntity({
    id: 'shed',
    kind: 'structure',
    name: 'Shed',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 10, y: 8, z: 8 },
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [{ kind: 'createEntity', entity }],
  }))

  const accepted = store.snapshot()
  const proposal = createTransaction({
    id: 'proposal-move',
    baseRevision: accepted.revision,
    actor: agent,
    mutations: [{
      kind: 'moveEntity',
      entityId: 'shed',
      position: { x: 5, y: 2, z: 0 },
    }],
  })

  const preview = previewTransaction(accepted, proposal)

  assert.equal(preview.diff.changedEntities.length, 1)
  assert.deepEqual(preview.previewWorld.entities[0].geometry?.position, { x: 5, y: 2, z: 0 })
  assert.deepEqual(store.snapshot(), accepted)
})

test('proposal preview validates against its base revision', () => {
  const world = createEmptyWorld()
  const proposal = createTransaction({
    baseRevision: 3,
    actor: agent,
    mutations: [{
      kind: 'setProperty',
      entityId: 'missing',
      key: 'x',
      value: 1,
    }],
  })

  assert.throws(() => previewTransaction(world, proposal), /Revision mismatch/)
})
