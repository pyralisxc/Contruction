import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  FileWorldStore,
  createBoxEntity,
  createEmptyWorld,
  createTransaction,
} from '../src/index'

const human = { kind: 'human' as const, id: 'human:test' }

test('FileWorldStore survives process-style reconstruction with snapshot and history intact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'contractor-hub-world-'))
  const path = join(directory, 'world.json')

  try {
    const first = new FileWorldStore(
      path,
      createEmptyWorld('Persisted world', 'world-persisted', '2026-09-22T00:00:00.000Z'),
    )

    const tank = createBoxEntity({
      id: 'tank',
      kind: 'equipment.water-storage',
      name: 'Rainwater tank',
      position: { x: 4, y: 5, z: 0 },
      size: { x: 5, y: 5, z: 7 },
      properties: { capacityGallons: 1000 },
      actor: human,
      at: '2026-09-22T00:00:01.000Z',
    })

    first.apply(createTransaction({
      id: 'tx-persist',
      baseRevision: 0,
      actor: human,
      at: '2026-09-22T00:00:01.000Z',
      mutations: [{ kind: 'createEntity', entity: tank }],
    }))

    const second = new FileWorldStore(path)

    assert.equal(second.snapshot().revision, 1)
    assert.equal(second.snapshot().entities[0].name, 'Rainwater tank')
    assert.equal(second.history().length, 1)

    const raw = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(raw.formatVersion, 'contractor-world-file.v0')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
