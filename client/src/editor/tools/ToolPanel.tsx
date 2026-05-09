import type React from 'react'
import { EditorMode, ProjectDocument, TerrainPoint } from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { modeMeta } from '../constants'
import { EditorDerivedData } from '../selectors'
import { EditorToolId, LayerId } from '../types'
import { NumberField, SelectField, Metric } from '../ui/FormControls'

export function ToolPanel({
  project,
  data,
  onSelectViolation,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  onSelectViolation: (id: string | undefined) => void
}) {
  const mode = useBimProjectStore((state) => state.mode)

  return (
    <aside className="tool-panel">
      <div className="panel-section tool-title">
        <h2>{modeMeta[mode].label}</h2>
        <p>{modeMeta[mode].description}</p>
      </div>
      <ModeTools mode={mode} project={project} data={data} onSelectViolation={onSelectViolation} />
      <ProjectOutliner project={project} data={data} />
    </aside>
  )
}

function ModeTools({
  mode,
  project,
  data,
  onSelectViolation,
}: {
  mode: EditorMode
  project: ProjectDocument
  data: EditorDerivedData
  onSelectViolation: (id: string | undefined) => void
}) {
  if (mode === 'site') return <SiteTools project={project} />
  if (mode === 'structure') return <StructureTools project={project} data={data} />
  if (mode === 'openings') return <OpeningTools project={project} />
  if (mode === 'roof') return <RoofTools project={project} />
  if (mode === 'electrical') return <SystemsTools project={project} />
  if (mode === 'plumbing') return <PlumbingTools project={project} />
  if (mode === 'hvac') return <HvacTools project={project} />
  if (mode === 'materials') return <MaterialTools project={project} data={data} />
  if (mode === 'code') return <CodeTools data={data} onSelectViolation={onSelectViolation} />
  return <BlueprintTools project={project} data={data} />
}

function SiteTools({ project }: { project: ProjectDocument }) {
  const updateTerrain = useBimProjectStore((state) => state.updateTerrain)
  const updateTerrainPoint = useBimProjectStore((state) => state.updateTerrainPoint)
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const terrain = project.site.terrain
  const plane = terrain.plane ?? { origin: { x: 0, y: 0 }, slopeX: 0, slopeY: 0 }

  return (
    <>
      <div className="panel-section">
        <h3>Terrain Model</h3>
        <ToolButton toolId="select" onClick={() => setActiveTool('select')}>Select / edit</ToolButton>
        <SelectField
          label="Terrain type"
          value={terrain.type}
          options={[
            { value: 'flat', label: 'Flat pad' },
            { value: 'slopedPlane', label: 'Sloped plane' },
            { value: 'tin', label: 'Height points / TIN' },
          ]}
          onChange={(type) => updateTerrain({ type })}
        />
        <NumberField label="Base elevation (ft)" value={terrain.baseElevation} onChange={(baseElevation) => updateTerrain({ baseElevation })} />
        <NumberField label="Slope X (ft/ft)" value={plane.slopeX} step={0.005} onChange={(slopeX) => updateTerrain({ type: 'slopedPlane', plane: { ...plane, slopeX } })} />
        <NumberField label="Slope Y (ft/ft)" value={plane.slopeY} step={0.005} onChange={(slopeY) => updateTerrain({ type: 'slopedPlane', plane: { ...plane, slopeY } })} />
        <ToolButton toolId="addTerrainPoint" onClick={() => setActiveTool('addTerrainPoint')}>
          Place height point
        </ToolButton>
      </div>
      <div className="panel-section">
        <h3>Height Points</h3>
        <div className="row-list">
          {terrain.points.map((point) => (
            <TerrainPointRow key={point.id} point={point} onChange={(updates) => updateTerrainPoint(point.id, updates)} />
          ))}
        </div>
      </div>
    </>
  )
}

function TerrainPointRow({ point, onChange }: { point: TerrainPoint; onChange: (updates: Partial<TerrainPoint>) => void }) {
  return (
    <div className="mini-row three-col">
      <input aria-label="Terrain point x" value={point.x} type="number" onChange={(event) => onChange({ x: Number(event.target.value) })} />
      <input aria-label="Terrain point y" value={point.y} type="number" onChange={(event) => onChange({ y: Number(event.target.value) })} />
      <input aria-label="Terrain point elevation" value={point.z} type="number" step="0.1" onChange={(event) => onChange({ z: Number(event.target.value) })} />
    </div>
  )
}

