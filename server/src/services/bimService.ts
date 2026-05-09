import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { deriveProject as clientDeriveProject } from '../../../client/src/bim/geometry'
import { validateProject as clientValidateProject } from '../../../client/src/bim/rules'
import { generateTakeoff as clientGenerateTakeoff } from '../../../client/src/bim/takeoff'
import type { ProjectDocument, TakeoffLine as ClientTakeoffLine } from '../../../client/src/bim/types'

// ---------------------------------------------------------------------------
// SQLite setup
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../../data/projects.db')

// Ensure data directory exists
import { mkdirSync } from 'fs'
mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
`)

const stmtUpsert = db.prepare(`
  INSERT INTO projects (id, name, updated_at, data)
  VALUES (@id, @name, @updated_at, @data)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    updated_at = excluded.updated_at,
    data = excluded.data
`)

const stmtGet = db.prepare<[string]>('SELECT data FROM projects WHERE id = ?')
const stmtList = db.prepare('SELECT data FROM projects ORDER BY updated_at DESC')
const stmtInsertSnapshot = db.prepare(`
  INSERT INTO snapshots (project_id, saved_at, data) VALUES (@project_id, @saved_at, @data)
`)

export interface ApiProjectDocument {
  schemaVersion: string
  id: string
  name: string
  updatedAt: string
  elements: ApiElement[]
  materials?: Record<string, { name: string; unit: string; wasteFactor?: number }>
  suppliers?: { zipCode?: string }
  [key: string]: unknown
}

interface ApiElement {
  id: string
  type: string
  name?: string
  [key: string]: unknown
}

interface TakeoffLine {
  id: string
  materialId: string
  description: string
  subsystem: string
  location: string
  quantity: number
  unit: string
}

// ---------------------------------------------------------------------------
// Supplier catalog
// ---------------------------------------------------------------------------
const supplierCatalog = [
  { supplier: 'homeDepot', sku: '058449', materialId: 'stud-2x6', title: '2 in. x 6 in. x 8 ft. SPF Dimensional Lumber', unitPrice: 7.98, availableQty: 240 },
  { supplier: 'homeDepot', sku: '603682', materialId: 'joist-2x10', title: '2 in. x 10 in. x 12 ft. Dimensional Lumber', unitPrice: 29.88, availableQty: 88 },
  { supplier: 'homeDepot', sku: '920924', materialId: 'subfloor-3-4', title: '3/4 in. Tongue and Groove Subfloor 4 ft. x 8 ft.', unitPrice: 52.5, availableQty: 68 },
  { supplier: 'homeDepot', sku: '100043', materialId: 'concrete-pier-block', title: 'Concrete Deck Block', unitPrice: 14.48, availableQty: 76 },
  { supplier: 'homeDepot', sku: '288282', materialId: 'romex-12-2', title: '12/2 Solid Romex SIMpull CU NM-B W/G Wire', unitPrice: 0.82, availableQty: 500 },
  { supplier: 'homeDepot', sku: '100382', materialId: 'pex-1-2', title: '1/2 in. PEX Pipe Coil', unitPrice: 0.48, availableQty: 400 },
]

// ---------------------------------------------------------------------------
// CRUD — projects
// ---------------------------------------------------------------------------
export function saveProject(project: ApiProjectDocument): ApiProjectDocument {
  const saved = { ...project, updatedAt: new Date().toISOString() }
  stmtUpsert.run({ id: saved.id, name: saved.name, updated_at: saved.updatedAt, data: JSON.stringify(saved) })
  return saved
}

export function listProjects(): ApiProjectDocument[] {
  const rows = stmtList.all() as { data: string }[]
  return rows.map((row) => JSON.parse(row.data) as ApiProjectDocument)
}

export function getProject(id: string): ApiProjectDocument | undefined {
  const row = stmtGet.get(id) as { data: string } | undefined
  return row ? (JSON.parse(row.data) as ApiProjectDocument) : undefined
}

export function addSnapshot(id: string, project: ApiProjectDocument): ApiProjectDocument {
  const saved = saveProject(project)
  stmtInsertSnapshot.run({ project_id: id, saved_at: saved.updatedAt, data: JSON.stringify(saved) })
  return saved
}

export function deriveProject(project: ApiProjectDocument) {
  return clientDeriveProject(project as unknown as ProjectDocument)
}

export function validateProject(project: ApiProjectDocument) {
  const typedProject = project as unknown as ProjectDocument
  return clientValidateProject(typedProject, clientDeriveProject(typedProject))
}

export function generateTakeoff(project: ApiProjectDocument) {
  return clientGenerateTakeoff(project as unknown as ProjectDocument, deriveProject(project))
}

export function searchSuppliers(query: string, zipCode = '96813') {
  const normalized = query.toLowerCase()
  return supplierCatalog
    .filter((product) => product.title.toLowerCase().includes(normalized) || product.materialId.toLowerCase().includes(normalized))
    .map((product) => ({ ...product, zipCode, storeName: 'Home Depot preferred store', lastUpdated: new Date().toISOString() }))
}

export function mapSuppliers(lines: (TakeoffLine | ClientTakeoffLine)[], zipCode = '96813') {
  const ids = new Set(lines.map((line) => line.materialId))
  return supplierCatalog
    .filter((product) => ids.has(product.materialId))
    .map((product) => ({ ...product, zipCode, storeName: 'Home Depot preferred store', lastUpdated: new Date().toISOString() }))
}

export function takeoffCsv(lines: TakeoffLine[]): string {
  const rows = [['Subsystem', 'Location', 'Material', 'Description', 'Quantity', 'Unit']]
  for (const line of lines) rows.push([line.subsystem, line.location, line.materialId, line.description, String(line.quantity), line.unit])
  return rows.map((row) => row.map((cell) => `"${cell.split('"').join('""')}"`).join(',')).join('\n')
}

export function blueprintHtml(project: ApiProjectDocument, takeoffLines: TakeoffLine[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${project.name}</title></head><body><h1>${project.name}</h1><p>Generated contractor hub blueprint package.</p><h2>Material Schedule</h2><table>${takeoffLines.map((line) => `<tr><td>${line.subsystem}</td><td>${line.description}</td><td>${line.quantity}</td><td>${line.unit}</td></tr>`).join('')}</table></body></html>`
}
