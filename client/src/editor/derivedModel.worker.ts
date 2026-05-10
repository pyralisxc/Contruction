import { deriveProject } from '../bim/geometry'
import { validateProject } from '../bim/rules'
import { generateTakeoff } from '../bim/takeoff'
import { DerivedWorkerRequest, DerivedWorkerResponse } from './derivedWorkerTypes'

self.onmessage = (event: MessageEvent<DerivedWorkerRequest>) => {
  const request = event.data
  try {
    const derived = deriveProject(request.project)
    const response: DerivedWorkerResponse = request.type === 'derive'
      ? { id: request.id, type: 'derive', derived }
      : request.type === 'validate'
        ? { id: request.id, type: 'validate', rules: validateProject(request.project, derived) }
        : request.type === 'takeoff'
          ? { id: request.id, type: 'takeoff', takeoff: generateTakeoff(request.project, derived) }
          : { id: request.id, type: 'editorData', derived, rules: validateProject(request.project, derived), takeoff: generateTakeoff(request.project, derived) }
    self.postMessage(response)
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Could not build derived BIM data.',
    } satisfies DerivedWorkerResponse)
  }
}
