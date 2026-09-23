import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { FileProjectRegistry } from '../src/index'

test('project registry persists distinct project identities and storage boundaries', () => {
  const root = mkdtempSync(join(tmpdir(), 'contractor-projects-'))

  try {
    const first = new FileProjectRegistry(root)
    const cabin = first.create('Cabin', {
      id: 'project-cabin',
      at: '2026-09-23T00:00:00.000Z',
    })
    const shop = first.create('Workshop', {
      id: 'project-shop',
      at: '2026-09-23T00:01:00.000Z',
    })

    assert.notEqual(first.worldPath(cabin.id), first.worldPath(shop.id))
    assert.equal(existsSync(first.projectDirectory(cabin.id)), true)
    assert.equal(existsSync(first.projectDirectory(shop.id)), true)

    first.touch(cabin.id, '2026-09-23T00:02:00.000Z')

    const second = new FileProjectRegistry(root)
    assert.equal(second.list().length, 2)
    assert.equal(second.list()[0].id, cabin.id)
    assert.equal(second.get(shop.id)?.name, 'Workshop')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('unknown project ids cannot escape the project registry boundary', () => {
  const root = mkdtempSync(join(tmpdir(), 'contractor-projects-'))

  try {
    const registry = new FileProjectRegistry(root)
    registry.create('Known', { id: 'known-project' })
    assert.throws(() => registry.worldPath('../other-project'), /Unknown project/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
