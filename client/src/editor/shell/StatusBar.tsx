import { distance2, polygonArea, polygonBounds } from '../../bim/geometry'
import { BuildingElement, ProjectDocument, RuleResult } from '../../bim/types'
import { Icon } from '../ui/Icons'

export function StatusBar({
  estimate,
  project,
  rules,
  selectedId,
  snapFeet,
}: {
  project: ProjectDocument
  selectedId: string | null
  rules: RuleResult[]
  estimate: number
  snapFeet: number
}) {
  const selected = project.elements.find((element) => element.id === selectedId) ?? null
  const hardFlags = rules.filter((result) => result.status === 'fail' || result.status === 'requiresEngineer').length
  const warnings = rules.filter((result) => result.status === 'warning' || result.status === 'requiresAHJ').length
  const stats = selected ? selectedStats(selected) : null

  return (
    <footer className="statusbar">
      <span><strong>Selected:</strong> {selected ? `${selected.name}` : 'none'}</span>
      {selected && <span><strong>ID:</strong> {selected.id}</span>}
      {stats?.length && <span><strong>Length:</strong> {stats.length}</span>}
      {stats?.height && <span><strong>Height:</strong> {stats.height}</span>}
      {stats?.area && <span><strong>Area:</strong> {stats.area}</span>}
      {stats?.location && <span><strong>Location:</strong> {stats.location}</span>}
      <span className={hardFlags ? 'status-bad' : ''}><Icon name={hardFlags ? 'warning' : 'check'} size={14} /> {hardFlags} hard flags</span>
      <span className={warnings ? 'status-warn' : ''}><Icon name={warnings ? 'warning' : 'check'} size={14} /> {warnings} warnings</span>
      <span><strong>Estimate:</strong> {estimate.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
      <span><strong>Snap:</strong> {snapFeet < 1 ? `${Math.round(snapFeet * 12)} in` : `${snapFeet} ft`}</span>
    </footer>
  )
}

function selectedStats(element: BuildingElement) {
  if (element.type === 'wall') {
    const length = Math.sqrt(distance2(element.path[0], element.path[1]))
    const mid = {
      x: (element.path[0].x + element.path[1].x) / 2,
      y: (element.path[0].y + element.path[1].y) / 2,
    }
    return {
      area: `${(length * element.height).toFixed(1)} SF`,
      height: formatFeetInches(element.height),
      length: formatFeetInches(length),
      location: `X ${mid.x.toFixed(1)}, Y ${mid.y.toFixed(1)}, Z 0.0`,
    }
  }
  if (element.type === 'floor') {
    const bounds = polygonBounds(element.polygon)
    return {
      area: `${polygonArea(element.polygon).toFixed(1)} SF`,
      height: `Elev ${formatFeetInches(element.elevation)}`,
      length: `${formatFeetInches(bounds.maxX - bounds.minX)} x ${formatFeetInches(bounds.maxY - bounds.minY)}`,
      location: `X ${bounds.minX.toFixed(1)}, Y ${bounds.minY.toFixed(1)}, Z ${element.elevation.toFixed(1)}`,
    }
  }
  if (element.type === 'roof') {
    const bounds = polygonBounds(element.footprint)
    return {
      area: `${polygonArea(element.footprint).toFixed(1)} SF`,
      height: `${element.pitchRise}:${element.pitchRun} pitch`,
      length: `${formatFeetInches(bounds.maxX - bounds.minX)} x ${formatFeetInches(bounds.maxY - bounds.minY)}`,
      location: `Overhang ${element.overhang} ft`,
    }
  }
  if ('position' in element) {
    const z = 'z' in element.position ? element.position.z : 0
    return { location: `X ${element.position.x.toFixed(1)}, Y ${element.position.y.toFixed(1)}, Z ${z.toFixed(1)}` }
  }
  return null
}

function formatFeetInches(value: number): string {
  const feet = Math.floor(Math.abs(value))
  const inches = Math.round((Math.abs(value) - feet) * 12)
  const sign = value < 0 ? '-' : ''
  if (inches === 12) return `${sign}${feet + 1}'-0"`
  return `${sign}${feet}'-${inches}"`
}
