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

export function buildEditorData(project: ProjectDocument, selectedId: string | null): EditorDerivedData {
  // Lightweight memoization: cache derived model per project object reference
  // Avoids expensive recomputation when the same project object is reused across renders
  // Use WeakMap so entries don't prevent GC
  ;(buildEditorData as any)._derivedCache = (buildEditorData as any)._derivedCache || new WeakMap<ProjectDocument, ReturnType<typeof deriveProject>>()
  const _cache: WeakMap<ProjectDocument, ReturnType<typeof deriveProject>> = (buildEditorData as any)._derivedCache

  let derived = _cache.get(project)
  if (!derived) {
    derived = deriveProject(project)
    _cache.set(project, derived)
  }

  const rules = validateProject(project, derived)
  const takeoff = generateTakeoff(project, derived)
  const products = mapTakeoffToHomeDepot(takeoff.lines, project.suppliers.zipCode)
  const selected = project.elements.find((element) => element.id === selectedId) ?? null
  const selectedRules = selectedId ? rules.filter((rule) => rule.elementId === selectedId) : []
  const selectedTakeoff = selectedId ? takeoff.lines.filter((line) => line.sourceElementId === selectedId || line.location === selected?.name) : []
  const materialIds = new Set(selectedTakeoff.map((line) => line.materialId))
  const selectedProducts = products.filter((product) => materialIds.has(product.materialId))

  return { derived, rules, takeoff, products, selected, selectedRules, selectedTakeoff, selectedProducts }
}

