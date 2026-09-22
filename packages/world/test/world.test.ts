import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InMemoryWorldStore,
  WorldConflictError,
  WorldValidationError,
  createBoxEntity,
  createEmptyWorld,
  createTransaction,
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }
const agent = { kind: 'agent' as const, id: 'agent:test' }

test('human and agent writes share the same transaction path', () => {
  const store = new InMemoryWorldStore(createEmptyWorld('Parity test', 'world-test', '2026-09-21T00:00:00.000Z'))

  const shed = createBoxEntity({
    id: 'shed-1',
    kind: 'structure',
    name: 'Utility shed',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 12, y: 10, z: 8 },
    actor: human,
    at: '2026-09-21T00:00:01.000Z',
  })

  store.apply(createTransaction({
    id: 'tx-human',
    baseRevision: 0,
    actor: human,
    at: '2026-09-21T00:00:01.000Z',
    mutations: [{ kind: 'createEntity', entity: shed }],
  }))

  store.apply(createTransaction({
    id: 'tx-agent',
    baseRevision: 1,
    actor: agent,
    at: '2026-09-21T00:00:02.000Z',
    mutations: [{
      kind: 'moveEntity',
      entityId: 'shed-1',
      position: { x: 4, y: 2, z: 0 },
    }],
  }))

  const world = store.snapshot()
  assert.equal(world.revision, 2)
  assert.deepEqual(world.entities[0].geometry?.position, { x: 4, y: 2, z: 0 })
})

test('stale revisions fail closed', () => {
  const store = new InMemoryWorldStore()
  const entity = createBoxEntity({
    id: 'thing-1',
    kind: 'thing',
    name: 'Thing',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [{ kind: 'createEntity', entity }],
  }))

  assert.throws(
    () =>
      store.apply(createTransaction({
        baseRevision: 0,
        actor: agent,
        mutations: [{ kind: 'renameEntity', entityId: 'thing-1', name: 'Stale edit' }],
      })),
    WorldConflictError,
  )
})

test('transactions are atomic when a later mutation is invalid', () => {
  const store = new InMemoryWorldStore()
  const before = store.snapshot()

  assert.throws(
    () =>
      store.apply(createTransaction({
        baseRevision: 0,
        actor: human,
        mutations: [
          {
            kind: 'createEntity',
            entity: createBoxEntity({
              id: 'temporary',
              kind: 'part',
              name: 'Temporary',
              position: { x: 0, y: 0, z: 0 },
              size: { x: 1, y: 1, z: 1 },
              actor: human,
            }),
          },
          {
            kind: 'moveEntity',
            entityId: 'missing',
            position: { x: 1, y: 1, z: 1 },
          },
        ],
      })),
    WorldValidationError,
  )

  assert.deepEqual(store.snapshot(), before)
})

test('parts can be represented as first-class child entities', () => {
  const store = new InMemoryWorldStore()

  const assembly = createBoxEntity({
    id: 'pump-assembly',
    kind: 'equipment',
    name: 'Water pump',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 1, z: 1.5 },
    actor: human,
  })

  const bolt = createBoxEntity({
    id: 'mount-bolt',
    kind: 'part',
    name: 'Mounting bolt',
    parentId: 'pump-assembly',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 0.05, y: 0.05, z: 0.25 },
    properties: {
      specification: '1/4-20 stainless',
      sourcing: 'buy-or-fabricate-equivalent-after-safety-review',
    },
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [
      { kind: 'createEntity', entity: assembly },
      { kind: 'createEntity', entity: bolt },
    ],
  }))

  assert.equal(store.snapshot().entities.find((entity) => entity.id === 'mount-bolt')?.parentId, 'pump-assembly')
})


