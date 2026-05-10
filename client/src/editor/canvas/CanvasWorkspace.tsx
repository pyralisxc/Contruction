import type React from 'react'
import useBimProjectStore from '../../stores/bimProjectStore'
import { ProjectDocument } from '../../bim/types'
import { EditorDerivedData } from '../selectors'
import { Metric } from '../ui/FormControls'
import { Icon } from '../ui/Icons'
import { FramingViewport } from './FramingViewport'
import { PlanCanvas } from './PlanCanvas'

export function CanvasWorkspace({
  project,
  data,
  onNewProject,
  onSelect,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  onNewProject: () => void
  onSelect: (id: string | null) => void
}) {
  const viewMode = useBimProjectStore((state) => state.viewMode)
  const workspaceMode = useBimProjectStore((state) => state.workspaceMode)
  const setWorkspaceMode = useBimProjectStore((state) => state.setWorkspaceMode)
  const modelDisplayMode = useBimProjectStore((state) => state.modelDisplayMode)
  const setModelDisplayMode = useBimProjectStore((state) => state.setModelDisplayMode)
  const selectedId = useBimProjectStore((state) => state.selectedId)
  const viewportPanel = useBimProjectStore((state) => state.viewportPanel)
  const setViewportPanel = useBimProjectStore((state) => state.setViewportPanel)
  const frameCount = data.derived.framing.length
  const pierCount = data.derived.framing.filter((item) => item.subsystem === 'pier').length

  return (
    <main className="canvas-column">
      <CanvasDocumentTabs projectName={project.name} workspaceMode={workspaceMode} onNewProject={onNewProject} onModeChange={setWorkspaceMode} />
      {workspaceMode === 'sheets' ? (
        <BlueprintPreview project={project} data={data} />
      ) : workspaceMode === 'materials' ? (
        <TakeoffPreview project={project} data={data} />
      ) : (
        <div className={`viewer-stack viewer-${workspaceMode}`}>
          {workspaceMode !== 'framing3d' && (
            <section className="viewer-panel plan-panel">
              <CanvasPanelHeader title={workspaceMode === 'code' ? '2D Code Plan' : '2D Plan'}>
                <span className="viewport-stat">{frameCount} members</span>
                <span className="viewport-stat compact-hint">Compact: 2D | 3D | Split</span>
              </CanvasPanelHeader>
              <PlanCanvas project={project} data={data} selectedId={selectedId} viewMode={workspaceMode === 'code' ? 'code' : viewMode} onSelect={onSelect} />
            </section>
          )}
          {workspaceMode !== 'plan2d' && (
            <section className="viewer-panel three-panel">
              <CanvasPanelHeader title={viewportPanel === 'diagram' ? 'Framing Diagram' : '3D Framing'}>
                <div className="panel-control-group">
                  <button className={viewportPanel === '3d' ? 'active secondary' : 'secondary'} onClick={() => setViewportPanel('3d')}><Icon name="cube" /> 3D</button>
                  <button className={viewportPanel === 'diagram' ? 'active secondary' : 'secondary'} onClick={() => setViewportPanel('diagram')}><Icon name="activity" /> Diagram</button>
                </div>
                <span className="viewport-stat">{pierCount} piers</span>
                <div className="panel-control-group">
                  {(['framing', 'architectural', 'painted'] as const).map((mode) => (
                    <button key={mode} className={modelDisplayMode === mode ? 'active secondary' : 'secondary'} onClick={() => setModelDisplayMode(mode)}>
                      {mode === 'framing' ? 'Frame' : mode === 'architectural' ? 'Arch' : 'Paint'}
                    </button>
                  ))}
                </div>
              </CanvasPanelHeader>
              <div className="three-wrap">
                <FramingViewport project={project} data={data} viewMode={workspaceMode === 'code' ? 'code' : viewMode} selectedId={selectedId} onSelect={onSelect} panelMode={viewportPanel === 'hidden' ? '3d' : viewportPanel} />
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

function CanvasDocumentTabs({
  projectName,
  workspaceMode,
  onNewProject,
  onModeChange,
}: {
  projectName: string
  workspaceMode: ReturnType<typeof useBimProjectStore.getState>['workspaceMode']
  onNewProject: () => void
  onModeChange: ReturnType<typeof useBimProjectStore.getState>['setWorkspaceMode']
}) {
  return (
    <div className="canvas-tabs document-tabs">
      <button className={workspaceMode !== 'sheets' && workspaceMode !== 'materials' ? 'active' : ''} onClick={() => onModeChange('split')} title={projectName}>{projectName}</button>
      <button className="add-tab" onClick={onNewProject} aria-label="Add project tab">+</button>
    </div>
  )
}

function CanvasPanelHeader({ children, title }: { children?: React.ReactNode; title: string }) {
  return (
    <div className="canvas-panel-header">
      <strong>{title}</strong>
      <div className="canvas-panel-actions">{children}</div>
    </div>
  )
}

function BlueprintPreview({ project, data }: { project: ProjectDocument; data: EditorDerivedData }) {
  return (
    <section className="sheet-preview">
      <div className="sheet-page">
        <h1>{project.name}</h1>
        <p>Generic IRC permit-supporting concept set</p>
        <div className="sheet-grid">
          <Metric label="Elements" value={String(project.elements.length)} />
          <Metric label="Rule flags" value={String(data.rules.filter((rule) => rule.status !== 'pass').length)} />
          <Metric label="Material estimate" value={data.takeoff.estimatedCost.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
        </div>
        <h2>Sheets queued for export</h2>
        <ol>
          <li>Site and terrain plan with height points</li>
          <li>Raised floor framing plan with pier schedule</li>
          <li>Wall/opening rough framing plan</li>
          <li>Roof framing and roofing schedule</li>
          <li>Electrical, plumbing, and HVAC coordination plan</li>
          <li>Material takeoff and supplier schedule</li>
        </ol>
      </div>
    </section>
  )
}

function TakeoffPreview({ data }: { project: ProjectDocument; data: EditorDerivedData }) {
  const selectElement = useBimProjectStore((state) => state.selectElement)
  return (
    <section className="takeoff-preview">
      <div className="takeoff-grid">
        <div>
          <h2>Organized Material List</h2>
          <table>
            <thead>
              <tr>
                <th>Subsystem</th>
                <th>Location</th>
                <th>Description</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {data.takeoff.lines.map((line) => (
                <tr key={line.id} onClick={() => selectElement(line.sourceElementId)} className="selectable-row">
                  <td>{line.subsystem}</td>
                  <td>{line.location}</td>
                  <td>{line.description}</td>
                  <td>
                    {(line.purchaseQuantity ?? line.quantity).toFixed(1)} {line.purchaseUnit ?? line.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Home Depot First Matches</h2>
          <div className="sku-list">
            {data.products.map((product) => (
              <a key={product.sku} href={product.productUrl} target="_blank" rel="noreferrer">
                <strong>{product.title}</strong>
                <span>
                  SKU {product.sku} - {product.availableQty} available - ${product.unitPrice.toFixed(2)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
