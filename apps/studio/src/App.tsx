import { useCallback, useEffect, useMemo, useState } from 'react'

import type { BuildGraph } from '../../../packages/build/src/index'
import {
  ActorRef,
  WorldDocument,
  WorldEntity,
  WorldMutation,
  createBoxEntity,
  createTransaction,
} from '../../../packages/world/src/index'

const human: ActorRef = {
  kind: 'human',
  id: 'studio:local-human',
  label: 'Studio user',
}

function entityStyle(entity: WorldEntity) {
  const geometry = entity.geometry
  if (!geometry || geometry.type !== 'box') return undefined

  const scale = 12
  return {
    left: 360 + geometry.position.x * scale,
    top: 260 + geometry.position.y * scale,
    width: Math.max(28, geometry.size.x * scale),
    height: Math.max(28, geometry.size.y * scale),
  }
}

export function App() {
  const [world, setWorld] = useState<WorldDocument | null>(null)
  const [buildGraph, setBuildGraph] = useState<BuildGraph | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('Connecting to world...')

  const loadBuildGraph = useCallback(async () => {
    const response = await fetch('/api/build-graph')
    if (!response.ok) throw new Error('Could not derive Build Graph')
    const payload = await response.json()
    setBuildGraph(payload.buildGraph)
  }, [])

  const loadWorld = useCallback(async () => {
    const [worldResponse, graphResponse] = await Promise.all([
      fetch('/api/world'),
      fetch('/api/build-graph'),
    ])

    if (!worldResponse.ok) throw new Error('Could not load world')
    if (!graphResponse.ok) throw new Error('Could not derive Build Graph')

    const [worldPayload, graphPayload] = await Promise.all([
      worldResponse.json(),
      graphResponse.json(),
    ])

    setWorld(worldPayload.world)
    setBuildGraph(graphPayload.buildGraph)
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
    await loadBuildGraph()
    setStatus(`Revision ${payload.revision} accepted and persisted`)
  }, [loadBuildGraph, loadWorld, world])

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
      position: selected.geometry?.position ?? { x: 0, y: 0, z: 0 },
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

  const moveSelected = useCallback(async (dx: number, dy: number) => {
    if (!selected?.geometry) return
    const current = selected.geometry.position
    await applyMutations([{
      kind: 'moveEntity',
      entityId: selected.id,
      position: {
        x: current.x + dx,
        y: current.y + dy,
        z: current.z,
      },
    }], `Move ${selected.name}`)
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
          <span>{buildGraph?.totals.unresolvedCount ?? 0} unresolved</span>
          <span className="mcp-badge">MCP /mcp</span>
        </div>
      </header>

      <section className="creation-bar">
        <button onClick={() => addThing('structure', 'Utility shed', { x: 12, y: 10, z: 9 }, { fidelity: 'concept' })}>
          + Utility shed
        </button>
        <button onClick={() => addThing('equipment.water-storage', 'Rainwater tank', { x: 5, y: 5, z: 7 }, { capacityGallons: 1000 })}>
          + Water tank
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
                  onClick={() => setSelectedId(entity.id)}
                >
                  <span>{entity.name}</span>
                  <small>{entity.kind}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="world-canvas" aria-label="World canvas">
          <div className="canvas-grid" />
          <div className="origin-marker">0,0</div>
          {world.entities.filter((entity) => entity.geometry).map((entity) => (
            <button
              key={entity.id}
              className={`canvas-entity ${entity.id === selectedId ? 'selected' : ''}`}
              style={entityStyle(entity)}
              onClick={() => setSelectedId(entity.id)}
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
            <small>world → build</small>
          </div>

          <div className="detail-group">
            <h3>Build Graph</h3>
            <dl>
              <div><dt>requirements</dt><dd>{buildGraph?.totals.requirementCount ?? 0}</dd></div>
              <div><dt>unresolved sourcing</dt><dd>{buildGraph?.totals.unresolvedCount ?? 0}</dd></div>
              <div><dt>world revision</dt><dd>{buildGraph?.worldRevision ?? world.revision}</dd></div>
            </dl>
          </div>

          {!selected ? (
            <p className="empty-copy">Select a thing to inspect its current world truth and build requirements.</p>
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
                    <div><dt>position</dt><dd>{selected.geometry.position.x.toFixed(1)}, {selected.geometry.position.y.toFixed(1)}, {selected.geometry.position.z.toFixed(1)}</dd></div>
                    <div><dt>size</dt><dd>{selected.geometry.size.x} × {selected.geometry.size.y} × {selected.geometry.size.z}</dd></div>
                  </dl>
                  <div className="move-pad">
                    <button onClick={() => moveSelected(0, -1)}>↑</button>
                    <button onClick={() => moveSelected(-1, 0)}>←</button>
                    <button onClick={() => moveSelected(1, 0)}>→</button>
                    <button onClick={() => moveSelected(0, 1)}>↓</button>
                  </div>
                </div>
              )}

              <div className="detail-group">
                <h3>Properties</h3>
                {Object.keys(selected.properties).length === 0 ? (
                  <p className="muted">No specialized properties yet.</p>
                ) : (
                  <dl>
                    {Object.entries(selected.properties).map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>
                    ))}
                  </dl>
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
                  {selectedRequirements.map((requirement) => (
                    <button
                      className="child-part"
                      key={requirement.id}
                      onClick={() => setSelectedId(requirement.sourceEntityId)}
                    >
                      <span>{requirement.quantity} {requirement.unit} · {requirement.name}</span>
                      <small>{requirement.acquisition} · {requirement.specification ?? 'specification open'}</small>
                    </button>
                  ))}
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
