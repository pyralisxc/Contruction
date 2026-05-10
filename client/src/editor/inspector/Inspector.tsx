import React from 'react'
import { calculateAssemblyThickness, normalizeAssembly } from '../../bim/assembly'
import { distance2, polygonArea, polygonBounds } from '../../bim/geometry'
import { fetchSiteIntelligence, type SiteIntelligenceResponse } from '../../bim/siteIntelligence'
import { floorStylePresets, wallStylePresets } from '../../bim/styleCatalogs'
import {
  BuildingElement,
  CircuitElement,
  DuctElement,
  ElectricalDeviceElement,
  FloorElement,
  HouseAccessoryElement,
  OpeningElement,
  PipeElement,
  PlumbingFixtureElement,
  ProjectDocument,
  RoofElement,
  StairElement,
  WallElement,
} from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { EditorDerivedData } from '../selectors'
import { Metric, NumberField, SelectField, TextField, ToggleField } from '../ui/FormControls'

type InspectorTab = 'properties' | 'assembly' | 'derived' | 'materials' | 'code'

export function Inspector({
  project,
  data,
  onReviewFloorUpdates,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  onReviewFloorUpdates: (floorId: string) => void
}) {
  const [tab, setTab] = React.useState<InspectorTab>('properties')
  const selected = data.selected

  React.useEffect(() => {
    setTab('properties')
  }, [selected?.id])

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div>
          <h2>Properties</h2>
          <p>{selected ? `${selected.type} - ${selected.id}` : 'No element selected'}</p>
        </div>
      </div>
      <div className="inspector-tabs">
        {(['properties', 'assembly', 'derived', 'materials', 'code'] as InspectorTab[]).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {!selected ? <EmptyInspector data={data} project={project} /> : <InspectorTabBody tab={tab} selected={selected} project={project} data={data} onReviewFloorUpdates={onReviewFloorUpdates} />}
    </aside>
  )
}

