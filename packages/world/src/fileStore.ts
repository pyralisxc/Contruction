import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { applyTransaction } from './operations'
import { createEmptyWorld, WorldStore } from './store'
import { TransactionResult, WorldDocument, WorldTransaction, WorldValidationError } from './types'

interface PersistedWorldFile {
  formatVersion: 'contractor-world-file.v0'
  world: WorldDocument
  history: WorldTransaction[]
}

function readPersistedWorld(path: string): PersistedWorldFile | null {
  if (!existsSync(path)) return null

  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PersistedWorldFile>
  if (parsed.formatVersion !== 'contractor-world-file.v0' || !parsed.world || !Array.isArray(parsed.history)) {
    throw new WorldValidationError(`Unsupported or invalid world file: ${path}`)
  }

  return parsed as PersistedWorldFile
}

function writePersistedWorld(path: string, payload: PersistedWorldFile) {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), 'utf8')
  renameSync(temporaryPath, path)
}

export class FileWorldStore implements WorldStore {
  #path: string
  #world: WorldDocument
  #history: WorldTransaction[]

  constructor(path: string, initialWorld: WorldDocument = createEmptyWorld()) {
    this.#path = path
    const persisted = readPersistedWorld(path)
    this.#world = structuredClone(persisted?.world ?? initialWorld)
    this.#history = structuredClone(persisted?.history ?? [])

    if (!persisted) this.#persist()
  }

  snapshot(): WorldDocument {
    return structuredClone(this.#world)
  }

  history(): WorldTransaction[] {
    return structuredClone(this.#history)
  }

  apply(transaction: WorldTransaction): TransactionResult {
    const result = applyTransaction(this.#world, transaction)
    const previousWorld = this.#world
    const previousHistory = this.#history

    this.#world = structuredClone(result.world)
    this.#history = [...this.#history, structuredClone(transaction)]

    try {
      this.#persist()
    } catch (error) {
      this.#world = previousWorld
      this.#history = previousHistory
      throw error
    }

    return {
      ...result,
      world: this.snapshot(),
    }
  }

  #persist() {
    writePersistedWorld(this.#path, {
      formatVersion: 'contractor-world-file.v0',
      world: this.#world,
      history: this.#history,
    })
  }
}