function StructureTools({ project, data }: { project: ProjectDocument; data: EditorDerivedData }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const addDeck = useBimProjectStore((state) => state.addDeck)
  const addHalfWall = useBimProjectStore((state) => state.addHalfWall)
  const addStair = useBimProjectStore((state) => state.addStair)
  const addAccessory = useBimProjectStore((state) => state.addAccessory)
  const createRoofFromSelection = useBimProjectStore((state) => state.createRoofFromSelection)
  const createFloorFromWallBounds = useBimProjectStore((state) => state.createFloorFromWallBounds)
  const createSpacesFromWallLoops = useBimProjectStore((state) => state.createSpacesFromWallLoops)
  const cleanWallConnections = useBimProjectStore((state) => state.cleanWallConnections)
  const floors = project.elements.filter((element) => element.type === 'floor').length
  const walls = project.elements.filter((element) => element.type === 'wall').length
  const piers = data.derived.framing.filter((member) => member.subsystem === 'pier').length

  return (
    <>
      <div className="panel-section">
        <h3>Build Tools</h3>
        <div className="tool-command-row">
          <ToolButton toolId="select" onClick={() => setActiveTool('select')}>Select</ToolButton>
          <ToolButton toolId="drawFloor" onClick={() => setActiveTool('drawFloor')}>Floor</ToolButton>
          <ToolButton toolId="drawWall" onClick={() => setActiveTool('drawWall')}>Wall</ToolButton>
          <ToolButton toolId="placeOpening" onClick={() => setActiveTool('placeOpening')}>Opening</ToolButton>
          <ToolButton toolId="drawRoof" onClick={() => setActiveTool('drawRoof')}>Roof</ToolButton>
        </div>
        <details className="tool-group" open>
          <summary>Floor, Deck, Foundation</summary>
          <div className="button-stack">
            <ToolButton toolId="drawFloor" onClick={() => setActiveTool('drawFloor')}>Draw raised floor</ToolButton>
            <button onClick={createFloorFromWallBounds}>Floor from wall envelope</button>
            <button onClick={addDeck}>Add deck platform</button>
            <button onClick={() => addAccessory('column')}>Add post/column</button>
            <button onClick={() => addAccessory('landing')}>Add landing</button>
          </div>
        </details>
        <details className="tool-group" open>
          <summary>Walls and Openings</summary>
          <div className="button-stack">
            <ToolButton toolId="drawWall" onClick={() => setActiveTool('drawWall')}>Draw wall segment</ToolButton>
            <button onClick={addHalfWall}>Add half wall</button>
            <button onClick={cleanWallConnections}>Clean wall connections</button>
            <button onClick={createSpacesFromWallLoops}>Detect rooms from loops</button>
            <ToolButton toolId="placeOpening" onClick={() => setActiveTool('placeOpening')}>Place door/window</ToolButton>
            <button onClick={() => addAccessory('guardRail')}>Add guard/rail</button>
          </div>
        </details>
        <details className="tool-group" open>
          <summary>Roof and Access</summary>
          <div className="button-stack">
            <ToolButton toolId="drawRoof" onClick={() => setActiveTool('drawRoof')}>Draw roof footprint</ToolButton>
            <button onClick={createRoofFromSelection}>Roof from selected envelope</button>
            <button onClick={addStair}>Add access stairs</button>
          </div>
        </details>
      </div>
      <div className="panel-section metric-grid">
        <Metric label="Floors" value={String(floors)} />
        <Metric label="Walls" value={String(walls)} />
        <Metric label="Derived piers" value={String(piers)} />
      </div>
      <OpeningTools project={project} />
      <RoofTools project={project} />
    </>
  )
}

function OpeningTools({ project }: { project: ProjectDocument }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const walls = project.elements.filter((element) => element.type === 'wall')
  const openings = project.elements.filter((element) => element.type === 'opening')
  return (
    <div className="panel-section">
      <h3>Openings</h3>
      <div className="button-stack">
        <ToolButton toolId="placeOpening" onClick={() => setActiveTool('placeOpening')}>
          Place door/window on wall
        </ToolButton>
      </div>
      <p>{openings.length} openings currently in the model across {walls.length} walls.</p>
    </div>
  )
}

