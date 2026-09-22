import { useCallback, useEffect, useMemo, useState } from 'react'

import type { BuildGraph, BuildRequirement } from '../../../packages/build/src/index'
import type { SupplyGraph } from '../../../packages/supply/src/index'
import {
  ActorRef,
  WorldDiff,
  WorldDocument,
  WorldEntity,
  WorldMutation,
  WorldTransaction,
  createBoxEntity,
  createTransaction,
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
  const [supplyGraph, setSupplyGraph] = useState<SupplyGraph | null>(null)
  const [proposals, setProposals] = useState<ProposalView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
          <span>{supplyGraph?.totals.coveredCount ?? 0} sourced</span>
          <span>{supplyGraph?.totals.unresolvedCount ?? 0} unsourced</span>
          <span>{proposals.length} proposals</span>
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
            <small>world → build → supply</small>
          </div>

          <div className="detail-group">
            <h3>Build / Supply</h3>
            <dl>
              <div><dt>requirements</dt><dd>{buildGraph?.totals.requirementCount ?? 0}</dd></div>
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
