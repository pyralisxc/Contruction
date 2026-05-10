import { blueprintHtml, projectToJson, takeoffToCsv } from '../bim/exporters'
import { ProjectDocument, TakeoffSummary } from '../bim/types'
import { createSampleProject } from '../bim/sampleProject'

const localProjectStorageKey = 'contractor_hub_projects'

export interface StoredProjectSummary {
  id: string
  name: string
  updatedAt?: string
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function readProjectFile(file: File): Promise<ProjectDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(migrateProjectDocument(JSON.parse(String(reader.result)) as ProjectDocument))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not parse project file'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read project file'))
    reader.readAsText(file)
  })
}

export function safeProjectSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contractor-hub-project'
}

export function saveProjectJson(project: ProjectDocument) {
  downloadText(`${safeProjectSlug(project.name)}.json`, projectToJson(project), 'application/json')
}

export async function saveProjectToStorage(project: ProjectDocument): Promise<ProjectDocument> {
  const withTimestamp = migrateProjectDocument({ ...project, updatedAt: new Date().toISOString() })
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
      body: JSON.stringify(withTimestamp),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    })
    if (!response.ok) throw new Error(`Storage save failed (${response.status})`)
    const json = await response.json()
    const saved = migrateProjectDocument((json.project ?? withTimestamp) as ProjectDocument)
    upsertLocalProject(saved)
    return saved
  } catch {
    upsertLocalProject(withTimestamp)
    return withTimestamp
  }
}

export async function listStoredProjects(): Promise<StoredProjectSummary[]> {
  try {
    const response = await fetch('/api/projects')
    if (!response.ok) throw new Error(`Project list failed (${response.status})`)
    const json = await response.json()
    const projects = ((json.projects ?? []) as ProjectDocument[]).map(migrateProjectDocument).map(projectSummary)
    return mergeProjectSummaries(projects, localProjectSummaries())
  } catch {
    return localProjectSummaries()
  }
}

export async function loadStoredProject(projectId: string): Promise<ProjectDocument> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`)
    if (!response.ok) throw new Error(`Project load failed (${response.status})`)
    const json = await response.json()
    const project = migrateProjectDocument(json.project as ProjectDocument)
    upsertLocalProject(project)
    return project
  } catch {
    const local = localProjects().find((project) => project.id === projectId)
    if (!local) throw new Error('Could not load saved project')
    return migrateProjectDocument(local)
  }
}

export function saveTakeoffCsv(project: ProjectDocument, takeoff: TakeoffSummary) {
  downloadText(`${safeProjectSlug(project.name)}-bom.csv`, takeoffToCsv(takeoff, project), 'text/csv')
}

export function openBlueprintPackage(project: ProjectDocument, takeoff: TakeoffSummary) {
  const popup = window.open('', '_blank')
  if (!popup) return
  popup.document.write(blueprintHtml(project, takeoff))
  popup.document.close()
  popup.focus()
}

function localProjects(): ProjectDocument[] {
  try {
    return (JSON.parse(localStorage.getItem(localProjectStorageKey) || '[]') as ProjectDocument[]).map(migrateProjectDocument)
  } catch {
    return []
  }
}

export function migrateProjectDocument(project: ProjectDocument): ProjectDocument {
  const template = createSampleProject()
  const materials = { ...template.materials, ...project.materials }
  const assemblies = { ...template.assemblies, ...project.assemblies }
  const elements = project.elements.map((element) => {
    if (element.type !== 'roof') return element
    const roofType = element.roofType ?? 'gable'
    return {
      ...element,
      roofType,
      attachment: element.attachment ?? (roofType === 'shed' || roofType === 'leanTo' ? 'wallAttachedShed' : roofType === 'porch' ? 'overPorch' : roofType === 'roofOverDeck' ? 'overDeck' : 'freestanding'),
      purlinMode: element.purlinMode ?? 'roofBattenNailer',
      eaveOverhang: element.eaveOverhang ?? element.overhang,
      rakeOverhang: element.rakeOverhang ?? element.overhang,
      roofingMaterialId: element.roofingMaterialId ?? 'asphalt-shingle',
    }
  })
  return {
    ...project,
    schemaVersion: project.schemaVersion ?? 'bimlite.v1',
    jurisdiction: project.jurisdiction ?? template.jurisdiction,
    site: project.site ?? template.site,
    levels: project.levels?.length ? project.levels : template.levels,
    spaces: project.spaces ?? [],
    assemblies,
    materials,
    elements,
    suppliers: project.suppliers ?? template.suppliers,
    updatedAt: project.updatedAt ?? new Date().toISOString(),
  }
}

function upsertLocalProject(project: ProjectDocument) {
  try {
    const next = [project, ...localProjects().filter((candidate) => candidate.id !== project.id)]
    localStorage.setItem(localProjectStorageKey, JSON.stringify(next.slice(0, 12)))
  } catch {
    // Local persistence is best-effort; server storage remains the primary path when available.
  }
}

function localProjectSummaries(): StoredProjectSummary[] {
  return localProjects().map(projectSummary)
}

function projectSummary(project: ProjectDocument): StoredProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
  }
}

function mergeProjectSummaries(primary: StoredProjectSummary[], fallback: StoredProjectSummary[]) {
  const byId = new Map<string, StoredProjectSummary>()
  for (const project of [...fallback, ...primary]) byId.set(project.id, project)
  return [...byId.values()].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}
