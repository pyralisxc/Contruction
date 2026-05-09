import { ProjectDocument, ViewMode } from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { viewMeta } from '../constants'

export function TopBar({
  project,
  onSave,
  onLoad,
  onExportCsv,
  onBlueprint,
}: {
  project: ProjectDocument
  onSave: () => void
  onLoad: (file: File) => void
  onExportCsv: () => void
  onBlueprint: () => void
}) {
  const viewMode = useBimProjectStore((state) => state.viewMode)
  const setViewMode = useBimProjectStore((state) => state.setViewMode)
  const undo = useBimProjectStore((state) => state.undo)
  const redo = useBimProjectStore((state) => state.redo)
  const past = useBimProjectStore((state) => state.past)
  const future = useBimProjectStore((state) => state.future)
  const activeLevelId = useBimProjectStore((state) => state.activeLevelId)
  const setActiveLevel = useBimProjectStore((state) => state.setActiveLevel)
  const snapFeet = useBimProjectStore((state) => state.snapFeet)
  const setSnapFeet = useBimProjectStore((state) => state.setSnapFeet)

  return (
    <header className="topbar">
      <div className="brand-block">
        <strong>Contractor Hub</strong>
        <span>{project.name}</span>
      </div>

      <div className="toolbar-group view-mode-group" aria-label="View mode">
        {(Object.keys(viewMeta) as ViewMode[]).map((mode) => (
          <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}>
            {viewMeta[mode].label}
          </button>
        ))}
      </div>

      <div className="toolbar-group compact-controls">
        <label>
          Level
          <select value={activeLevelId} onChange={(event) => setActiveLevel(event.target.value)}>
            {project.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Snap
          <select value={snapFeet} onChange={(event) => setSnapFeet(Number(event.target.value))}>
            <option value={0.25}>3 in</option>
            <option value={0.5}>6 in</option>
            <option value={1}>1 ft</option>
            <option value={2}>2 ft</option>
          </select>
        </label>
      </div>

      <div className="command-row">
        <button onClick={undo} disabled={past.length === 0} title="Undo">
          Undo
        </button>
        <button onClick={redo} disabled={future.length === 0} title="Redo">
          Redo
        </button>
        <label className="file-button">
          Load
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onLoad(file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <button onClick={onSave}>Save JSON</button>
        <button onClick={onExportCsv}>BOM CSV</button>
        <button className="primary-command" onClick={onBlueprint}>
          Blueprint
        </button>
      </div>
    </header>
  )
}

