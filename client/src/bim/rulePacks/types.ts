import { DerivedModel, ProjectDocument, RuleResult } from '../types'

export interface RulePack {
  id: string
  title: string
  description?: string
  validate: (project: ProjectDocument, derived: DerivedModel) => RuleResult[]
}

export default RulePack
