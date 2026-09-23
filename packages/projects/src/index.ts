import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createId } from '../../world/src/index'

export interface ProjectRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface ProjectIndexFile {
  formatVersion: 'contractor-project-index.v0'
  projects: ProjectRecord[]
}

function writeIndex(path: string, projects: ProjectRecord[]) {
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, JSON.stringify({
    formatVersion: 'contractor-project-index.v0',
    projects,
  } satisfies ProjectIndexFile, null, 2), 'utf8')
  renameSync(temporaryPath, path)
}

export class FileProjectRegistry {
  #root: string
  #indexPath: string
  #projects: ProjectRecord[]

  constructor(root: string) {
    this.#root = root
    this.#indexPath = join(root, 'index.json')
    mkdirSync(root, { recursive: true })

    if (!existsSync(this.#indexPath)) {
      this.#projects = []
      writeIndex(this.#indexPath, [])
      return
    }

    const parsed = JSON.parse(readFileSync(this.#indexPath, 'utf8')) as Partial<ProjectIndexFile>
    if (parsed.formatVersion !== 'contractor-project-index.v0' || !Array.isArray(parsed.projects)) {
      throw new Error(`Unsupported or invalid project index: ${this.#indexPath}`)
    }

    this.#projects = structuredClone(parsed.projects)
  }

  list(): ProjectRecord[] {
    return structuredClone(
      [...this.#projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    )
  }

  get(projectId: string): ProjectRecord | undefined {
    const record = this.#projects.find((project) => project.id === projectId)
    return record ? structuredClone(record) : undefined
  }

  require(projectId: string): ProjectRecord {
    const record = this.get(projectId)
    if (!record) throw new Error(`Unknown project: ${projectId}`)
    return record
  }

  create(name: string, options: { id?: string; at?: string } = {}): ProjectRecord {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Project name is required')

    const id = options.id ?? createId('project')
    if (this.#projects.some((project) => project.id === id)) {
      throw new Error(`Project already exists: ${id}`)
    }

    const at = options.at ?? new Date().toISOString()
    const record: ProjectRecord = {
      id,
      name: trimmed,
      createdAt: at,
      updatedAt: at,
    }

    this.#projects.push(record)
    mkdirSync(this.projectDirectory(id), { recursive: true })
    this.#persist()
    return structuredClone(record)
  }

  touch(projectId: string, at = new Date().toISOString()): ProjectRecord {
    const index = this.#projects.findIndex((project) => project.id === projectId)
    if (index < 0) throw new Error(`Unknown project: ${projectId}`)
    this.#projects[index] = {
      ...this.#projects[index],
      updatedAt: at,
    }
    this.#persist()
    return structuredClone(this.#projects[index])
  }

  rename(projectId: string, name: string, at = new Date().toISOString()): ProjectRecord {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Project name is required')
    const index = this.#projects.findIndex((project) => project.id === projectId)
    if (index < 0) throw new Error(`Unknown project: ${projectId}`)
    this.#projects[index] = {
      ...this.#projects[index],
      name: trimmed,
      updatedAt: at,
    }
    this.#persist()
    return structuredClone(this.#projects[index])
  }

  ensureInitial(name = 'Contractor Hub Project'): ProjectRecord {
    const existing = this.list()[0]
    return existing ?? this.create(name)
  }

  projectDirectory(projectId: string): string {
    this.requireIfInitialized(projectId)
    return join(this.#root, projectId)
  }

  worldPath(projectId: string): string {
    return join(this.projectDirectory(projectId), 'world.json')
  }

  supplyPath(projectId: string): string {
    return join(this.projectDirectory(projectId), 'supply-observations.json')
  }

  proposalPath(projectId: string): string {
    return join(this.projectDirectory(projectId), 'proposals.json')
  }

  #requireIfInitialized(projectId: string) {
    if (this.#projects.length > 0 && !this.#projects.some((project) => project.id === projectId)) {
      throw new Error(`Unknown project: ${projectId}`)
    }
  }

  #persist() {
    writeIndex(this.#indexPath, this.#projects)
  }
}
