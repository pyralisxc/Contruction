import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { WorldTransaction } from './types'

interface ProposalFile {
  formatVersion: 'contractor-world-proposals.v0'
  proposals: WorldTransaction[]
}

function persist(path: string, proposals: WorldTransaction[]) {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, JSON.stringify({
    formatVersion: 'contractor-world-proposals.v0',
    proposals,
  } satisfies ProposalFile, null, 2), 'utf8')
  renameSync(temporaryPath, path)
}

export class FileProposalStore {
  #path: string
  #proposals: WorldTransaction[]

  constructor(path: string) {
    this.#path = path
    if (!existsSync(path)) {
      this.#proposals = []
      persist(path, [])
      return
    }

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProposalFile>
    if (parsed.formatVersion !== 'contractor-world-proposals.v0' || !Array.isArray(parsed.proposals)) {
      throw new Error(`Unsupported or invalid proposal file: ${path}`)
    }
    this.#proposals = structuredClone(parsed.proposals)
  }

  list(): WorldTransaction[] {
    return structuredClone(this.#proposals)
  }

  get(id: string): WorldTransaction | undefined {
    const proposal = this.#proposals.find((candidate) => candidate.id === id)
    return proposal ? structuredClone(proposal) : undefined
  }

  save(proposal: WorldTransaction): WorldTransaction {
    if (this.#proposals.some((candidate) => candidate.id === proposal.id)) {
      throw new Error(`Proposal already exists: ${proposal.id}`)
    }
    this.#proposals.push(structuredClone(proposal))
    persist(this.#path, this.#proposals)
    return structuredClone(proposal)
  }

  remove(id: string): boolean {
    const next = this.#proposals.filter((candidate) => candidate.id !== id)
    if (next.length === this.#proposals.length) return false
    this.#proposals = next
    persist(this.#path, this.#proposals)
    return true
  }
}
