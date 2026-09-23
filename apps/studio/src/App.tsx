import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'

import type { BuildGraph, BuildRequirement } from '../../../packages/build/src/index'
import type { SupplyGraph } from '../../../packages/supply/src/index'
import {
  ActorRef,
  Vec3,
  WorldDiff,
  WorldDocument,
  WorldEntity,
  WorldMutation,
  WorldTransaction,
  createBoxEntity,
  createPolylineEntity,
  createPolygonEntity,
  createTransaction,
  geometryAnchor,
  polygonAreaXY,
  polylineLength,
} from '../../../packages/world/src/index'

interface ProposalView {
  status: 'ready' | 'stale-or-invalid'
  proposal: WorldTransaction
  diff?: WorldDiff
  error?: string
}

const human: ActorRef = {
  kind: 'human',
  id: 'studio:local-human',
  label: 'Studio user',
}

const CANVAS_SCALE = 12
const CANVAS_ORIGIN_X = 360
const CANVAS_ORIGIN_Y = 260

function toCanvasPoint(point: { x: number; y: number }) {
  return {
    x: CANVAS_ORIGIN_X + point.x * CANVAS_SCALE,
    y: CANVAS_ORIGIN_Y + point.y * CANVAS_SCALE,
  }
}

function pointsToAttribute(points: Vec3[]): string {
  return points
    .map((point) => {
      const canvas = toCanvasPoint(point)
      return `${canvas.x},${canvas.y}`
    })
    .join(' ')
}

function pointsAttribute(entity: WorldEntity): string {
  const geometry = entity.geometry
  if (!geometry || geometry.type === 'box') return ''
  return pointsToAttribute(geometry.points)
}

function snapHalfFoot(value: number): number {
  return Math.round(value * 2) / 2
}

function entityStyle(entity: WorldEntity) {
  const geometry = entity.geometry
  if (!geometry || geometry.type !== 'box') return undefined

  return {
    left: CANVAS_ORIGIN_X + geometry.position.x * CANVAS_SCALE,
    top: CANVAS_ORIGIN_Y + geometry.position.y * CANVAS_SCALE,
    width: Math.max(28, geometry.size.x * CANVAS_SCALE),
    height: Math.max(28, geometry.size.y * CANVAS_SCALE),
  }
}


const READ_ONLY_PROPERTIES = new Set(['capability', 'fidelity'])

