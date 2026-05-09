import useBimProjectStore from '../../stores/bimProjectStore'
import { ProjectDocument } from '../../bim/types'
import { EditorDerivedData } from '../selectors'
import { Metric } from '../ui/FormControls'
import { FramingViewport } from './FramingViewport'
import { PlanCanvas } from './PlanCanvas'

export function CanvasWorkspace({
  project,
  data,
  onSelect,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  onSelect: (id: string | null) => void
}) {
  const viewMode = useBimProjectStore((state) => state.viewMode)
  const setViewMode = useBimProjectStore((state) => state.setViewMode)
  const modelDisplayMode = useBimProjectStore((state) => state.modelDisplayMode)
  const setModelDisplayMode = useBimProjectStore((state) => state.setModelDisplayMode)
  const selectedId = useBimProjectStore((state) => state.selectedId)
  const viewportPanel = useBimProjectStore((state) => state.viewportPanel)
  const setViewportPanel = useBimProjectStore((state) => state.setViewportPanel)
  const frameCount = data.derived.framing.length
  const pierCount = data.derived.framing.filter((item) => item.subsystem === 'pier').length

  return (
    <main className="canvas-column">
      <div className="canvas-tabs">
        <button className={viewMode !== 'blueprint' && viewMode !== 'takeoff' ? 'active' : ''} onClick={() => setViewMode('framing')}>
          Model
        </button>
        <button className={viewMode === 'blueprint' ? 'active' : ''} onClick={() => setViewMode('blueprint')}>
          Sheets
        </button>
        <button className={viewMode === 'takeoff' ? 'active' : ''} onClick={() => setViewMode('takeoff')}>
          Materials
        </button>
        <span className="canvas-tab-spacer" />
        <button className={viewportPanel === '3d' ? 'active secondary' : 'secondary'} onClick={() => setViewportPanel('3d')}>
          3D
        </button>
        <button className={viewportPanel === 'diagram' ? 'active secondary' : 'secondary'} onClick={() => setViewportPanel('diagram')}>
          Diagram
        </button>
        <button className={viewportPanel === 'hidden' ? 'active secondary' : 'secondary'} onClick={() => setViewportPanel('hidden')}>
          Hide 3D
        </button>
        <span className="viewport-stat">{frameCount} members</span>
        <span className="viewport-stat">{pierCount} piers</span>
        <span className="canvas-tab-spacer" />
        {(['framing', 'architectural', 'painted'] as const).map((mode) => (
          <button key={mode} className={modelDisplayMode === mode ? 'active secondary' : 'secondary'} onClick={() => setModelDisplayMode(mode)}>
            {mode === 'framing' ? 'Frame' : mode === 'architectural' ? 'Arch' : 'Painted'}
          </button>
        ))}
      </div>
      {viewMode === 'blueprint' ? (
        <BlueprintPreview project={project} data={data} />
      ) : viewMode === 'takeoff' ? (
        <TakeoffPreview project={project} data={data} />
      ) : (
        <div className={viewportPanel === 'hidden' ? 'single-canvas' : 'dual-canvas'}>
          <PlanCanvas project={project} data={data} selectedId={selectedId} viewMode={viewMode} onSelect={onSelect} />
          {viewportPanel !== 'hidden' && (
            <div className="three-wrap">
              <FramingViewport project={project} data={data} viewMode={viewMode} selectedId={selectedId} onSelect={onSelect} panelMode={viewportPanel} />
            </div>
          )}
        </div>
      )}
    </main>
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
                    {line.quantity.toFixed(1)} {line.unit}
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
