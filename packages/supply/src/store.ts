import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { SupplyObservation } from './index'

interface SupplyObservationFile {
  formatVersion: 'contractor-supply-observations.v0'
  observations: SupplyObservation[]
}

function writeFile(path: string, payload: SupplyObservationFile) {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), 'utf8')
  renameSync(temporaryPath, path)
}

export class FileSupplyObservationStore {
  #path: string
  #observations: SupplyObservation[]

  constructor(path: string) {
    this.#path = path
    if (!existsSync(path)) {
      this.#observations = []
      writeFile(path, {
        formatVersion: 'contractor-supply-observations.v0',
        observations: [],
      })
      return
    }

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SupplyObservationFile>
    if (parsed.formatVersion !== 'contractor-supply-observations.v0' || !Array.isArray(parsed.observations)) {
      throw new Error(`Unsupported or invalid supply observation file: ${path}`)
    }

    this.#observations = structuredClone(parsed.observations)
  }

  list(): SupplyObservation[] {
    return structuredClone(this.#observations)
  }

  record(observation: SupplyObservation): SupplyObservation {
    if (!observation.id.trim()) throw new Error('Supply observation id is required')
    if (!observation.sourceId.trim() || !observation.sourceName.trim()) {
      throw new Error('Supply source identity is required')
    }
    if (observation.quantityAvailable < 0 || !Number.isFinite(observation.quantityAvailable)) {
      throw new Error('quantityAvailable must be a non-negative finite number')
    }

    const index = this.#observations.findIndex((candidate) => candidate.id === observation.id)
    if (index >= 0) this.#observations[index] = structuredClone(observation)
    else this.#observations.push(structuredClone(observation))

    writeFile(this.#path, {
      formatVersion: 'contractor-supply-observations.v0',
      observations: this.#observations,
    })

    return structuredClone(observation)
  }
}
