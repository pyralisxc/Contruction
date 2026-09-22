import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  FileProposalStore,
  createTransaction,
} from '../src/index'

const agent = { kind: 'agent' as const, id: 'agent:test' }

test('pending proposals survive store reconstruction and can be discarded', () => {
  const directory = mkdtempSync(join(tmpdir(), 'contractor-proposals-'))
  const path = join(directory, 'proposals.json')

  try {
    const first = new FileProposalStore(path)
    const proposal = createTransaction({
      id: 'proposal-1',
      baseRevision: 0,
      actor: agent,
      mutations: [{
        kind: 'setProperty',
        entityId: 'thing',
        key: 'note',
        value: 'candidate',
      }],
    })

    first.save(proposal)

    const second = new FileProposalStore(path)
    assert.equal(second.list().length, 1)
    assert.equal(second.get('proposal-1')?.actor.id, 'agent:test')
    assert.equal(second.remove('proposal-1'), true)
    assert.equal(second.list().length, 0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
