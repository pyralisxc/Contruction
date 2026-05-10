import React from 'react'

export type AdaptivePanel = 'tools' | 'inspector' | null

export function AppShell({
  activePanel,
  children,
  notice,
  railCollapsed,
  onPanelChange,
}: {
  activePanel: AdaptivePanel
  children: React.ReactNode
  notice?: string | null
  railCollapsed: boolean
  onPanelChange: (panel: AdaptivePanel) => void
}) {
  return (
    <div className={`contractor-app ${railCollapsed ? 'rail-collapsed' : ''} panel-${activePanel ?? 'canvas'}`}>
      {children}
      <nav className="adaptive-panel-bar" aria-label="Workspace panels">
        <button className={activePanel === 'tools' ? 'active' : ''} onClick={() => onPanelChange(activePanel === 'tools' ? null : 'tools')}>
          Tools
        </button>
        <button className={!activePanel ? 'active' : ''} onClick={() => onPanelChange(null)}>
          Canvas
        </button>
        <button className={activePanel === 'inspector' ? 'active' : ''} onClick={() => onPanelChange(activePanel === 'inspector' ? null : 'inspector')}>
          Inspector
        </button>
      </nav>
      {notice && <div className="feature-toast" role="status">{notice}</div>}
    </div>
  )
}
