import assert from 'node:assert/strict'
import test from 'node:test'

import type { BuildGraph } from '../../build/src/index'
import { deriveSupplyGraph, type SupplyObservation } from '../src/index'

const buildGraph: BuildGraph = {
  worldId: 'world-test',
  worldRevision: 4,
  generatedAt: '2026-09-22T00:00:00.000Z',
  requirements: [{
    id: 'requirement:bolt',
    sourceEntityId: 'bolt',
    parentEntityId: 'pump',
    kind: 'part',
    name: 'Mounting bolt',
    specification: '1/4-20 stainless',
    quantity: 4,
    unit: 'each',
    acquisition: 'unresolved',
  }],
  totals: {
    requirementCount: 1,
    unresolvedCount: 1,
    conceptualCount: 0,
  },
}

function observation(input: Partial<SupplyObservation> & Pick<SupplyObservation, 'id' | 'sourceKind' | 'sourceName'>): SupplyObservation {
  return {
    sourceId: input.id,
    observedAt: '2026-09-22T01:00:00.000Z',
    quantityAvailable: 10,
    unit: 'each',
    requirementId: 'requirement:bolt',
    ...input,
  }
}

test('owned inventory outranks local and online candidates', () => {
  const graph = deriveSupplyGraph(buildGraph, [
    observation({ id: 'online', sourceKind: 'online', sourceName: 'Online supplier', unitPrice: 0.5 }),
    observation({ id: 'local', sourceKind: 'local-trade', sourceName: 'Local fastener shop', distanceMiles: 4, unitPrice: 0.8 }),
    observation({ id: 'owned', sourceKind: 'inventory', sourceName: 'Truck inventory' }),
  ])

  const resolution = graph.resolutions[0]
  assert.equal(resolution.status, 'covered')
  assert.equal(resolution.preferredCandidate?.sourceKind, 'inventory')
  assert.equal(graph.totals.localCandidateCount, 1)
  assert.equal(graph.totals.ownedCandidateCount, 1)
})

test('local sources outrank online sources when inventory is absent', () => {
  const graph = deriveSupplyGraph(buildGraph, [
    observation({ id: 'online', sourceKind: 'online', sourceName: 'Online supplier', unitPrice: 0.25 }),
    observation({ id: 'local', sourceKind: 'local-retail', sourceName: 'Nearby store', distanceMiles: 6, unitPrice: 1.25 }),
  ])

  assert.equal(graph.resolutions[0].preferredCandidate?.sourceKind, 'local-retail')
})

test('partial quantity remains explicit', () => {
  const graph = deriveSupplyGraph(buildGraph, [
    observation({
      id: 'partial',
      sourceKind: 'local-trade',
      sourceName: 'Local fastener shop',
      quantityAvailable: 2,
    }),
  ])

  assert.equal(graph.resolutions[0].status, 'partial')
})

test('similar-looking observations do not become substitutions without an explicit or exact match', () => {
  const graph = deriveSupplyGraph(buildGraph, [{
    id: 'wrong-bolt',
    sourceId: 'store',
    sourceName: 'Nearby store',
    sourceKind: 'local-retail',
    observedAt: '2026-09-22T01:00:00.000Z',
    name: 'Mounting bolts',
    specification: '1/4-20 zinc',
    quantityAvailable: 100,
    unit: 'each',
  }])

  assert.equal(graph.resolutions[0].status, 'unresolved')
  assert.equal(graph.resolutions[0].candidates.length, 0)
})