test('port-aware relations validate interfaces and clean up when a port is removed', () => {
  const store = new InMemoryWorldStore()

  const tank = createBoxEntity({
    id: 'tank',
    kind: 'water.storage',
    name: 'Tank',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 4, y: 4, z: 6 },
    ports: [
      { id: 'tank-out', kind: 'fluid.water.out', name: 'Outlet' },
    ],
    actor: human,
  })

  const pump = createBoxEntity({
    id: 'pump',
    kind: 'water.pump',
    name: 'Pump',
    position: { x: 5, y: 0, z: 0 },
    size: { x: 2, y: 1, z: 1 },
    ports: [
      { id: 'pump-in', kind: 'fluid.water.in', name: 'Inlet' },
    ],
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [
      { kind: 'createEntity', entity: tank },
      { kind: 'createEntity', entity: pump },
      {
        kind: 'addRelation',
        relation: {
          id: 'water-link',
          kind: 'fluid-connects',
          fromEntityId: 'tank',
          fromPortId: 'tank-out',
          toEntityId: 'pump',
          toPortId: 'pump-in',
          properties: {},
          provenance: {
            origin: 'user',
            actorId: human.id,
            at: '2026-09-22T00:00:00.000Z',
          },
        },
      },
    ],
  }))

  assert.equal(store.snapshot().relations.length, 1)

  store.apply(createTransaction({
    baseRevision: 1,
    actor: human,
    mutations: [{
      kind: 'removePort',
      entityId: 'tank',
      portId: 'tank-out',
    }],
  }))

  assert.equal(store.snapshot().relations.length, 0)
  assert.equal(store.snapshot().entities.find((entity) => entity.id === 'tank')?.ports.length, 0)
})

test('relations cannot point at ports that do not exist', () => {
  const store = new InMemoryWorldStore()

  const a = createBoxEntity({
    id: 'a',
    kind: 'thing',
    name: 'A',
    position: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    actor: human,
  })
  const b = createBoxEntity({
    id: 'b',
    kind: 'thing',
    name: 'B',
    position: { x: 2, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    actor: human,
  })

  store.apply(createTransaction({
    baseRevision: 0,
    actor: human,
    mutations: [
      { kind: 'createEntity', entity: a },
      { kind: 'createEntity', entity: b },
    ],
  }))

  assert.throws(() => store.apply(createTransaction({
    baseRevision: 1,
    actor: human,
    mutations: [{
      kind: 'addRelation',
      relation: {
        id: 'bad-link',
        kind: 'connects',
        fromEntityId: 'a',
        fromPortId: 'missing',
        toEntityId: 'b',
        properties: {},
        provenance: {
          origin: 'user',
          actorId: human.id,
          at: '2026-09-22T00:00:00.000Z',
        },
      },
    }],
  })), WorldValidationError)
})


test('runtime validation rejects malformed entities even when callers bypass factories', () => {
  const store = new InMemoryWorldStore()

  assert.throws(() => store.apply({
    id: 'bad-entity-tx',
    baseRevision: 0,
    actor: human,
    createdAt: '2026-09-22T00:00:00.000Z',
    mutations: [{
      kind: 'createEntity',
      entity: {
        id: 'bad',
        kind: 'thing',
        name: 'Bad geometry',
        geometry: {
          type: 'box',
          position: { x: 0, y: 0, z: 0 },
          size: { x: -1, y: 1, z: 1 },
        },
        properties: {},
        ports: [],
        provenance: {
          origin: 'user',
          actorId: human.id,
          at: '2026-09-22T00:00:00.000Z',
        },
      },
    }],
  }), WorldValidationError)
})

test('runtime validation rejects duplicate port ids on direct entity input', () => {
  const store = new InMemoryWorldStore()

  assert.throws(() => store.apply({
    id: 'duplicate-port-tx',
    baseRevision: 0,
    actor: human,
    createdAt: '2026-09-22T00:00:00.000Z',
    mutations: [{
      kind: 'createEntity',
      entity: {
        id: 'bad-ports',
        kind: 'equipment',
        name: 'Bad ports',
        properties: {},
        ports: [
          { id: 'same', kind: 'fluid.in', name: 'One' },
          { id: 'same', kind: 'fluid.out', name: 'Two' },
        ],
        provenance: {
          origin: 'user',
          actorId: human.id,
          at: '2026-09-22T00:00:00.000Z',
        },
      },
    }],
  }), WorldValidationError)
})

test('unknown mutation kinds fail instead of silently advancing revision', () => {
  const store = new InMemoryWorldStore()
  const before = store.snapshot()

  assert.throws(() => store.apply({
    id: 'unknown-mutation-tx',
    baseRevision: 0,
    actor: human,
    createdAt: '2026-09-22T00:00:00.000Z',
    mutations: [{
      kind: 'futureMutation',
    } as never],
  }), WorldValidationError)

  assert.deepEqual(store.snapshot(), before)
})