function PropertyEditorRow({
  name,
  value,
  knowledge,
  readOnly,
  onSave,
}: {
  name: string
  value: string | number | boolean | null
  knowledge?: NonNullable<WorldEntity['propertyKnowledge']>[string]
  readOnly: boolean
  onSave: (name: string, value: string | number | boolean | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  const save = () => {
    if (readOnly || value === null) return
    if (typeof value === 'number') {
      const parsed = Number(draft)
      if (!Number.isFinite(parsed)) return
      onSave(name, parsed)
      return
    }
    if (typeof value === 'boolean') {
      onSave(name, draft === 'true')
      return
    }
    onSave(name, draft)
  }

  return (
    <div className="property-row">
      <div className="property-heading">
        <span>{name}</span>
        <small>
          {knowledge
            ? `${knowledge.basis} · ${knowledge.provenance.origin}`
            : 'inherits entity provenance'}
        </small>
      </div>
      {readOnly || value === null ? (
        <strong>{value === null ? 'null' : String(value)}</strong>
      ) : typeof value === 'boolean' ? (
        <select value={draft} onChange={(event) => setDraft(event.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          step={typeof value === 'number' ? 'any' : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
        />
      )}
      {!readOnly && value !== null && (
        <button onClick={save}>Save</button>
      )}
    </div>
  )
}

function GeometryPointRow({
  point,
  index,
  canRemove,
  onCommit,
  onInsertAfter,
  onRemove,
}: {
  point: Vec3
  index: number
  canRemove: boolean
  onCommit: (index: number, point: Vec3) => void
  onInsertAfter: (index: number) => void
  onRemove: (index: number) => void
}) {
  const [x, setX] = useState(String(point.x))
  const [y, setY] = useState(String(point.y))

  useEffect(() => {
    setX(String(point.x))
    setY(String(point.y))
  }, [point.x, point.y])

  const save = () => {
    const nextX = Number(x)
    const nextY = Number(y)
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return
    onCommit(index, {
      x: snapHalfFoot(nextX),
      y: snapHalfFoot(nextY),
      z: point.z,
    })
  }

  return (
    <div className="vertex-row">
      <span className="vertex-label">P{index + 1}</span>
      <label>
        <span>X</span>
        <input
          type="number"
          step="0.5"
          value={x}
          onChange={(event) => setX(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
        />
      </label>
      <label>
        <span>Y</span>
        <input
          type="number"
          step="0.5"
          value={y}
          onChange={(event) => setY(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
        />
      </label>
      <div className="vertex-actions">
        <button onClick={save}>Save</button>
        <button onClick={() => onInsertAfter(index)}>+</button>
        <button disabled={!canRemove} onClick={() => onRemove(index)}>−</button>
      </div>
    </div>
  )
}

export function App() {
  const [world, setWorld] = useState<WorldDocument | null>(null)
  const [buildGraph, setBuildGraph] = useState<BuildGraph | null>(null)
  const [supplyGraph, setSupplyGraph] = useState<SupplyGraph | null>(null)
  const [proposals, setProposals] = useState<ProposalView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<'polyline' | 'polygon' | null>(null)
  const [draftPoints, setDraftPoints] = useState<Vec3[]>([])
  const [status, setStatus] = useState('Connecting to world...')

  const loadDerived = useCallback(async () => {
    const [buildResponse, supplyResponse, proposalResponse] = await Promise.all([
      fetch('/api/build-graph'),
      fetch('/api/supply-graph'),
      fetch('/api/proposals'),
    ])
    if (!buildResponse.ok) throw new Error('Could not derive Build Graph')
    if (!supplyResponse.ok) throw new Error('Could not derive Supply Graph')
    if (!proposalResponse.ok) throw new Error('Could not load proposals')

    const [buildPayload, supplyPayload, proposalPayload] = await Promise.all([
      buildResponse.json(),
      supplyResponse.json(),
      proposalResponse.json(),
    ])
    setBuildGraph(buildPayload.buildGraph)
    setSupplyGraph(supplyPayload.supplyGraph)
    setProposals(proposalPayload.proposals)
  }, [])

  const loadWorld = useCallback(async () => {
    const [worldResponse, buildResponse, supplyResponse, proposalResponse] = await Promise.all([
      fetch('/api/world'),
      fetch('/api/build-graph'),
      fetch('/api/supply-graph'),
      fetch('/api/proposals'),
    ])

    if (!worldResponse.ok) throw new Error('Could not load world')
    if (!buildResponse.ok) throw new Error('Could not derive Build Graph')
    if (!supplyResponse.ok) throw new Error('Could not derive Supply Graph')
    if (!proposalResponse.ok) throw new Error('Could not load proposals')

    const [worldPayload, buildPayload, supplyPayload, proposalPayload] = await Promise.all([
      worldResponse.json(),
      buildResponse.json(),
      supplyResponse.json(),
      proposalResponse.json(),
    ])

    setWorld(worldPayload.world)
    setBuildGraph(buildPayload.buildGraph)
    setSupplyGraph(supplyPayload.supplyGraph)
    setProposals(proposalPayload.proposals)
    setStatus('World synchronized')
  }, [])

  useEffect(() => {
    loadWorld().catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Could not load world')
    })
  }, [loadWorld])

  const selected = useMemo(
    () => world?.entities.find((entity) => entity.id === selectedId) ?? null,
    [selectedId, world],
  )

  const selectedRequirements = useMemo(() => {
    if (!buildGraph || !selected) return []
    return buildGraph.requirements.filter(
      (requirement) =>
        requirement.sourceEntityId === selected.id ||
        requirement.parentEntityId === selected.id,
    )
  }, [buildGraph, selected])

  const selectedSupply = useMemo(() => {
    if (!supplyGraph) return []
    const ids = new Set(selectedRequirements.map((requirement) => requirement.id))
    return supplyGraph.resolutions.filter((resolution) => ids.has(resolution.requirement.id))
  }, [selectedRequirements, supplyGraph])

  const selectedRelations = useMemo(() => {
    if (!world || !selected) return []
    return world.relations.filter(
      (relation) =>
        relation.fromEntityId === selected.id ||
        relation.toEntityId === selected.id,
    )
  }, [selected, world])

  const selectedPowerPort = useMemo(
    () => selected?.ports.find((port) => port.kind === 'electrical.power.in') ?? null,
    [selected],
  )

  const applyMutations = useCallback(async (mutations: WorldMutation[], note?: string) => {
    if (!world) return

    setStatus('Applying transaction...')
    const transaction = createTransaction({
      baseRevision: world.revision,
      actor: human,
      mutations,
      note,
    })

    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    })

    const payload = await response.json()
    if (!response.ok) {
      if (response.status === 409) await loadWorld()
      throw new Error(payload.error ?? 'Transaction failed')
    }

    setWorld(payload.world)
    await loadDerived()
    setStatus(`Revision ${payload.revision} accepted and persisted`)
  }, [loadDerived, loadWorld, world])

  const recordSupplyObservation = useCallback(async (input: Record<string, unknown>) => {
    setStatus('Recording sourcing observation...')
    const response = await fetch('/api/supply-observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error ?? 'Supply observation failed')
    setSupplyGraph(payload.supplyGraph)
    setStatus('Supply Graph refreshed')
  }, [])


  const applyProposal = useCallback(async (proposalId: string) => {
    setStatus('Applying proposal...')
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/apply`, {
      method: 'POST',
    })
    const payload = await response.json()
    if (!response.ok) {
      await loadWorld()
      throw new Error(payload.error ?? 'Proposal apply failed')
    }
    await loadWorld()
    setStatus('Proposal accepted into World')
  }, [loadWorld])

  const discardProposal = useCallback(async (proposalId: string) => {
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Proposal discard failed')
    setProposals((current) => current.filter((item) => item.proposal.id !== proposalId))
    setStatus('Proposal discarded')
  }, [])

  const markOwned = useCallback(async (requirement: BuildRequirement) => {
    await recordSupplyObservation({
      sourceId: 'inventory:owned',
      sourceName: 'Owned inventory',
      sourceKind: 'inventory',
      requirementId: requirement.id,
      quantityAvailable: requirement.quantity,
      unit: requirement.unit,
      notes: 'Recorded manually in Studio',
    })
  }, [recordSupplyObservation])

  const recordLocalCandidate = useCallback(async (requirement: BuildRequirement) => {
    const sourceName = window.prompt('Local source name')
    if (!sourceName?.trim()) return

    const distanceText = window.prompt('Approximate distance in miles (optional)', '')
    const priceText = window.prompt(`Unit price per ${requirement.unit} (optional)`, '')
    const quantityText = window.prompt('Quantity currently available', String(requirement.quantity))

    const distanceMiles = distanceText?.trim() ? Number(distanceText) : undefined
    const unitPrice = priceText?.trim() ? Number(priceText) : undefined
    const quantityAvailable = quantityText?.trim() ? Number(quantityText) : requirement.quantity

    if (!Number.isFinite(quantityAvailable) || quantityAvailable < 0) {
      window.alert('Quantity must be a non-negative number.')
      return
    }

    await recordSupplyObservation({
      sourceId: `local:${sourceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      sourceName: sourceName.trim(),
      sourceKind: 'local-retail',
      requirementId: requirement.id,
      quantityAvailable,
      unit: requirement.unit,
      ...(Number.isFinite(distanceMiles) ? { distanceMiles } : {}),
      ...(Number.isFinite(unitPrice) ? { unitPrice } : {}),
      notes: 'Recorded manually in Studio',
    })
  }, [recordSupplyObservation])

  const startDrawing = useCallback((mode: 'polyline' | 'polygon') => {
    setDrawMode(mode)
    setDraftPoints([])
    setSelectedId(null)
    setStatus(mode === 'polyline'
      ? 'Draw path: click points on the canvas, then Finish.'
      : 'Draw area: click boundary points on the canvas, then Finish.')
  }, [])

  const cancelDrawing = useCallback(() => {
    setDrawMode(null)
    setDraftPoints([])
    setStatus('Drawing cancelled')
  }, [])

  const handleCanvasClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!drawMode) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = snapHalfFoot((event.clientX - bounds.left - CANVAS_ORIGIN_X) / CANVAS_SCALE)
    const y = snapHalfFoot((event.clientY - bounds.top - CANVAS_ORIGIN_Y) / CANVAS_SCALE)
    const nextPoint = { x, y, z: 0 }
    setDraftPoints((current) => [...current, nextPoint])
    setStatus(`${drawMode === 'polyline' ? 'Path' : 'Area'} point added at ${x}, ${y}`)
  }, [drawMode])

  const finishDrawing = useCallback(async () => {
    if (!world || !drawMode) return
    const minimum = drawMode === 'polyline' ? 2 : 3
    if (draftPoints.length < minimum) {
      setStatus(`${drawMode === 'polyline' ? 'Path' : 'Area'} needs at least ${minimum} points`)
      return
    }

    const entity = drawMode === 'polyline'
      ? createPolylineEntity({
          kind: 'geometry.path',
          name: 'Custom path',
          points: draftPoints,
          properties: { fidelity: 'concept', authoredIn: 'studio' },
          actor: human,
        })
      : createPolygonEntity({
          kind: 'geometry.area',
          name: 'Custom area',
          points: draftPoints,
          properties: { fidelity: 'concept', authoredIn: 'studio' },
          actor: human,
        })

    try {
      await applyMutations([{ kind: 'createEntity', entity }], `Draw ${entity.name}`)
      setSelectedId(entity.id)
      setDrawMode(null)
      setDraftPoints([])
      setStatus(`${entity.name} accepted into World`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not finish drawing')
    }
  }, [applyMutations, draftPoints, drawMode, world])

  const addConceptShed = useCallback(async () => {
    if (!world) return
    setStatus('Creating semantic construction shell...')
    const response = await fetch('/api/construction/concept-shed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision: world.revision,
        actor: human,
        name: 'Utility shed',
        width: 12,
        depth: 10,
        wallHeight: 8,
        origin: { x: world.entities.length * 1.5, y: world.entities.length * 0.5, z: 0 },
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (response.status === 409) await loadWorld()
      throw new Error(payload.error ?? 'Concept shed creation failed')
    }
    await loadWorld()
    setStatus('Construction capability created conceptual shed')
  }, [loadWorld, world])

  const addRainwaterSystem = useCallback(async () => {
    if (!world) return
    setStatus('Creating connected rainwater system...')
    const response = await fetch('/api/water/rainwater-system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision: world.revision,
        actor: human,
        name: 'Rainwater system',
        capacityGallons: 1000,
        pipeRunFeet: 12,
        targetFlowGpm: 5,
        origin: { x: world.entities.length * 1.5, y: world.entities.length * 0.5, z: 0 },
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (response.status === 409) await loadWorld()
      throw new Error(payload.error ?? 'Rainwater system creation failed')
    }
    await loadWorld()
    setStatus('Water capability created connected system')
  }, [loadWorld, world])

  const addSolarMicrogrid = useCallback(async () => {
    if (!world) return
    setStatus(selectedPowerPort ? 'Creating solar microgrid and connecting selected load...' : 'Creating solar microgrid...')
    const response = await fetch('/api/energy/solar-microgrid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision: world.revision,
        actor: human,
        name: 'Solar microgrid',
        panelCount: 6,
        panelWatts: 400,
        batteryKwh: 10,
        inverterKw: 5,
        origin: { x: world.entities.length * 1.5, y: world.entities.length * 0.5, z: 0 },
        ...(selected && selectedPowerPort ? {
          loadEntityId: selected.id,
          loadPortId: selectedPowerPort.id,
        } : {}),
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (response.status === 409) await loadWorld()
      throw new Error(payload.error ?? 'Solar microgrid creation failed')
    }
    await loadWorld()
    setStatus(selectedPowerPort ? 'Energy capability connected microgrid to selected load' : 'Energy capability created microgrid')
  }, [loadWorld, selected, selectedPowerPort, world])

  const addThing = useCallback(async (
    kind: string,
    name: string,
    size: { x: number; y: number; z: number },
    properties: Record<string, string | number | boolean | null> = {},
  ) => {
    if (!world) return
    const offset = world.entities.length * 1.5
    const entity = createBoxEntity({
      kind,
      name,
      position: { x: offset, y: offset * 0.35, z: 0 },
      size,
      properties,
      actor: human,
    })
    await applyMutations([{ kind: 'createEntity', entity }], `Create ${name}`)
    setSelectedId(entity.id)
  }, [applyMutations, world])

  const addPart = useCallback(async () => {
    if (!world || !selected) return

    const part = createBoxEntity({
      kind: 'part',
      name: 'Required part',
      parentId: selected.id,
      position: selected.geometry ? geometryAnchor(selected.geometry) : { x: 0, y: 0, z: 0 },
      size: { x: 0.4, y: 0.4, z: 0.4 },
      properties: {
        specification: 'unspecified',
        quantity: 1,
        unit: 'each',
        acquisition: 'unresolved',
      },
      actor: human,
    })

    await applyMutations(
      [{ kind: 'createEntity', entity: part }],
      `Add part requirement to ${selected.name}`,
    )
    setSelectedId(part.id)
  }, [applyMutations, selected, world])

  const setSelectedProperty = useCallback(async (
    key: string,
    value: string | number | boolean | null,
  ) => {
    if (!selected) return
    try {
      await applyMutations([{
        kind: 'setProperty',
        entityId: selected.id,
        key,
        value,
        knowledge: {
          basis: 'chosen',
          confidence: 'high',
          note: 'Edited in Contractor Hub Studio',
        },
      }], `Set ${selected.name} ${key}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update property')
    }
  }, [applyMutations, selected])

  const addSelectedProperty = useCallback(async () => {
    if (!selected) return
    const key = window.prompt('Property name')
    if (!key?.trim()) return
    if (READ_ONLY_PROPERTIES.has(key.trim())) {
      setStatus(`${key.trim()} is owned by the system/capability`)
      return
    }
    const raw = window.prompt('Property value')
    if (raw === null) return

    let value: string | number | boolean | null = raw
    const trimmed = raw.trim()
    if (trimmed === 'true') value = true
    else if (trimmed === 'false') value = false
    else if (trimmed === 'null') value = null
    else if (trimmed !== '' && Number.isFinite(Number(trimmed))) value = Number(trimmed)

    await setSelectedProperty(key.trim(), value)
  }, [selected, setSelectedProperty])

  const moveSelected = useCallback(async (dx: number, dy: number) => {
    if (!selected?.geometry) return
    await applyMutations([{
      kind: 'translateEntity',
      entityId: selected.id,
      delta: { x: dx, y: dy, z: 0 },
    }], `Move ${selected.name}`)
  }, [applyMutations, selected])


  const setSelectedGeometryPoint = useCallback(async (index: number, point: Vec3) => {
    if (!selected?.geometry || selected.geometry.type === 'box') return
    try {
      await applyMutations([{
        kind: 'setGeometryPoint',
        entityId: selected.id,
        index,
        point,
      }], `Edit ${selected.name} vertex ${index + 1}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not edit geometry point')
    }
  }, [applyMutations, selected])

  const insertSelectedGeometryPoint = useCallback(async (index: number) => {
    if (!selected?.geometry || selected.geometry.type === 'box') return
    const points = selected.geometry.points
    const current = points[index]
    if (!current) return

    let next: Vec3
    if (index < points.length - 1) {
      next = points[index + 1]
    } else if (selected.geometry.type === 'polygon') {
      next = points[0]
    } else {
      const previous = points[index - 1] ?? { x: current.x - 1, y: current.y, z: current.z }
      const dx = current.x - previous.x
      const dy = current.y - previous.y
      next = {
        x: current.x + (Math.abs(dx) + Math.abs(dy) < 0.0001 ? 1 : dx),
        y: current.y + (Math.abs(dx) + Math.abs(dy) < 0.0001 ? 0 : dy),
        z: current.z,
      }
    }

    const point = {
      x: snapHalfFoot((current.x + next.x) / 2),
      y: snapHalfFoot((current.y + next.y) / 2),
      z: (current.z + next.z) / 2,
    }

    try {
      await applyMutations([{
        kind: 'insertGeometryPoint',
        entityId: selected.id,
        index: index + 1,
        point,
      }], `Insert vertex into ${selected.name}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not insert geometry point')
    }
  }, [applyMutations, selected])

  const removeSelectedGeometryPoint = useCallback(async (index: number) => {
    if (!selected?.geometry || selected.geometry.type === 'box') return
    try {
      await applyMutations([{
        kind: 'removeGeometryPoint',
        entityId: selected.id,
        index,
      }], `Remove vertex from ${selected.name}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove geometry point')
    }
  }, [applyMutations, selected])

  if (!world) {
    return <main className="loading">{status}</main>
  }

  const children = selected
    ? world.entities.filter((entity) => entity.parentId === selected.id)
    : []

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">CONTRACTOR HUB vNEXT</span>
          <h1>{world.name}</h1>
        </div>
        <div className="world-meta">
          <span>revision {world.revision}</span>
          <span>{world.entities.length} entities</span>
          <span>{buildGraph?.totals.requirementCount ?? 0} requirements</span>
          <span>{supplyGraph?.totals.coveredCount ?? 0} sourced</span>
          <span>{supplyGraph?.totals.unresolvedCount ?? 0} unsourced</span>
          <span>{proposals.length} proposals</span>
          <span className="mcp-badge">MCP /mcp</span>
        </div>
      </header>

      <section className="creation-bar">
        <button
          className={drawMode === 'polyline' ? 'active-tool' : ''}
          onClick={() => startDrawing('polyline')}
        >
          + Draw path
        </button>
        <button
          className={drawMode === 'polygon' ? 'active-tool' : ''}
          onClick={() => startDrawing('polygon')}
        >
          + Draw area
        </button>
        {drawMode && (
          <>
            <button
              onClick={finishDrawing}
              disabled={draftPoints.length < (drawMode === 'polyline' ? 2 : 3)}
            >
              Finish
            </button>
            <button onClick={cancelDrawing}>Cancel</button>
          </>
        )}
        <button onClick={addConceptShed}>
          + Concept shed
        </button>
        <button onClick={addRainwaterSystem}>
          + Rainwater system
        </button>
        <button onClick={addSolarMicrogrid}>
          + Solar microgrid{selectedPowerPort ? ' → selected load' : ''}
        </button>
        <button onClick={() => addThing('equipment', 'Generic equipment', { x: 4, y: 3, z: 4 })}>
          + Equipment
        </button>
        <p>{status}</p>
      </section>

      <section className="workspace">
        <aside className="world-tree">
          <div className="panel-heading">
            <strong>World</strong>
            <small>persistent truth</small>
          </div>
          {world.entities.length === 0 ? (
            <p className="empty-copy">Create the first physical thing. The interface is intentionally sparse.</p>
          ) : (
            <div className="entity-list">
              {world.entities.map((entity) => (
                <button
                  key={entity.id}
                  className={entity.id === selectedId ? 'selected' : ''}
                  onClick={(event) => {
                  event.stopPropagation()
                  setSelectedId(entity.id)
                }}
                >
                  <span>{entity.name}</span>
                  <small>{entity.kind}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section
          className={`world-canvas ${drawMode ? 'is-drawing' : ''}`}
          aria-label="World canvas"
          onClick={handleCanvasClick}
        >
          <div className="canvas-grid" />
          <div className="origin-marker">0,0</div>
          <svg className="shape-layer" aria-label="Path and area geometry">
            {world.entities
              .filter((entity) => entity.geometry && entity.geometry.type !== 'box')
              .map((entity) => {
                const geometry = entity.geometry
                if (!geometry || geometry.type === 'box') return null
                const className = `shape-entity ${entity.id === selectedId ? 'selected' : ''}`
                const handleSelect = () => setSelectedId(entity.id)
                const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleSelect()
                  }
                }

                return (
                  <g
                    key={entity.id}
                    role="button"
                    tabIndex={0}
                    aria-label={entity.name}
                    className={className}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleSelect()
                    }}
                    onKeyDown={handleKeyDown}
                  >
                    {geometry.type === 'polygon' ? (
                      <polygon points={pointsAttribute(entity)} />
                    ) : (
                      <>
                        <polyline className="shape-hit-target" points={pointsAttribute(entity)} />
                        <polyline points={pointsAttribute(entity)} />
                      </>
                    )}
                  </g>
                )
              })}
            {drawMode && draftPoints.length > 0 && (
              <g className="draft-geometry" aria-hidden="true">
                {drawMode === 'polygon' && draftPoints.length >= 3 && (
                  <polygon className="draft-area" points={pointsToAttribute(draftPoints)} />
                )}
                <polyline className="draft-path" points={pointsToAttribute(draftPoints)} />
                {draftPoints.map((point, index) => {
                  const canvas = toCanvasPoint(point)
                  return <circle key={index} cx={canvas.x} cy={canvas.y} r={4} />
                })}
              </g>
            )}
          </svg>
          {world.entities
            .filter((entity) => entity.geometry?.type === 'box')
            .map((entity) => (
              <button
                key={entity.id}
                className={`canvas-entity ${entity.id === selectedId ? 'selected' : ''}`}
                style={entityStyle(entity)}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedId(entity.id)
                }}
                title={entity.kind}
              >
                <strong>{entity.name}</strong>
                <small>{entity.kind}</small>
              </button>
            ))}
          {world.entities.length === 0 && (
            <div className="canvas-empty">
              <span>WORLD CANVAS</span>
              <strong>Make something physical.</strong>
            </div>
          )}
        </section>

        <aside className="inspector">
          <div className="panel-heading">
            <strong>Inspect</strong>
            <small>world → build → supply</small>
          </div>

          <div className="detail-group">
            <h3>Build / Supply</h3>
            <dl>
              <div><dt>requirements</dt><dd>{buildGraph?.totals.requirementCount ?? 0}</dd></div>
              <div><dt>conceptual</dt><dd>{buildGraph?.totals.conceptualCount ?? 0}</dd></div>
              <div><dt>sourced</dt><dd>{supplyGraph?.totals.coveredCount ?? 0}</dd></div>
              <div><dt>partial</dt><dd>{supplyGraph?.totals.partialCount ?? 0}</dd></div>
              <div><dt>unsourced</dt><dd>{supplyGraph?.totals.unresolvedCount ?? 0}</dd></div>
              <div><dt>local candidates</dt><dd>{supplyGraph?.totals.localCandidateCount ?? 0}</dd></div>
              <div><dt>owned candidates</dt><dd>{supplyGraph?.totals.ownedCandidateCount ?? 0}</dd></div>
            </dl>
          </div>


          {proposals.length > 0 && (
            <div className="detail-group">
              <h3>Pending proposals</h3>
              {proposals.map((item) => (
                <div className="proposal-card" key={item.proposal.id}>
                  <div>
                    <strong>{item.proposal.note ?? 'World changes'}</strong>
                    <small>{item.proposal.actor.label ?? item.proposal.actor.id}</small>
                  </div>
                  {item.status === 'ready' && item.diff ? (
                    <small>
                      +{item.diff.createdEntities.length} created ·
                      {' '}{item.diff.changedEntities.length} changed ·
                      {' '}{item.diff.removedEntities.length} removed
                    </small>
                  ) : (
                    <small className="proposal-warning">{item.error ?? 'Proposal is stale or invalid'}</small>
                  )}
                  <div className="requirement-actions">
                    <button
                      disabled={item.status !== 'ready'}
                      onClick={() => applyProposal(item.proposal.id)}
                    >
                      Apply
                    </button>
                    <button onClick={() => discardProposal(item.proposal.id)}>Discard</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!selected ? (
            <p className="empty-copy">Select a thing to inspect its world truth, build requirements, and sourcing state.</p>
          ) : (
            <>
              <div className="identity-card">
                <span>{selected.kind}</span>
                <h2>{selected.name}</h2>
                <code>{selected.id}</code>
              </div>

              {selected.geometry && (
                <div className="detail-group">
                  <h3>Geometry</h3>
                  <dl>
                    <div><dt>type</dt><dd>{selected.geometry.type}</dd></div>
                    {selected.geometry.type === 'box' ? (
                      <>
                        <div><dt>position</dt><dd>{selected.geometry.position.x.toFixed(1)}, {selected.geometry.position.y.toFixed(1)}, {selected.geometry.position.z.toFixed(1)}</dd></div>
                        <div><dt>size</dt><dd>{selected.geometry.size.x} × {selected.geometry.size.y} × {selected.geometry.size.z}</dd></div>
                      </>
                    ) : selected.geometry.type === 'polyline' ? (
                      <>
                        <div><dt>points</dt><dd>{selected.geometry.points.length}</dd></div>
                        <div><dt>length</dt><dd>{polylineLength(selected.geometry.points).toFixed(2)} ft</dd></div>
                      </>
                    ) : (
                      <>
                        <div><dt>points</dt><dd>{selected.geometry.points.length}</dd></div>
                        <div><dt>plan area</dt><dd>{polygonAreaXY(selected.geometry.points).toFixed(2)} sq ft</dd></div>
                      </>
                    )}
                  </dl>
                  <div className="move-pad">
                    <button onClick={() => moveSelected(0, -1)}>↑</button>
                    <button onClick={() => moveSelected(-1, 0)}>←</button>
                    <button onClick={() => moveSelected(1, 0)}>→</button>
                    <button onClick={() => moveSelected(0, 1)}>↓</button>
                  </div>
                  {selected.geometry.type !== 'box' && (
                    <div className="vertex-editor">
                      <h4>Vertices</h4>
                      {selected.geometry.points.map((point, index) => (
                        <GeometryPointRow
                          key={index}
                          point={point}
                          index={index}
                          canRemove={
                            selected.geometry?.type === 'polyline'
                              ? selected.geometry.points.length > 2
                              : selected.geometry?.type === 'polygon'
                                ? selected.geometry.points.length > 3
                                : false
                          }
                          onCommit={setSelectedGeometryPoint}
                          onInsertAfter={insertSelectedGeometryPoint}
                          onRemove={removeSelectedGeometryPoint}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(selected.ports.length > 0 || selectedRelations.length > 0) && (
                <div className="detail-group">
                  <h3>Ports / Connections</h3>
                  {selected.ports.map((port) => (
                    <div className="connection-row" key={port.id}>
                      <span>{port.name}</span>
                      <small>{port.kind}</small>
                    </div>
                  ))}
                  {selectedRelations.map((relation) => {
                    const outbound = relation.fromEntityId === selected.id
                    const otherId = outbound ? relation.toEntityId : relation.fromEntityId
                    const other = world.entities.find((entity) => entity.id === otherId)
                    return (
                      <div className="connection-row" key={relation.id}>
                        <span>{outbound ? '→' : '←'} {other?.name ?? otherId}</span>
                        <small>{relation.kind}</small>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="detail-group">
                <div className="section-heading-row">
                  <h3>Properties</h3>
                  <button className="mini-button" onClick={addSelectedProperty}>+ Property</button>
                </div>
                {Object.keys(selected.properties).length === 0 ? (
                  <p className="muted">No specialized properties yet.</p>
                ) : (
                  <div className="property-editor">
                    {Object.entries(selected.properties).map(([key, value]) => (
                      <PropertyEditorRow
                        key={key}
                        name={key}
                        value={value}
                        knowledge={selected.propertyKnowledge?.[key]}
                        readOnly={READ_ONLY_PROPERTIES.has(key)}
                        onSave={setSelectedProperty}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-group">
                <h3>Composition</h3>
                <button className="full-button" onClick={addPart}>+ Add required part</button>
                {children.map((child) => (
                  <button className="child-part" key={child.id} onClick={() => setSelectedId(child.id)}>
                    <span>{child.name}</span>
                    <small>{child.kind}</small>
                  </button>
                ))}
              </div>

              {selectedRequirements.length > 0 && (
                <div className="detail-group">
                  <h3>Required to build</h3>
                  {selectedRequirements.map((requirement) => {
                    const supply = selectedSupply.find(
                      (resolution) => resolution.requirement.id === requirement.id,
                    )
                    return (
                      <div className="requirement-card" key={requirement.id}>
                        <button
                          className="requirement-select"
                          onClick={() => setSelectedId(requirement.sourceEntityId)}
                        >
                          <span>{requirement.quantity} {requirement.unit} · {requirement.name}</span>
                          <small>{requirement.specification ?? 'specification open'}</small>
                        </button>
                        <div className="requirement-status">
                          <strong>{supply?.status ?? 'unresolved'}</strong>
                          {supply?.preferredCandidate ? (
                            <small>
                              {supply.preferredCandidate.sourceName}
                              {typeof supply.preferredCandidate.distanceMiles === 'number'
                                ? ` · ${supply.preferredCandidate.distanceMiles} mi`
                                : ''}
                            </small>
                          ) : (
                            <small>No source observation yet</small>
                          )}
                        </div>
                        <div className="requirement-actions">
                          <button onClick={() => markOwned(requirement)}>Owned</button>
                          <button onClick={() => recordLocalCandidate(requirement)}>+ Local source</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="provenance">
                <span>provenance</span>
                <strong>{selected.provenance.origin}</strong>
                <small>{selected.provenance.actorId}</small>
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  )
}
