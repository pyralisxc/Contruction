import { EditorMode } from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { modeMeta } from '../constants'
import { Icon } from '../ui/Icons'

type RailItem =
  | { id: EditorMode; label: string; icon: Parameters<typeof Icon>[0]['name']; kind: 'mode' }
  | { id: 'settings'; label: string; icon: Parameters<typeof Icon>[0]['name']; kind: 'stub' }

const primaryModes: RailItem[] = [
  { id: 'site', label: 'Site', icon: 'home', kind: 'mode' },
  { id: 'structure', label: 'Build', icon: 'wall', kind: 'mode' },
  { id: 'electrical', label: 'Systems', icon: 'activity', kind: 'mode' },
  { id: 'materials', label: 'Materials', icon: 'cart', kind: 'mode' },
  { id: 'code', label: 'Code', icon: 'code', kind: 'mode' },
  { id: 'blueprints', label: 'Blueprints', icon: 'copy', kind: 'mode' },
  { id: 'settings', label: 'Settings', icon: 'settings', kind: 'stub' },
]

export function ModeRail({
  collapsed,
  onFeatureStub,
  onToggleCollapse,
}: {
  collapsed?: boolean
  onFeatureStub: (label: string) => void
  onToggleCollapse?: () => void
}) {
  const mode = useBimProjectStore((state) => state.mode)
  const setMode = useBimProjectStore((state) => state.setMode)
  const activeMode = mode === 'openings' || mode === 'roof' ? 'structure' : mode === 'plumbing' || mode === 'hvac' ? 'electrical' : mode

  return (
    <nav className="mode-rail" aria-label="Design modes">
      {primaryModes.map((item) => (
        <button
          key={item.id}
          className={item.kind === 'mode' && activeMode === item.id ? 'active' : ''}
          onClick={() => item.kind === 'mode' ? setMode(item.id) : onFeatureStub(item.label)}
          title={item.kind === 'mode' ? modeMeta[item.id].description : 'To be developed'}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button className="collapse-btn" onClick={onToggleCollapse} aria-pressed={collapsed} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '>' : '<'}
      </button>
    </nav>
  )
}
