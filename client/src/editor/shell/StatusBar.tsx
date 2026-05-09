import { RuleResult } from '../../bim/types'

export function StatusBar({
  selectedId,
  rules,
  estimate,
  snapFeet,
}: {
  selectedId: string | null
  rules: RuleResult[]
  estimate: number
  snapFeet: number
}) {
  const hardFlags = rules.filter((result) => result.status === 'fail' || result.status === 'requiresEngineer').length
  const warnings = rules.filter((result) => result.status === 'warning' || result.status === 'requiresAHJ').length

  return (
    <footer className="statusbar">
      <span>Selected: {selectedId ?? 'none'}</span>
      <span>{hardFlags} hard flags</span>
      <span>{warnings} warnings</span>
      <span>Estimate: {estimate.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
      <span>Snap: {snapFeet < 1 ? `${Math.round(snapFeet * 12)} in` : `${snapFeet} ft`}</span>
    </footer>
  )
}

