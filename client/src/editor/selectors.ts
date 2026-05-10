import { deriveProject } from '../bim/geometry'
import { validateProject } from '../bim/rules'
import { mapTakeoffToHomeDepot } from '../bim/suppliers'
import { generateTakeoff } from '../bim/takeoff'
import { BuildingElement, ProjectDocument, RuleResult, SupplierProduct, TakeoffLine } from '../bim/types'

export interface EditorDerivedData {
  derived: ReturnType<typeof deriveProject>
  rules: RuleResult[]
  takeoff: ReturnType<typeof generateTakeoff>
  products: SupplierProduct[]
  selected: BuildingElement | null
  selectedRules: RuleResult[]
  selectedTakeoff: TakeoffLine[]
  selectedProducts: SupplierProduct[]
}

const editorDataCache = new WeakMap<ProjectDocument, Map<string, EditorDerivedData>>()

export function buildEditorData(project: ProjectDocument, selectedId: string | null): EditorDerivedData {
  const cacheKey = selectedId ?? '__none__'
  let projectCache = editorDataCache.get(project)
  if (!projectCache) {
    projectCache = new Map()
    editorDataCache.set(project, projectCache)
  }
  const cached = projectCache.get(cacheKey)
  if (cached) return cached

  const derived = deriveProject(project)
  const rules = validateProject(project, derived)
  const takeoff = generateTakeoff(project, derived)
  const products = mapTakeoffToHomeDepot(takeoff.lines, project.suppliers.zipCode)
  const selected = project.elements.find((element) => element.id === selectedId) ?? null
  const selectedRules = selectedId ? rules.filter((rule) => rule.elementId === selectedId) : []
  const selectedTakeoff = selectedId ? takeoff.lines.filter((line) => line.sourceElementId === selectedId || line.location === selected?.name) : []
  const materialIds = new Set(selectedTakeoff.map((line) => line.materialId))
  const selectedProducts = products.filter((product) => materialIds.has(product.materialId))

  const data = { derived, rules, takeoff, products, selected, selectedRules, selectedTakeoff, selectedProducts }
  projectCache.set(cacheKey, data)
  return data
}
