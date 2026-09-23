import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { FileSupplyObservationStore } from '../src/store'

test('supply observations survive store reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'contractor-supply-'))
  const path = join(directory, 'supply.json')

  try {
    const first = new FileSupplyObservationStore(path)
    first.record({
      id: 'owned-bolt',
      sourceId: 'truck',
      sourceName: 'Truck inventory',
      sourceKind: 'inventory',
      observedAt: '2026-09-22T00:00:00.000Z',
      requirementId: 'requirement:bolt',
      quantityAvailable: 12,
      unit: 'each',
    })

    const second = new FileSupplyObservationStore(path)
    assert.equal(second.list().length, 1)
    assert.equal(second.list()[0].sourceKind, 'inventory')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