function RoofTools({ project }: { project: ProjectDocument }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const roofs = project.elements.filter((element) => element.type === 'roof')
  return (
    <div className="panel-section">
      <h3>Roof Systems</h3>
      <ToolButton toolId="drawRoof" onClick={() => setActiveTool('drawRoof')}>Draw roof footprint</ToolButton>
      <div className="row-list">
        {roofs.map((roof) => (
          <button key={roof.id} className="row-button" onClick={() => useBimProjectStore.getState().selectElement(roof.id)}>
            {roof.name}
            <span>{roof.pitchRise}:{roof.pitchRun} pitch</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SystemsTools({ project }: { project: ProjectDocument }) {
  return (
    <>
      <ElectricalTools project={project} />
      <PlumbingTools project={project} />
      <HvacTools project={project} />
    </>
  )
}

function ElectricalTools({ project }: { project: ProjectDocument }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const addCircuit = useBimProjectStore((state) => state.addCircuit)
  const devices = project.elements.filter((element) => element.type === 'electricalDevice').length
  const circuits = project.elements.filter((element) => element.type === 'circuit').length
  return (
    <div className="panel-section">
      <h3>Electrical</h3>
      <div className="button-stack">
        <ToolButton toolId="select" onClick={() => setActiveTool('select')}>Select / edit</ToolButton>
        <button onClick={addCircuit}>Add circuit</button>
        <ToolButton toolId="placeElectricalDevice" onClick={() => setActiveTool('placeElectricalDevice')}>Place device</ToolButton>
      </div>
      <Metric label="Devices" value={String(devices)} />
      <Metric label="Circuits" value={String(circuits)} />
    </div>
  )
}

function PlumbingTools({ project }: { project: ProjectDocument }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const fixtures = project.elements.filter((element) => element.type === 'plumbingFixture').length
  const pipes = project.elements.filter((element) => element.type === 'pipe').length
  return (
    <div className="panel-section">
      <h3>Plumbing</h3>
      <div className="button-stack">
        <ToolButton toolId="select" onClick={() => setActiveTool('select')}>Select / edit</ToolButton>
        <ToolButton toolId="placePlumbingFixture" onClick={() => setActiveTool('placePlumbingFixture')}>Place fixture</ToolButton>
        <ToolButton toolId="drawPipe" onClick={() => setActiveTool('drawPipe')}>Draw pipe run</ToolButton>
      </div>
      <Metric label="Fixtures" value={String(fixtures)} />
      <Metric label="Pipe runs" value={String(pipes)} />
    </div>
  )
}

function HvacTools({ project }: { project: ProjectDocument }) {
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const ducts = project.elements.filter((element) => element.type === 'duct').length
  return (
    <div className="panel-section">
      <h3>HVAC</h3>
      <div className="button-stack">
        <ToolButton toolId="select" onClick={() => setActiveTool('select')}>Select / edit</ToolButton>
        <ToolButton toolId="drawDuct" onClick={() => setActiveTool('drawDuct')}>Draw duct run</ToolButton>
      </div>
      <p>Mini-split and ventilation rules are staged here for the next engineering pass.</p>
      <Metric label="Duct runs" value={String(ducts)} />
    </div>
  )
}

function MaterialTools({ data }: { project: ProjectDocument; data: EditorDerivedData }) {
  return (
    <>
      <div className="panel-section metric-grid">
        <Metric label="Takeoff lines" value={String(data.takeoff.lines.length)} />
        <Metric label="Estimate" value={data.takeoff.estimatedCost.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
        <Metric label="Home Depot matches" value={String(data.products.length)} />
      </div>
      <div className="panel-section">
        <h3>By Subsystem</h3>
        <div className="row-list">
          {Object.entries(data.takeoff.totalsBySubsystem).map(([key, value]) => (
            <div className="data-row" key={key}>
              <span>{key}</span>
              <strong>{value.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function CodeTools({ data, onSelectViolation }: { data: EditorDerivedData; onSelectViolation: (id: string | undefined) => void }) {
  const visible = data.rules.filter((rule) => rule.status !== 'pass')
  return (
    <>
      <div className="panel-section risk-strip">
        <Metric label="Hard flags" value={String(visible.filter((rule) => rule.status === 'fail' || rule.status === 'requiresEngineer').length)} tone="bad" />
        <Metric label="Warnings" value={String(visible.filter((rule) => rule.status === 'warning' || rule.status === 'requiresAHJ').length)} tone="warn" />
      </div>
      <div className="panel-section">
        <h3>Review Feed</h3>
        <div className="issue-list">
          {visible.map((rule) => (
            <button key={rule.id} onClick={() => onSelectViolation(rule.elementId)}>
              <strong>{rule.title}</strong>
              <span>{rule.message}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function BlueprintTools({ data }: { project: ProjectDocument; data: EditorDerivedData }) {
  return (
    <div className="panel-section">
      <h3>Sheets</h3>
      <ul className="plain-list">
        <li>Site and terrain plan</li>
        <li>Raised floor framing plan</li>
        <li>Wall and opening schedule</li>
        <li>Roof framing plan</li>
        <li>MEP coordination plan</li>
        <li>Material and supplier schedule</li>
      </ul>
      <Metric label="Queued schedule rows" value={String(data.takeoff.lines.length)} />
    </div>
  )
}

function ToolButton({ toolId, onClick, children }: { toolId: EditorToolId; onClick: () => void; children: React.ReactNode }) {
  const activeTool = useBimProjectStore((state) => state.activeTool)
  const toolSession = useBimProjectStore((state) => state.toolSession)
  return (
    <button className={activeTool === toolId ? 'tool-button active' : 'tool-button'} onClick={onClick}>
      <span>{children}</span>
      {activeTool === toolId && <small>{toolSession ? 'In progress' : 'Ready on canvas'}</small>}
    </button>
  )
}

function ProjectOutliner({ project, data }: { project: ProjectDocument; data: EditorDerivedData }) {
  const selectedId = useBimProjectStore((state) => state.selectedId)
  const selectElement = useBimProjectStore((state) => state.selectElement)
  const visibleLayers = useBimProjectStore((state) => state.visibleLayers)
  const setLayerVisible = useBimProjectStore((state) => state.setLayerVisible)
  const setLayerPreset = useBimProjectStore((state) => state.setLayerPreset)
  const layerLabels: Record<LayerId, string> = {
    terrain: 'Terrain',
    foundation: 'Foundation',
    floors: 'Floors',
    floorFraming: 'Floor frame',
    wallFraming: 'Wall frame',
    roofFraming: 'Roof frame',
    walls: 'Walls',
    openings: 'Openings',
    framing: 'Framing',
    roof: 'Roof',
    sheathing: 'Sheathing',
    siding: 'Siding',
    roofing: 'Roofing',
    flooring: 'Flooring',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    hvac: 'HVAC',
    dimensions: 'Dimensions',
    warnings: 'Warnings',
  }
  const grouped = [
    { label: 'Structure', items: project.elements.filter((element) => element.type === 'floor' || element.type === 'wall' || element.type === 'roof' || element.type === 'stair' || element.type === 'houseAccessory') },
    { label: 'Openings', items: project.elements.filter((element) => element.type === 'opening') },
    { label: 'MEP', items: project.elements.filter((element) => element.type === 'electricalDevice' || element.type === 'circuit' || element.type === 'plumbingFixture' || element.type === 'pipe' || element.type === 'duct') },
  ]

  return (
    <>
      <div className="panel-section">
        <h3>Project Browser</h3>
        <div className="outliner">
          {grouped.map((group) => (
            <details key={group.label} open>
              <summary>{group.label} <span>{group.items.length}</span></summary>
              {group.items.map((element) => (
                <button key={element.id} className={selectedId === element.id ? 'outliner-row active' : 'outliner-row'} onClick={() => selectElement(element.id)}>
                  <span>{element.name}</span>
                  <small>{element.type}</small>
                </button>
              ))}
            </details>
          ))}
        </div>
      </div>
      <div className="panel-section">
        <h3>Layers</h3>
        <div className="layer-preset-row">
          <button onClick={() => setLayerPreset('all')}>All</button>
          <button onClick={() => setLayerPreset('framingOnly')}>Frame</button>
          <button onClick={() => setLayerPreset('foundationOnly')}>Piers</button>
          <button onClick={() => setLayerPreset('floorFrame')}>Floor</button>
          <button onClick={() => setLayerPreset('wallFrame')}>Walls</button>
          <button onClick={() => setLayerPreset('roofFrame')}>Roof</button>
          <button onClick={() => setLayerPreset('systemsOnly')}>MEP</button>
          <button onClick={() => setLayerPreset('finishedOnly')}>Finish</button>
        </div>
        <div className="layer-grid">
          {(Object.keys(layerLabels) as LayerId[]).map((layer) => (
            <label key={layer}>
              <input type="checkbox" checked={visibleLayers[layer]} onChange={(event) => setLayerVisible(layer, event.target.checked)} />
              <span>{layerLabels[layer]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="panel-section compact-issues">
        <h3>Actionable Flags</h3>
        {data.rules.filter((rule) => rule.status !== 'pass').slice(0, 5).map((rule) => (
          <button key={rule.id} onClick={() => rule.elementId && selectElement(rule.elementId)}>
            <strong>{rule.title}</strong>
            <span>{rule.status}</span>
          </button>
        ))}
      </div>
    </>
  )
}
