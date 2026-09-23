import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type { BuildRequirementProvider } from '../../../packages/build/src/index'
import { deriveBuildGraph } from '../../../packages/build/src/index'
import { FileProjectRegistry, type ProjectRecord } from '../../../packages/projects/src/index'
import {
  FileSupplyObservationStore,
  deriveSupplyGraph,
  type SupplyObservation,
} from '../../../packages/supply/src/index'
import {
  FileProposalStore,
  FileWorldStore,
  createEmptyWorld,
  type TransactionResult,
  type WorldTransaction,
} from '../../../packages/world/src/index'

export interface ProjectRuntime {
  project: ProjectRecord
  store: FileWorldStore
  supplyStore: FileSupplyObservationStore
  proposalStore: FileProposalStore
}

export class ProjectRuntimeManager {
  readonly registry: FileProjectRegistry
  readonly dataRoot: string
  #providers: BuildRequirementProvider[]
  #runtimes = new Map<string, ProjectRuntime>()

  constructor(
    dataRoot: string,
    providers: BuildRequirementProvider[],
  ) {
    this.dataRoot = resolve(dataRoot)
    this.#providers = providers
    this.registry = new FileProjectRegistry(join(this.dataRoot, 'projects'))
    this.#migrateLegacySingleProject()
    this.registry.ensureInitial('Contractor Hub Project')
  }

  list(): ProjectRecord[] {
    return this.registry.list()
  }

  create(name: string): ProjectRecord {
    const record = this.registry.create(name)
    this.runtime(record.id)
    return record
  }

  runtime(projectId: string): ProjectRuntime {
    const cached = this.#runtimes.get(projectId)
    if (cached) {
      cached.project = this.registry.require(projectId)
      return cached
    }

    const project = this.registry.require(projectId)
    const runtime: ProjectRuntime = {
      project,
      store: new FileWorldStore(
        this.registry.worldPath(projectId),
        createEmptyWorld(project.name, project.id, project.createdAt),
      ),
      supplyStore: new FileSupplyObservationStore(
        this.registry.supplyPath(projectId),
      ),
      proposalStore: new FileProposalStore(
        this.registry.proposalPath(projectId),
      ),
    }

    this.#runtimes.set(projectId, runtime)
    return runtime
  }

  apply(projectId: string, transaction: WorldTransaction): TransactionResult {
    const runtime = this.runtime(projectId)
    const result = runtime.store.apply(transaction)
    runtime.project = this.registry.touch(projectId, transaction.createdAt)
    return result
  }

  recordSupply(projectId: string, observation: SupplyObservation): SupplyObservation {
    const runtime = this.runtime(projectId)
    const result = runtime.supplyStore.record(observation)
    runtime.project = this.registry.touch(projectId, observation.observedAt)
    return result
  }

  buildGraph(projectId: string) {
    return deriveBuildGraph(
      this.runtime(projectId).store.snapshot(),
      new Date().toISOString(),
      this.#providers,
    )
  }

  supplyGraph(projectId: string) {
    return deriveSupplyGraph(
      this.buildGraph(projectId),
      this.runtime(projectId).supplyStore.list(),
    )
  }

  rename(projectId: string, name: string): ProjectRecord {
    const record = this.registry.rename(projectId, name)
    const runtime = this.#runtimes.get(projectId)
    if (runtime) runtime.project = record
    return record
  }

  #migrateLegacySingleProject() {
    if (this.registry.list().length > 0) return

    const legacyWorld = join(this.dataRoot, 'world.json')
    if (!existsSync(legacyWorld)) return

    let projectName = 'Migrated Contractor Hub Project'
    let projectId: string | undefined
    try {
      const parsed = JSON.parse(readFileSync(legacyWorld, 'utf8')) as {
        world?: { id?: unknown; name?: unknown }
      }
      if (typeof parsed.world?.name === 'string' && parsed.world.name.trim()) {
        projectName = parsed.world.name.trim()
      }
      if (
        typeof parsed.world?.id === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(parsed.world.id)
      ) {
        projectId = parsed.world.id
      }
    } catch {
      // The existing World store will surface file-format problems after migration.
    }

    const record = this.registry.create(projectName, { id: projectId })
    copyFileSync(legacyWorld, this.registry.worldPath(record.id))

    const legacySupply = join(this.dataRoot, 'supply-observations.json')
    if (existsSync(legacySupply)) {
      copyFileSync(legacySupply, this.registry.supplyPath(record.id))
    }

    const legacyProposals = join(this.dataRoot, 'proposals.json')
    if (existsSync(legacyProposals)) {
      copyFileSync(legacyProposals, this.registry.proposalPath(record.id))
    }
  }
}
