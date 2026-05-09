import { EditorMode } from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { modeMeta } from '../constants'

const primaryModes: EditorMode[] = ['site', 'structure', 'electrical', 'materials', 'code', 'blueprints']

export function ModeRail({ collapsed, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void }) {
  const mode = useBimProjectStore((state) => state.mode)
  const setMode = useBimProjectStore((state) => state.setMode)
  const activeMode = mode === 'openings' || mode === 'roof' ? 'structure' : mode === 'plumbing' || mode === 'hvac' ? 'electrical' : mode

  return (
    <nav className="mode-rail" aria-label="Design modes">
      {primaryModes.map((item) => (
        <button key={item} className={activeMode === item ? 'active' : ''} onClick={() => setMode(item)} title={modeMeta[item].description}>
          <span aria-hidden>{modeMeta[item].icon}</span>
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button className="collapse-btn" onClick={onToggleCollapse} aria-pressed={collapsed} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '›' : '‹'}
      </button>
    </nav>
  )
}
