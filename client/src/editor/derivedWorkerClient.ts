import { deriveProject } from '../bim/geometry'
import { validateProject } from '../bim/rules'
import { mapTakeoffToHomeDepot } from '../bim/suppliers'
import { generateTakeoff } from '../bim/takeoff'
import { ProjectDocument } from '../bim/types'
import { EditorDerivedData } from './selectors'
import { DerivedWorkerRequest, DerivedWorkerResponse } from './derivedWorkerTypes'

let worker: Worker | null = null
let sequence = 0
const pending = new Map<string, { resolve: (value: EditorDerivedData) => void; reject: (reason?: unknown) => void; zipCode: string }>()

export function buildEditorDataAsync(project: ProjectDocument): Promise<EditorDerivedData> {
  if (typeof Worker === 'undefined') return Promise.resolve(buildEditorDataFallback(project))
  if (!worker) {
    worker = new Worker(new URL('./derivedModel.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<DerivedWorkerResponse>) => {
      const response = event.data
      const request = pending.get(response.id)
      if (!request) return
      pending.delete(response.id)
      if (response.type === 'error') {
        request.reject(new Error(response.message))
        return
      }
      if (response.type === 'editorData') {
        request.resolve({
          derived: response.derived,
          rules: response.rules,
          takeoff: response.takeoff,
          products: mapTakeoffToHomeDepot(response.takeoff.lines, request.zipCode),
          selected: null,
          selectedRules: [],
          selectedTakeoff: [],
          selectedProducts: [],
        })
      }
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Derived BIM worker failed.')
      for (const request of pending.values()) request.reject(error)
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  const id = `derived-${sequence += 1}`
  const request: DerivedWorkerRequest = { id, type: 'editorData', project }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, zipCode: project.suppliers.zipCode })
    worker?.postMessage(request)
  })
}

function buildEditorDataFallback(project: ProjectDocument): EditorDerivedData {
  const derived = deriveProject(project)
  const rules = validateProject(project, derived)
  const takeoff = generateTakeoff(project, derived)
  return { derived, rules, takeoff, products: mapTakeoffToHomeDepot(takeoff.lines, project.suppliers.zipCode), selected: null, selectedRules: [], selectedTakeoff: [], selectedProducts: [] }
}