function EmptyInspector({ data, project }: { data: EditorDerivedData; project: ProjectDocument }) {
  return (
    <div className="inspector-content">
      <p>Select a floor, wall, roof, opening, fixture, circuit, pipe, or duct to edit dimensions, assemblies, materials, and code context.</p>
      <Metric label="Estimated material cost" value={data.takeoff.estimatedCost.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
      <Metric label="Takeoff lines" value={String(data.takeoff.lines.length)} />
      <Metric label="Home Depot matches" value={String(data.products.length)} />
      <Metric label="Open warnings" value={String(data.rules.filter((rule) => rule.status !== 'pass').length)} tone="warn" />
      <SiteIntelligencePanel project={project} />
    </div>
  )
}

function SiteIntelligencePanel({ project }: { project: ProjectDocument }) {
  const [latitude, setLatitude] = React.useState('21.3069')
  const [longitude, setLongitude] = React.useState('-157.8583')
  const [state, setState] = React.useState('HI')
  const [county, setCounty] = React.useState('Honolulu')
  const [result, setResult] = React.useState<SiteIntelligenceResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function runLookup() {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchSiteIntelligence({
        latitude: Number(latitude),
        longitude: Number(longitude),
        state,
        county,
        zipCode: project.suppliers.zipCode,
      })
      setResult(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Site intelligence lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="site-intelligence-panel">
      <h3>Site Intelligence</h3>
      <p className="muted">Open-data lookup for terrain, weather grid, climate zone, and keyed code/hazard provider readiness.</p>
      <div className="site-intel-grid">
        <label>
          <span>Lat</span>
          <input value={latitude} inputMode="decimal" onChange={(event) => setLatitude(event.target.value)} />
        </label>
        <label>
          <span>Lon</span>
          <input value={longitude} inputMode="decimal" onChange={(event) => setLongitude(event.target.value)} />
        </label>
        <label>
          <span>State</span>
          <input value={state} onChange={(event) => setState(event.target.value.toUpperCase())} />
        </label>
        <label>
          <span>County</span>
          <input value={county} onChange={(event) => setCounty(event.target.value)} />
        </label>
      </div>
      <button onClick={runLookup} disabled={loading}>{loading ? 'Looking up...' : 'Lookup site data'}</button>
      {error && <p className="site-intel-error">{error}</p>}
      {result && (
        <>
          <Metric label="Elevation" value={result.elevation.elevation === null ? 'Needs survey' : `${result.elevation.elevation.toFixed(1)} ${result.elevation.unit}`} tone={result.elevation.elevation === null ? 'warn' : 'good'} />
          <Metric label="Climate zone" value={result.climateZone.ieccZone ?? 'Manual lookup'} tone={result.climateZone.ieccZone ? 'good' : 'warn'} />
          <Metric label="Weather grid" value={result.weather.gridId ? `${result.weather.gridId} ${result.weather.gridX},${result.weather.gridY}` : 'Unavailable'} tone={result.weather.gridId ? 'good' : 'warn'} />
          <div className="row-list">
            {result.providers.map((provider) => (
              <div className="data-row" key={provider.provider}>
                <span>{provider.provider}</span>
                <strong>{provider.status}</strong>
                <small>{provider.note}</small>
              </div>
            ))}
          </div>
          <h3>Advisories</h3>
          <div className="row-list">
            {result.advisories.map((advisory) => (
              <div className="data-row" key={advisory}>
                <span>{advisory}</span>
              </div>
            ))}
          </div>
          <h3>Sources</h3>
          <div className="row-list">
            {result.sources.map((source) => (
              <a className="supplier-row" key={source.id} href={source.url} target="_blank" rel="noreferrer">
                <span>{source.name}</span>
                <strong>{source.status}</strong>
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function InspectorTabBody({
  tab,
  selected,
  project,
  data,
  onReviewFloorUpdates,
}: {
  tab: InspectorTab
  selected: BuildingElement
  project: ProjectDocument
  data: EditorDerivedData
  onReviewFloorUpdates: (floorId: string) => void
}) {
  if (tab === 'properties') {
    return (
      <>
        <PlacementTab selected={selected} project={project} />
        <PropertiesTab selected={selected} project={project} onReviewFloorUpdates={onReviewFloorUpdates} />
      </>
    )
  }
  if (tab === 'assembly') return <AssemblyTab selected={selected} project={project} />
  if (tab === 'derived') return <DerivedTab selected={selected} data={data} />
  if (tab === 'materials') return <MaterialsTab data={data} project={project} />
  if (tab === 'code') return <CodeTab data={data} project={project} />
  return null
}

function PlacementTab({ selected, project }: { selected: BuildingElement; project: ProjectDocument }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const updateWallPath = useBimProjectStore((state) => state.updateWallPath)
  const updatePathPoint = useBimProjectStore((state) => state.updatePathPoint)
  const moveElement = useBimProjectStore((state) => state.moveElement)
  return (
    <div className="inspector-content">
      <TextField label="Name" value={selected.name} onChange={(name) => updateElement(selected.id, { name } as Partial<BuildingElement>)} />
      {selected.levelId && (
        <SelectField
          label="Level"
          value={selected.levelId}
          options={project.levels.map((level) => ({ value: level.id, label: level.name }))}
          onChange={(levelId) => updateElement(selected.id, { levelId } as Partial<BuildingElement>)}
        />
      )}
      {selected.type === 'wall' && (
        <>
          <NumberField label="Start X" value={selected.path[0].x} onChange={(x) => updateWallPath(selected.id, { ...selected.path[0], x }, selected.path[1])} />
          <NumberField label="Start Y" value={selected.path[0].y} onChange={(y) => updateWallPath(selected.id, { ...selected.path[0], y }, selected.path[1])} />
          <NumberField label="End X" value={selected.path[1].x} onChange={(x) => updateWallPath(selected.id, selected.path[0], { ...selected.path[1], x })} />
          <NumberField label="End Y" value={selected.path[1].y} onChange={(y) => updateWallPath(selected.id, selected.path[0], { ...selected.path[1], y })} />
        </>
      )}
      {(selected.type === 'electricalDevice' || selected.type === 'plumbingFixture') && <PositionFields element={selected} />}
      {selected.type === 'stair' && (
        <>
          <NumberField label="X (ft)" value={selected.position.x} onChange={(x) => updateElement(selected.id, { position: { ...selected.position, x } } as Partial<StairElement>)} />
          <NumberField label="Y (ft)" value={selected.position.y} onChange={(y) => updateElement(selected.id, { position: { ...selected.position, y } } as Partial<StairElement>)} />
        </>
      )}
      {(selected.type === 'pipe' || selected.type === 'duct') && (
        <>
          {selected.path.map((point, index) => (
            <div className="path-point-row" key={`${selected.id}-${index}`}>
              <strong>Point {index + 1}</strong>
              <input aria-label="Path x" value={point.x} type="number" onChange={(event) => updatePathPoint(selected.id, index, { x: Number(event.target.value) })} />
              <input aria-label="Path y" value={point.y} type="number" onChange={(event) => updatePathPoint(selected.id, index, { y: Number(event.target.value) })} />
              <input aria-label="Path z" value={point.z} type="number" onChange={(event) => updatePathPoint(selected.id, index, { z: Number(event.target.value) })} />
            </div>
          ))}
        </>
      )}
      <div className="nudge-grid">
        <button onClick={() => moveElement(selected.id, { x: 0, y: -1 })}>Nudge up 1 ft</button>
        <button onClick={() => moveElement(selected.id, { x: 0, y: 1 })}>Nudge down 1 ft</button>
        <button onClick={() => moveElement(selected.id, { x: -1, y: 0 })}>Nudge left 1 ft</button>
        <button onClick={() => moveElement(selected.id, { x: 1, y: 0 })}>Nudge right 1 ft</button>
      </div>
    </div>
  )
}

function PropertiesTab({
  selected,
  project,
  onReviewFloorUpdates,
}: {
  selected: BuildingElement
  project: ProjectDocument
  onReviewFloorUpdates: (floorId: string) => void
}) {
  const removeElement = useBimProjectStore((state) => state.removeElement)

  return (
    <div className="inspector-content">
      {selected.type === 'floor' && <FloorProperties element={selected} onReviewFloorUpdates={onReviewFloorUpdates} />}
      {selected.type === 'wall' && <WallProperties element={selected} project={project} />}
      {selected.type === 'opening' && <OpeningProperties element={selected} project={project} />}
      {selected.type === 'roof' && <RoofProperties element={selected} />}
      {selected.type === 'stair' && <StairProperties element={selected} />}
      {selected.type === 'houseAccessory' && <AccessoryProperties element={selected} />}
      {selected.type === 'electricalDevice' && <ElectricalDeviceProperties element={selected} />}
      {selected.type === 'circuit' && <CircuitProperties element={selected} />}
      {selected.type === 'plumbingFixture' && <PlumbingFixtureProperties element={selected} />}
      {selected.type === 'pipe' && <PipeProperties element={selected} />}
      {selected.type === 'duct' && <DuctProperties element={selected} />}
      <button className="danger-lite" onClick={() => removeElement(selected.id)}>
        Remove element
      </button>
    </div>
  )
}

function FloorProperties({ element, onReviewFloorUpdates }: { element: FloorElement; onReviewFloorUpdates: (floorId: string) => void }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const cleanPolygonFootprint = useBimProjectStore((state) => state.cleanPolygonFootprint)
  const bounds = polygonBounds(element.polygon)
  const width = bounds.maxX - bounds.minX
  const depth = bounds.maxY - bounds.minY

  return (
    <>
      <SelectField
        label="Floor/deck preset"
        value="custom"
        options={[{ value: 'custom', label: 'Custom current settings' }, ...floorStylePresets.map((preset) => ({ value: preset.id, label: preset.name }))]}
        onChange={(presetId) => {
          const preset = floorStylePresets.find((candidate) => candidate.id === presetId)
          if (preset) updateElement(element.id, preset.updates as Partial<FloorElement>)
      }}
      />
      <NumberField label="Elevation (ft)" value={element.elevation} onChange={(elevation) => updateElement(element.id, { elevation } as Partial<FloorElement>)} />
      <Metric label="Bounding width" value={`${width.toFixed(1)} ft`} />
      <Metric label="Bounding depth" value={`${depth.toFixed(1)} ft`} />
      <Metric label="Vertices" value={String(element.polygon.length)} />
      <button onClick={() => onReviewFloorUpdates(element.id)}>Review footprint updates</button>
      <button onClick={() => cleanPolygonFootprint(element.id)}>Clean footprint points</button>
      <SelectField
        label="Joist direction"
        value={element.joistDirection}
        options={[
          { value: 'x', label: 'Span X' },
          { value: 'y', label: 'Span Y' },
        ]}
        onChange={(joistDirection) => updateElement(element.id, { joistDirection } as Partial<FloorElement>)}
      />
      <NumberField label="Joist spacing (in)" value={element.joistSpacing} onChange={(joistSpacing) => updateElement(element.id, { joistSpacing } as Partial<FloorElement>)} />
      <NumberField label="Beam spacing (ft)" value={element.beamSpacing} onChange={(beamSpacing) => updateElement(element.id, { beamSpacing } as Partial<FloorElement>)} />
      <NumberField label="Pier spacing (ft)" value={element.pierSpacing} onChange={(pierSpacing) => updateElement(element.id, { pierSpacing } as Partial<FloorElement>)} />
      <SelectField
        label="Framing mode"
        value={element.framingMode ?? 'raisedFloor'}
        options={[
          { value: 'raisedFloor', label: 'Raised floor' },
          { value: 'platform', label: 'Platform floor' },
          { value: 'deck', label: 'Deck' },
          { value: 'porch', label: 'Porch' },
        ]}
        onChange={(framingMode) => updateElement(element.id, { framingMode: framingMode as FloorElement['framingMode'] } as Partial<FloorElement>)}
      />
      <SelectField
        label="Deck mode"
        value={element.deckMode ?? 'none'}
        options={[
          { value: 'none', label: 'No deck ledger' },
          { value: 'freestanding', label: 'Freestanding' },
          { value: 'ledger', label: 'Ledger attached' },
          { value: 'porch', label: 'Porch/deck roof' },
        ]}
        onChange={(deckMode) => updateElement(element.id, { deckMode: deckMode as FloorElement['deckMode'], framingMode: deckMode === 'none' ? element.framingMode : 'deck' } as Partial<FloorElement>)}
      />
      <SelectField
        label="Ledger edge"
        value={element.ledgerEdge ?? 'none'}
        options={[
          { value: 'none', label: 'No ledger edge' },
          { value: 'north', label: 'North' },
          { value: 'south', label: 'South' },
          { value: 'east', label: 'East' },
          { value: 'west', label: 'West' },
        ]}
        onChange={(ledgerEdge) => updateElement(element.id, { ledgerEdge: ledgerEdge === 'none' ? null : ledgerEdge as FloorElement['ledgerEdge'] } as Partial<FloorElement>)}
      />
      <SelectField
        label="Blocking policy"
        value={element.blockingPolicy ?? 'supportAndMidspan'}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'supportRows', label: 'Over supports' },
          { value: 'supportAndMidspan', label: 'Supports + midspan' },
          { value: 'none', label: 'None' },
        ]}
        onChange={(blockingPolicy) => updateElement(element.id, { blockingPolicy: blockingPolicy as FloorElement['blockingPolicy'] } as Partial<FloorElement>)}
      />
      <SelectField
        label="Beam layout"
        value={element.beamLayout ?? 'edgeAndInterior'}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'edgeAndInterior', label: 'Edge + interior' },
          { value: 'interiorOnly', label: 'Interior only' },
        ]}
        onChange={(beamLayout) => updateElement(element.id, { beamLayout: beamLayout as FloorElement['beamLayout'] } as Partial<FloorElement>)}
      />
      <Metric label="Area" value={`${polygonArea(element.polygon).toFixed(1)} sq ft`} />
    </>
  )
}

function WallProperties({ element, project }: { element: WallElement; project: ProjectDocument }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const updateWallPath = useBimProjectStore((state) => state.updateWallPath)
  const addOpening = useBimProjectStore((state) => state.addOpening)
  const openings = project.elements.filter((item) => item.type === 'opening' && item.hostWallId === element.id)

  return (
    <>
      <SelectField
        label="Wall preset"
        value="custom"
        options={[{ value: 'custom', label: 'Custom current settings' }, ...wallStylePresets.map((preset) => ({ value: preset.id, label: preset.name }))]}
        onChange={(presetId) => {
          const preset = wallStylePresets.find((candidate) => candidate.id === presetId)
          if (preset) updateElement(element.id, preset.updates as Partial<WallElement>)
        }}
      />
      <NumberField label="Start X" value={element.path[0].x} onChange={(x) => updateWallPath(element.id, { ...element.path[0], x }, element.path[1])} />
      <NumberField label="Start Y" value={element.path[0].y} onChange={(y) => updateWallPath(element.id, { ...element.path[0], y }, element.path[1])} />
      <NumberField label="End X" value={element.path[1].x} onChange={(x) => updateWallPath(element.id, element.path[0], { ...element.path[1], x })} />
      <NumberField label="End Y" value={element.path[1].y} onChange={(y) => updateWallPath(element.id, element.path[0], { ...element.path[1], y })} />
      <NumberField label="Height (ft)" value={element.height} onChange={(height) => updateElement(element.id, { height } as Partial<WallElement>)} />
      <NumberField label="Stud spacing (in)" value={element.studSpacing} onChange={(studSpacing) => updateElement(element.id, { studSpacing } as Partial<WallElement>)} />
      <ToggleField label="Exterior wall" checked={element.exterior} onChange={(exterior) => updateElement(element.id, { exterior } as Partial<WallElement>)} />
      <ToggleField label="Bearing wall" checked={element.bearing} onChange={(bearing) => updateElement(element.id, { bearing } as Partial<WallElement>)} />
      <SelectField
        label="Wall kind"
        value={element.wallKind ?? (element.height <= 4 ? 'halfWall' : element.exterior ? 'exterior' : 'interior')}
        options={[
          { value: 'exterior', label: 'Exterior' },
          { value: 'interior', label: 'Interior' },
          { value: 'halfWall', label: 'Half wall' },
          { value: 'ponyWall', label: 'Pony wall' },
        ]}
        onChange={(wallKind) => updateElement(element.id, { wallKind: wallKind as WallElement['wallKind'], halfWallCap: wallKind === 'halfWall' || wallKind === 'ponyWall' } as Partial<WallElement>)}
      />
      <SelectField
        label="Corner style"
        value={element.cornerStyle ?? 'threeStud'}
        options={[
          { value: 'threeStud', label: '3-stud corner' },
          { value: 'california', label: 'California corner' },
          { value: 'butt', label: 'Butt joint' },
          { value: 'miter', label: 'Miter visual' },
        ]}
        onChange={(cornerStyle) => updateElement(element.id, { cornerStyle: cornerStyle as WallElement['cornerStyle'] } as Partial<WallElement>)}
      />
      <SelectField
        label="Intersection"
        value={element.intersectionStyle ?? 'teeBacking'}
        options={[
          { value: 'teeBacking', label: 'Tee backing' },
          { value: 'ladderBlocking', label: 'Ladder blocking' },
          { value: 'none', label: 'None' },
        ]}
        onChange={(intersectionStyle) => updateElement(element.id, { intersectionStyle: intersectionStyle as WallElement['intersectionStyle'] } as Partial<WallElement>)}
      />
      <SelectField
        label="Plate policy"
        value={element.platePolicy ?? 'doubleTop'}
        options={[
          { value: 'singleTop', label: 'Single top plate' },
          { value: 'doubleTop', label: 'Double top plate' },
          { value: 'strapped', label: 'Strapped plate' },
        ]}
        onChange={(platePolicy) => updateElement(element.id, { platePolicy: platePolicy as WallElement['platePolicy'] } as Partial<WallElement>)}
      />
      <ToggleField label="Half-wall cap" checked={Boolean(element.halfWallCap)} onChange={(halfWallCap) => updateElement(element.id, { halfWallCap } as Partial<WallElement>)} />
      <button onClick={() => addOpening(element.id)}>Add opening to wall</button>
      <Metric label="Wall length" value={`${distance2(element.path[0], element.path[1]).toFixed(1)} ft`} />
      <Metric label="Openings" value={String(openings.length)} />
    </>
  )
}

function OpeningProperties({ element, project }: { element: OpeningElement; project: ProjectDocument }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const walls = project.elements.filter((item) => item.type === 'wall')
  return (
    <>
      <SelectField
        label="Host wall"
        value={element.hostWallId}
        options={walls.map((wall) => ({ value: wall.id, label: wall.name }))}
        onChange={(hostWallId) => updateElement(element.id, { hostWallId } as Partial<OpeningElement>)}
      />
      <SelectField
        label="Type"
        value={element.openingKind}
        options={[
          { value: 'window', label: 'Window' },
          { value: 'door', label: 'Door' },
        ]}
        onChange={(openingKind) => updateElement(element.id, { openingKind, sillHeight: openingKind === 'door' ? 0 : element.sillHeight } as Partial<OpeningElement>)}
      />
      <NumberField label="Center on wall (ft)" value={element.center} onChange={(center) => updateElement(element.id, { center } as Partial<OpeningElement>)} />
      <NumberField label="Width (ft)" value={element.width} onChange={(width) => updateElement(element.id, { width } as Partial<OpeningElement>)} />
      <NumberField label="Height (ft)" value={element.height} onChange={(height) => updateElement(element.id, { height } as Partial<OpeningElement>)} />
      <NumberField label="Sill height (ft)" value={element.sillHeight} onChange={(sillHeight) => updateElement(element.id, { sillHeight } as Partial<OpeningElement>)} />
      <TextField label="Header size" value={element.headerSize} onChange={(headerSize) => updateElement(element.id, { headerSize } as Partial<OpeningElement>)} />
    </>
  )
}

function RoofProperties({ element }: { element: RoofElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const cleanPolygonFootprint = useBimProjectStore((state) => state.cleanPolygonFootprint)
  const bounds = polygonBounds(element.footprint)
  const width = bounds.maxX - bounds.minX
  const depth = bounds.maxY - bounds.minY
  return (
    <>
      <SelectField
        label="Roof type"
        value={element.roofType}
        options={[
          { value: 'gable', label: 'Gable' },
          { value: 'shed', label: 'Shed' },
          { value: 'leanTo', label: 'Lean-to' },
          { value: 'hip', label: 'Hip' },
          { value: 'crossGable', label: 'Cross gable' },
          { value: 'valley', label: 'Valley' },
          { value: 'dormer', label: 'Dormer' },
          { value: 'porch', label: 'Porch' },
          { value: 'roofOverDeck', label: 'Roof over deck' },
          { value: 'flat', label: 'Flat' },
          { value: 'lowSlope', label: 'Low slope' },
          { value: 'gambrel', label: 'Gambrel' },
          { value: 'mansard', label: 'Mansard' },
        ]}
        onChange={(roofType) => updateElement(element.id, { roofType } as Partial<RoofElement>)}
      />
      <NumberField label="Base elevation (ft)" value={element.baseElevation} onChange={(baseElevation) => updateElement(element.id, { baseElevation } as Partial<RoofElement>)} />
      <Metric label="Bounding width" value={`${width.toFixed(1)} ft`} />
      <Metric label="Bounding depth" value={`${depth.toFixed(1)} ft`} />
      <Metric label="Vertices" value={String(element.footprint.length)} />
      <button onClick={() => cleanPolygonFootprint(element.id)}>Clean footprint points</button>
      <NumberField label="Pitch rise" value={element.pitchRise} onChange={(pitchRise) => updateElement(element.id, { pitchRise } as Partial<RoofElement>)} />
      <NumberField label="Pitch run" value={element.pitchRun} onChange={(pitchRun) => updateElement(element.id, { pitchRun } as Partial<RoofElement>)} />
      <NumberField label="Overhang (ft)" value={element.overhang} onChange={(overhang) => updateElement(element.id, { overhang } as Partial<RoofElement>)} />
      <NumberField label="Eave overhang (ft)" value={element.eaveOverhang ?? element.overhang} onChange={(eaveOverhang) => updateElement(element.id, { eaveOverhang } as Partial<RoofElement>)} />
      <NumberField label="Rake overhang (ft)" value={element.rakeOverhang ?? element.overhang} onChange={(rakeOverhang) => updateElement(element.id, { rakeOverhang } as Partial<RoofElement>)} />
      <NumberField label="Rafter spacing (in)" value={element.rafterSpacing} onChange={(rafterSpacing) => updateElement(element.id, { rafterSpacing } as Partial<RoofElement>)} />
      <TextField label="Rafter size" value={element.rafterSize} onChange={(rafterSize) => updateElement(element.id, { rafterSize } as Partial<RoofElement>)} />
      <SelectField
        label="Attachment"
        value={element.attachment ?? (element.roofType === 'shed' ? 'wallAttachedShed' : 'freestanding')}
        options={[
          { value: 'freestanding', label: 'Freestanding roof' },
          { value: 'wallAttachedShed', label: 'Wall-attached shed' },
          { value: 'overDeck', label: 'Over deck' },
          { value: 'overPorch', label: 'Over porch' },
        ]}
        onChange={(attachment) => updateElement(element.id, { attachment: attachment as RoofElement['attachment'] } as Partial<RoofElement>)}
      />
      <SelectField
        label="Purlin mode"
        value={element.purlinMode ?? 'roofBattenNailer'}
        options={[
          { value: 'none', label: 'No purlins/battens' },
          { value: 'roofBattenNailer', label: 'Battens/nailers' },
          { value: 'structuralPurlinWithStruts', label: 'Structural purlins + struts' },
        ]}
        onChange={(purlinMode) => updateElement(element.id, { purlinMode: purlinMode as RoofElement['purlinMode'] } as Partial<RoofElement>)}
      />
    </>
  )
}

function StairProperties({ element }: { element: StairElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <SelectField
        label="Direction"
        value={element.direction}
        options={[
          { value: 'x', label: 'Run X' },
          { value: 'y', label: 'Run Y' },
        ]}
        onChange={(direction) => updateElement(element.id, { direction } as Partial<StairElement>)}
      />
      <NumberField label="Width (ft)" value={element.width} onChange={(width) => updateElement(element.id, { width } as Partial<StairElement>)} />
      <NumberField label="Total rise (ft)" value={element.totalRise} onChange={(totalRise) => updateElement(element.id, { totalRise } as Partial<StairElement>)} />
      <NumberField label="Tread depth (ft)" value={element.treadDepth} onChange={(treadDepth) => updateElement(element.id, { treadDepth } as Partial<StairElement>)} />
      <NumberField label="Riser height (ft)" value={element.riserHeight} onChange={(riserHeight) => updateElement(element.id, { riserHeight } as Partial<StairElement>)} />
      <TextField label="Stringer size" value={element.stringerSize} onChange={(stringerSize) => updateElement(element.id, { stringerSize } as Partial<StairElement>)} />
      <Metric label="Approx. risers" value={String(Math.ceil(element.totalRise / Math.max(element.riserHeight, 0.1)))} />
    </>
  )
}

function AccessoryProperties({ element }: { element: HouseAccessoryElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <SelectField
        label="Accessory type"
        value={element.accessoryKind}
        options={[
          { value: 'deck', label: 'Deck accessory' },
          { value: 'porch', label: 'Porch accessory' },
          { value: 'landing', label: 'Landing' },
          { value: 'guardRail', label: 'Guard / rail' },
          { value: 'column', label: 'Post / column' },
          { value: 'generic', label: 'Generic' },
        ]}
        onChange={(accessoryKind) => updateElement(element.id, { accessoryKind } as Partial<HouseAccessoryElement>)}
      />
      <NumberField label="X (ft)" value={element.position.x} onChange={(x) => updateElement(element.id, { position: { ...element.position, x } } as Partial<HouseAccessoryElement>)} />
      <NumberField label="Y (ft)" value={element.position.y} onChange={(y) => updateElement(element.id, { position: { ...element.position, y } } as Partial<HouseAccessoryElement>)} />
      <NumberField label="Z/elevation (ft)" value={element.position.z} onChange={(z) => updateElement(element.id, { position: { ...element.position, z } } as Partial<HouseAccessoryElement>)} />
      <NumberField label="Width (ft)" value={element.width} onChange={(width) => updateElement(element.id, { width } as Partial<HouseAccessoryElement>)} />
      <NumberField label="Depth (ft)" value={element.depth} onChange={(depth) => updateElement(element.id, { depth } as Partial<HouseAccessoryElement>)} />
      <NumberField label="Height (ft)" value={element.height} onChange={(height) => updateElement(element.id, { height } as Partial<HouseAccessoryElement>)} />
      <TextField label="Material ID" value={element.materialId ?? ''} onChange={(materialId) => updateElement(element.id, { materialId } as Partial<HouseAccessoryElement>)} />
    </>
  )
}

function ElectricalDeviceProperties({ element }: { element: ElectricalDeviceElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <SelectField
        label="Device type"
        value={element.deviceKind}
        options={[
          { value: 'panel', label: 'Panel' },
          { value: 'outlet', label: 'Outlet' },
          { value: 'gfciOutlet', label: 'GFCI outlet' },
          { value: 'switch', label: 'Switch' },
          { value: 'light', label: 'Light' },
          { value: 'junction', label: 'Junction' },
        ]}
        onChange={(deviceKind) => updateElement(element.id, { deviceKind } as Partial<ElectricalDeviceElement>)}
      />
      <PositionFields element={element} />
      <NumberField label="Load watts" value={element.loadWatts ?? 0} onChange={(loadWatts) => updateElement(element.id, { loadWatts } as Partial<ElectricalDeviceElement>)} />
    </>
  )
}

function CircuitProperties({ element }: { element: CircuitElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <NumberField label="Amperage" value={element.amperage} step={5} onChange={(amperage) => updateElement(element.id, { amperage: amperage as CircuitElement['amperage'] } as Partial<CircuitElement>)} />
      <SelectField
        label="Breaker"
        value={element.breakerType}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'gfci', label: 'GFCI' },
          { value: 'afci', label: 'AFCI' },
          { value: 'dualFunction', label: 'Dual-function' },
        ]}
        onChange={(breakerType) => updateElement(element.id, { breakerType } as Partial<CircuitElement>)}
      />
      <NumberField label="Wire gauge" value={element.wireGauge} step={2} onChange={(wireGauge) => updateElement(element.id, { wireGauge: wireGauge as CircuitElement['wireGauge'] } as Partial<CircuitElement>)} />
      <Metric label="Connected devices" value={String(element.deviceIds.length)} />
    </>
  )
}

function PlumbingFixtureProperties({ element }: { element: PlumbingFixtureElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <SelectField
        label="Fixture type"
        value={element.fixtureKind}
        options={[
          { value: 'sink', label: 'Sink' },
          { value: 'toilet', label: 'Toilet' },
          { value: 'shower', label: 'Shower' },
          { value: 'tub', label: 'Tub' },
          { value: 'washer', label: 'Washer' },
          { value: 'dishwasher', label: 'Dishwasher' },
          { value: 'waterHeater', label: 'Water heater' },
          { value: 'hoseBib', label: 'Hose bib' },
        ]}
        onChange={(fixtureKind) => updateElement(element.id, { fixtureKind } as Partial<PlumbingFixtureElement>)}
      />
      <PositionFields element={element} />
      <NumberField label="Supply count" value={element.supplyCount} step={1} onChange={(supplyCount) => updateElement(element.id, { supplyCount } as Partial<PlumbingFixtureElement>)} />
      <NumberField label="Drain diameter (in)" value={element.drainDiameter} onChange={(drainDiameter) => updateElement(element.id, { drainDiameter } as Partial<PlumbingFixtureElement>)} />
      <NumberField label="DFU" value={element.dfu} step={1} onChange={(dfu) => updateElement(element.id, { dfu } as Partial<PlumbingFixtureElement>)} />
    </>
  )
}

function PipeProperties({ element }: { element: PipeElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const first = element.path[0] ?? { x: 0, y: 0, z: 0 }
  const last = element.path[element.path.length - 1] ?? first
  return (
    <>
      <SelectField
        label="Pipe type"
        value={element.pipeKind}
        options={[
          { value: 'supply', label: 'Supply' },
          { value: 'drain', label: 'Drain' },
          { value: 'vent', label: 'Vent' },
          { value: 'gas', label: 'Gas' },
        ]}
        onChange={(pipeKind) => updateElement(element.id, { pipeKind } as Partial<PipeElement>)}
      />
      <NumberField label="Diameter (in)" value={element.diameter} onChange={(diameter) => updateElement(element.id, { diameter } as Partial<PipeElement>)} />
      <NumberField label="Slope (in/ft)" value={element.slope ?? 0} onChange={(slope) => updateElement(element.id, { slope } as Partial<PipeElement>)} />
      <NumberField label="Start X" value={first.x} onChange={(x) => updateElement(element.id, { path: [{ ...first, x }, ...element.path.slice(1)] } as Partial<PipeElement>)} />
      <NumberField label="End X" value={last.x} onChange={(x) => updateElement(element.id, { path: [...element.path.slice(0, -1), { ...last, x }] } as Partial<PipeElement>)} />
    </>
  )
}

function DuctProperties({ element }: { element: DuctElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <SelectField
        label="Duct type"
        value={element.ductKind}
        options={[
          { value: 'supply', label: 'Supply' },
          { value: 'return', label: 'Return' },
          { value: 'exhaust', label: 'Exhaust' },
        ]}
        onChange={(ductKind) => updateElement(element.id, { ductKind } as Partial<DuctElement>)}
      />
      <NumberField label="Width (in)" value={element.size.width} onChange={(width) => updateElement(element.id, { size: { ...element.size, width } } as Partial<DuctElement>)} />
      <NumberField label="Height (in)" value={element.size.height} onChange={(height) => updateElement(element.id, { size: { ...element.size, height } } as Partial<DuctElement>)} />
      <Metric label="Path points" value={String(element.path.length)} />
    </>
  )
}

function PositionFields({ element }: { element: ElectricalDeviceElement | PlumbingFixtureElement }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  return (
    <>
      <NumberField label="X (ft)" value={element.position.x} onChange={(x) => updateElement(element.id, { position: { ...element.position, x } } as Partial<typeof element>)} />
      <NumberField label="Y (ft)" value={element.position.y} onChange={(y) => updateElement(element.id, { position: { ...element.position, y } } as Partial<typeof element>)} />
      <NumberField label="Z (ft)" value={element.position.z} onChange={(z) => updateElement(element.id, { position: { ...element.position, z } } as Partial<typeof element>)} />
    </>
  )
}

function AssemblyTab({ selected, project }: { selected: BuildingElement; project: ProjectDocument }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const assemblyId = 'assemblyId' in selected ? selected.assemblyId : undefined
  const assembly = assemblyId ? project.assemblies[assemblyId] : undefined
  const compatibleAssemblies = Object.values(project.assemblies).filter((candidate) => {
    if (selected.type === 'wall') return candidate.kind === 'wall'
    if (selected.type === 'floor') return candidate.kind === 'floor'
    if (selected.type === 'roof') return candidate.kind === 'roof'
    return false
  })
  return (
    <div className="inspector-content">
      {!assembly ? (
        <p>This element does not use a layered assembly yet.</p>
      ) : (
        <>
          {'assemblyId' in selected && compatibleAssemblies.length > 0 && (
            <SelectField
              label="Assembly type"
              value={assemblyId ?? ''}
              options={compatibleAssemblies.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              onChange={(nextAssemblyId) => updateElement(selected.id, { assemblyId: nextAssemblyId } as Partial<BuildingElement>)}
            />
          )}
          <Metric label="Assembly" value={assembly.name} />
          <Metric label="Kind" value={assembly.kind} />
          <Metric label="Total thickness" value={`${(calculateAssemblyThickness(project, assembly) * 12).toFixed(2)} in`} />
          <Metric label="Takeoff layers" value={String(normalizeAssembly(project, assembly.id)?.layers.filter((layer) => layer.takeoff.emitsTakeoff).length ?? 0)} />
          <div className="row-list">
            {(normalizeAssembly(project, assembly.id)?.layers ?? assembly.layers.map((layer, index) => ({ ...layer, index, side: 'core' as const, takeoff: { emitsTakeoff: true, coverage: 'area' as const } }))).map((layer) => (
              <div className="data-row" key={`${layer.index}-${layer.role}-${layer.materialId}`}>
                <span>{layer.side} / {layer.role}</span>
                <strong>{project.materials[layer.materialId]?.name ?? layer.materialId}</strong>
                {project.materials[layer.materialId]?.profile?.nominal && <small>{project.materials[layer.materialId]?.profile?.nominal}</small>}
                {layer.thickness && <small>{layer.thickness}" layer</small>}
                <small>{layer.takeoff.emitsTakeoff ? `takeoff: ${layer.takeoff.coverage ?? 'area'}` : 'model-only layer'}</small>
              </div>
            ))}
          </div>
          <h3>Member / Finish Options</h3>
          {selected.type === 'wall' && (
            <>
              <SelectField label="Stud size" value={selected.studSize} options={lumberOptions(project, ['2x4', '2x6'])} onChange={(studSize) => updateElement(selected.id, { studSize } as Partial<WallElement>)} />
              <NumberField label="Stud spacing (in)" value={selected.studSpacing} onChange={(studSpacing) => updateElement(selected.id, { studSpacing } as Partial<WallElement>)} />
            </>
          )}
          {selected.type === 'floor' && (
            <>
              <SelectField label="Joist size" value={selected.joistSize} options={lumberOptions(project, ['2x8', '2x10'])} onChange={(joistSize) => updateElement(selected.id, { joistSize } as Partial<FloorElement>)} />
              <NumberField label="Joist spacing (in)" value={selected.joistSpacing} onChange={(joistSpacing) => updateElement(selected.id, { joistSpacing } as Partial<FloorElement>)} />
            </>
          )}
          {selected.type === 'roof' && (
            <>
              <SelectField label="Rafter size" value={selected.rafterSize} options={lumberOptions(project, ['2x8', '2x10'])} onChange={(rafterSize) => updateElement(selected.id, { rafterSize } as Partial<RoofElement>)} />
              <NumberField label="Rafter spacing (in)" value={selected.rafterSpacing} onChange={(rafterSpacing) => updateElement(selected.id, { rafterSpacing } as Partial<RoofElement>)} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function lumberOptions(project: ProjectDocument, nominals: string[]) {
  return nominals.map((nominal) => {
    const material = Object.values(project.materials).find((candidate) => candidate.category === 'lumber' && candidate.nominal === nominal)
    return { value: nominal, label: material ? `${nominal} - ${material.name}` : nominal }
  })
}

function formatFeetInches(value: number): string {
  const feet = Math.floor(value)
  const inches = Math.round((value - feet) * 12)
  if (inches === 12) return `${feet + 1}'-0"`
  return `${feet}'-${inches}"`
}

function DerivedTab({ selected, data }: { selected: BuildingElement; data: EditorDerivedData }) {
  const framing = data.derived.framing.filter((member) => member.sourceElementId === selected.id)
  const wallSolid = data.derived.wallSolids.find((solid) => solid.sourceElementId === selected.id)
  const surfaces = data.derived.envelopeSurfaces.filter((surface) => surface.sourceElementId === selected.id)
  const layerFragments = data.derived.layerTakeoffFragments.filter((fragment) => fragment.sourceElementId === selected.id)
  const supportGrids = data.derived.supportGrids.filter((grid) => grid.sourceElementId === selected.id)
  const bearingPoints = data.derived.bearingPoints.filter((point) => point.sourceElementId === selected.id)
  const unresolved = data.derived.unresolvedIntersections.filter((item) => item.sourceElementId === selected.id)
  const byRole = framing.reduce<Record<string, number>>((acc, member) => {
    acc[member.role] = (acc[member.role] ?? 0) + member.count
    return acc
  }, {})
  const byOrientation = framing.reduce<Record<string, number>>((acc, member) => {
    const key = member.orientation ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const stockGroups = framing.reduce<Record<string, number>>((acc, member) => {
    if (!member.stockLength || !member.size) return acc
    const key = `${member.size} x ${member.stockLength} ft`
    acc[key] = (acc[key] ?? 0) + Math.max(1, Math.ceil((member.cutLength ?? 0) / member.stockLength))
    return acc
  }, {})
  const memberSchedule = framing
    .slice()
    .sort((a, b) => `${a.subsystem}-${a.visualRole ?? a.role}`.localeCompare(`${b.subsystem}-${b.visualRole ?? b.role}`))
    .slice(0, 36)
  return (
    <div className="inspector-content">
      <Metric label="Derived members" value={String(framing.length)} />
      <Metric label="Envelope surfaces" value={String(surfaces.length)} />
      <Metric label="Layer takeoff fragments" value={String(layerFragments.length)} />
      <Metric label="Support grids" value={String(supportGrids.length)} />
      <Metric label="Bearing points" value={String(bearingPoints.length)} />
      <Metric label="Unresolved joins" value={String(unresolved.length)} tone={unresolved.length > 0 ? 'bad' : 'good'} />
      <Metric label="Takeoff rows" value={String(data.selectedTakeoff.length)} />
      <Metric label="Code flags" value={String(data.selectedRules.filter((rule) => rule.status !== 'pass').length)} tone={data.selectedRules.some((rule) => rule.severity === 'error') ? 'bad' : 'warn'} />
      {wallSolid && (
        <>
          <h3>Wall solid</h3>
          <Metric label="Derived thickness" value={`${(wallSolid.thickness * 12).toFixed(2)} in`} />
          <Metric label="Opening voids" value={String(wallSolid.openingVoids.length)} />
          <Metric label="Layer bands" value={String(wallSolid.layerBands.length)} />
        </>
      )}
      <h3>Orientation</h3>
      <div className="row-list">
        {Object.entries(byOrientation).map(([orientation, count]) => (
          <div className="data-row" key={orientation}>
            <span>{orientation}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <h3>Framing roles</h3>
      <div className="row-list">
        {Object.entries(byRole).map(([role, count]) => (
          <div className="data-row" key={role}>
            <span>{role}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <h3>Stock lengths</h3>
      <div className="row-list">
        {Object.entries(stockGroups).map(([stock, count]) => (
          <div className="data-row" key={stock}>
            <span>{stock}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <h3>Member schedule</h3>
      <div className="member-schedule">
        <div className="member-schedule-head">
          <span>Role</span>
          <span>Size</span>
          <span>Cut</span>
          <span>Stock</span>
        </div>
        {memberSchedule.map((member) => (
          <div className="member-schedule-row" key={member.id}>
            <span title={member.role}>{member.visualRole ?? member.role}</span>
            <span>{member.size ?? '-'}</span>
            <span>{formatFeetInches(member.cutLength ?? 0)}</span>
            <span>{member.stockLength ? `${member.stockLength} ft` : '-'}</span>
          </div>
        ))}
      </div>
      {supportGrids.length > 0 && (
        <>
          <h3>Support grid</h3>
          <div className="row-list">
            {supportGrids.map((grid) => (
              <div className="data-row" key={grid.id}>
                <span>{grid.system} / {grid.primaryDirection}</span>
                <strong>{grid.beamLines.length} beams, {grid.postPoints.filter((point) => point.kind === 'post').length} posts</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {unresolved.length > 0 && (
        <>
          <h3>Unresolved</h3>
          <div className="row-list">
            {unresolved.map((item) => (
              <div className="data-row" key={item.id}>
                <span>{item.kind}</span>
                <strong>{item.note ?? 'Needs review'}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {selected.type === 'floor' && (
        <p className="muted">Pier heights, beam rows, rim joists, and joist spacing update from the floor elevation, terrain model, and framing fields.</p>
      )}
      {selected.type === 'wall' && (
        <p className="muted">Studs, king/trimmer framing, headers, and opening checks derive from wall length, height, bearing status, and hosted openings.</p>
      )}
    </div>
  )
}

function MaterialsTab({ data, project }: { data: EditorDerivedData; project: ProjectDocument }) {
  const selectedStore = useBimProjectStore((s) => s.selectedStore)
  const addSupplierProduct = useBimProjectStore((s) => s.addSupplierProduct)
  const addToCart = useBimProjectStore((s) => s.addToCart)
  const [offers, setOffers] = React.useState<any[]>([])

  const selectedMaterialKey = data.selectedTakeoff.map((l) => l.materialId).join('|')

  React.useEffect(() => {
    let mounted = true
    setOffers([])
    if (!selectedStore) return
    const query = data.selectedTakeoff.length > 0 ? data.selectedTakeoff[0].description : ''
    const zip = project.suppliers?.zipCode ?? ''
    if (!query) return
    fetch(`/api/store/stores/${encodeURIComponent(selectedStore.id)}/offers?query=${encodeURIComponent(query)}&zipCode=${encodeURIComponent(zip)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        setOffers(d.offers ?? [])
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [selectedStore?.id, project.suppliers?.zipCode, selectedMaterialKey])

  function applyOfferToProject(offer: any) {
    const materialId = data.selectedTakeoff[0]?.materialId ?? 'unknown'
    const product = {
      supplier: offer.storeType === 'homeDepot' ? 'homeDepot' : 'local',
      sku: offer.sku,
      title: offer.title,
      materialId,
      unitPrice: offer.unitPrice ?? offer.price,
      unit: offer.unit,
      storeName: offer.storeName,
      zipCode: project.suppliers?.zipCode ?? '',
      availableQty: offer.quantityAvailable ?? 0,
      productUrl: offer.productUrl ?? offer.productUrl,
      lastUpdated: new Date().toISOString(),
    }
    addSupplierProduct(product as any)
  }

  async function mapMaterialAndApply() {
    if (!selectedStore) return
    const materialName = data.selectedTakeoff[0]?.description ?? ''
    const materialId = data.selectedTakeoff[0]?.materialId ?? ''
    try {
      const resp = await fetch(`/api/store/stores/${encodeURIComponent(selectedStore.id)}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material: { id: materialId, name: materialName } }),
      })
      const json = await resp.json()
      const mapping = json?.mapping
      if (!mapping || !mapping.sku) {
        window.alert('No mapping found for this material')
        return
      }
      const offersResp = await fetch(`/api/store/stores/${encodeURIComponent(selectedStore.id)}/offers?query=${encodeURIComponent(mapping.sku)}&zipCode=${encodeURIComponent(project.suppliers.zipCode)}`)
      const offersJson = await offersResp.json()
      const found = (offersJson?.offers ?? [])[0]
      if (found) applyOfferToProject(found)
      else window.alert('Mapped SKU found but no offer returned')
    } catch (e) {
      console.error(e)
      window.alert('Failed to map material')
    }
  }

  return (
    <div className="inspector-content">
      <Metric label="Selected takeoff rows" value={String(data.selectedTakeoff.length)} />
      <div className="row-list">
        {data.selectedTakeoff.map((line) => (
          <div className="data-row" key={line.id}>
            <span>{line.description}</span>
            <strong>
              {(line.purchaseQuantity ?? line.quantity).toFixed(1)} {line.purchaseUnit ?? line.unit}
            </strong>
          </div>
        ))}
      </div>
      <h3>Supplier Matches</h3>
      <div className="row-list">
        {data.selectedProducts.length === 0 ? <p>No direct SKU match for this selection yet.</p> : null}
        {data.selectedProducts.map((product) => (
          <div className="supplier-row" key={product.sku}>
            <a href={product.productUrl} target="_blank" rel="noreferrer"><span>{product.title}</span></a>
            <strong>SKU {product.sku}</strong>
            <div className="supplier-actions">
              <button onClick={() => addToCart(product, 1)}>Add to cart</button>
            </div>
          </div>
        ))}
      </div>

      {selectedStore && (
        <>
          <h3>Local Store Matches ({selectedStore.name})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => mapMaterialAndApply()} disabled={data.selectedTakeoff.length === 0}>Map SKU</button>
            <small className="muted">Try server mapping of the selected material</small>
          </div>
          <div className="row-list">
            {offers.length === 0 ? <p>No local matches found for this selection.</p> : null}
            {offers.map((offer) => (
              <div key={offer.offerId} className="supplier-row">
                <a href={offer.productUrl} target="_blank" rel="noreferrer"><span>{offer.title}</span></a>
                <strong>{offer.sku} — {offer.price ? `$${offer.price.toFixed(2)}` : ''}</strong>
                <div className="supplier-actions">
                  <button onClick={() => applyOfferToProject(offer)}>Apply SKU</button>
                  <button onClick={() => addToCart({ supplier: 'homeDepot', sku: offer.sku, title: offer.title, materialId: data.selectedTakeoff[0]?.materialId ?? '', unitPrice: offer.unitPrice ?? offer.price, unit: offer.unit ?? 'each', storeName: offer.storeName, zipCode: project.suppliers?.zipCode ?? '', availableQty: offer.quantityAvailable ?? 0, productUrl: offer.productUrl ?? '', lastUpdated: offer.lastUpdated ?? new Date().toISOString() }, 1)}>Add to cart</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Global Subsystems</h3>
      {Object.entries(data.takeoff.totalsBySubsystem).map(([key, value]) => (
        <Metric key={key} label={key} value={value.toFixed(1)} />
      ))}
      <p className="muted">Catalog location: {project.suppliers.preferredSupplier} / {project.suppliers.zipCode}</p>
    </div>
  )
}

function CodeTab({ data, project }: { data: EditorDerivedData; project: ProjectDocument }) {
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const rows = data.selectedRules.length > 0 ? data.selectedRules : data.rules.filter((rule) => rule.status !== 'pass').slice(0, 6)
  function applyQuickFix(ruleId: string) {
    const rule = rows.find((candidate) => candidate.id === ruleId)
    const element = project.elements.find((candidate) => candidate.id === rule?.elementId)
    if (!rule || !element) return
    if (rule.id.startsWith('floor-spacing-') && element.type === 'floor') updateElement(element.id, { joistSpacing: 16 } as Partial<FloorElement>)
    if (rule.id.startsWith('floor-span-') && element.type === 'floor') updateElement(element.id, { joistDirection: element.joistDirection === 'x' ? 'y' : 'x', beamSpacing: Math.min(element.beamSpacing, 8) } as Partial<FloorElement>)
    if (rule.id.startsWith('wall-height-') && element.type === 'wall') updateElement(element.id, { height: 9 } as Partial<WallElement>)
    if (rule.id.startsWith('opening-header-') && element.type === 'opening') updateElement(element.id, { headerSize: '2x10' } as Partial<OpeningElement>)
    if (rule.id.startsWith('pipe-slope-') && element.type === 'pipe') updateElement(element.id, { slope: 0.25 } as Partial<PipeElement>)
    if (rule.id.startsWith('circuit-afci-') && element.type === 'circuit') updateElement(element.id, { breakerType: 'dualFunction' } as Partial<CircuitElement>)
  }
  return (
    <div className="inspector-content">
      {rows.length === 0 ? <p>No open code flags for this selection.</p> : null}
      <div className="issue-list">
        {rows.map((rule) => (
          <div key={rule.id} className={`issue-card issue-${rule.severity}`}>
            <strong>{rule.title}</strong>
            <span>{rule.message}</span>
            {rule.suggestion && <em>{rule.suggestion}</em>}
            <div className="issue-actions">
              {rule.suggestion && <button onClick={() => applyQuickFix(rule.id)}>Apply safe quick fix</button>}
              <a href={rule.reference.url} target="_blank" rel="noreferrer">Reference</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
