import { applyTransaction } from './operations'
import {
  TransactionResult,
  WorldDocument,
  WorldTransaction,
} from './types'

export function createEmptyWorld(
  name = 'Untitled World',
  id = 'world-local',
  now = new Date().toISOString(),
): WorldDocument {
  return {
    schemaVersion: 'contractor-world.v0',
    id,
    name,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    entities: [],
    relations: [],
  }
}

export interface WorldStore {
  snapshot(): WorldDocument
  apply(transaction: WorldTransaction): TransactionResult
}

export class InMemoryWorldStore implements WorldStore {
  #world: WorldDocument
  #history: WorldTransaction[] = []

  constructor(initialWorld: WorldDocument = createEmptyWorld()) {
    this.#world = structuredClone(initialWorld)
  }

  snapshot(): WorldDocument {
    return structuredClone(this.#world)
  }

  apply(transaction: WorldTransaction): TransactionResult {
    const result = applyTransaction(this.#world, transaction)
    this.#world = structuredClone(result.world)
    this.#history.push(structuredClone(transaction))
    return {
      ...result,
      world: this.snapshot(),
    }
  }

  history(): WorldTransaction[] {
    return structuredClone(this.#history)
  }
}
