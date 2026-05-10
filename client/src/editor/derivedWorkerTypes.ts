import { DerivedModel, ProjectDocument, RuleResult, TakeoffSummary } from '../bim/types'

export type DerivedWorkerRequest =
  | { id: string; type: 'derive'; project: ProjectDocument }
  | { id: string; type: 'validate'; project: ProjectDocument }
  | { id: string; type: 'takeoff'; project: ProjectDocument }
  | { id: string; type: 'editorData'; project: ProjectDocument }

export type DerivedWorkerResponse =
  | { id: string; type: 'derive'; derived: DerivedModel }
  | { id: string; type: 'validate'; rules: RuleResult[] }
  | { id: string; type: 'takeoff'; takeoff: TakeoffSummary }
  | { id: string; type: 'editorData'; derived: DerivedModel; rules: RuleResult[]; takeoff: TakeoffSummary }
  | { id: string; type: 'error'; message: string }
