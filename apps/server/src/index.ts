import { resolve } from 'node:path'

import { createMcpExpressApp } from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import {
  constructionCapability,
  createConceptShedTransaction,
} from '../../../capabilities/construction/src/index'
import {
  createRainwaterSystemTransaction,
  waterCapability,
} from '../../../capabilities/water/src/index'
import { deriveBuildGraph } from '../../../packages/build/src/index'
import { CapabilityRegistry } from '../../../packages/capabilities/src/index'
import {
  FileSupplyObservationStore,
  SupplyObservation,
  deriveSupplyGraph,
} from '../../../packages/supply/src/index'
import {
  ActorRef,
  FileProposalStore,
  FileWorldStore,
  PropertyValue,
  WorldMutation,
  WorldTransaction,
  createBoxEntity,
  createEmptyWorld,
  createId,
  createTransaction,
  previewTransaction,
} from '../../../packages/world/src/index'

const PORT = Number(process.env.PORT ?? 3000)
const WORLD_PATH = resolve(process.env.CONTRACTOR_WORLD_PATH ?? '.data/world.json')
const SUPPLY_PATH = resolve(process.env.CONTRACTOR_SUPPLY_PATH ?? '.data/supply-observations.json')
const PROPOSAL_PATH = resolve(process.env.CONTRACTOR_PROPOSAL_PATH ?? '.data/proposals.json')

const store = new FileWorldStore(
  WORLD_PATH,
  createEmptyWorld('Contractor Hub vNext World', 'world-vnext'),
)
const supplyStore = new FileSupplyObservationStore(SUPPLY_PATH)
const proposalStore = new FileProposalStore(PROPOSAL_PATH)
const capabilities = new CapabilityRegistry()
capabilities.register(constructionCapability)
capabilities.register(waterCapability)

const app = createMcpExpressApp({ host: '127.0.0.1' })

function buildGraph() {
  return deriveBuildGraph(
    store.snapshot(),
    new Date().toISOString(),
    capabilities.buildRequirementProviders(),
  )
}

function supplyGraph() {
  return deriveSupplyGraph(buildGraph(), supplyStore.list())
}

function proposalView(proposal: WorldTransaction) {
  try {
    const preview = previewTransaction(store.snapshot(), proposal)
    return {
      status: 'ready' as const,
      proposal,
      diff: preview.diff,
    }
  } catch (error) {
    return {
      status: 'stale-or-invalid' as const,
      proposal,
      error: error instanceof Error ? error.message : 'Proposal is no longer valid',
    }
  }
}

function proposalViews() {
  return proposalStore.list().map(proposalView)
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    revision: store.snapshot().revision,
    persistence: 'file',
    worldPath: WORLD_PATH,
    supplyPath: SUPPLY_PATH,
    proposalPath: PROPOSAL_PATH,
    supplyObservationCount: supplyStore.list().length,
    pendingProposalCount: proposalStore.list().length,
  })
})

app.get('/api/world', (_req, res) => {
  res.json({ world: store.snapshot() })
})

app.get('/api/history', (_req, res) => {
  res.json({ history: store.history() })
})

app.get('/api/build-graph', (_req, res) => {
  res.json({ buildGraph: buildGraph() })
})

app.get('/api/supply-observations', (_req, res) => {
  res.json({ observations: supplyStore.list() })
})

app.get('/api/supply-graph', (_req, res) => {
  res.json({ supplyGraph: supplyGraph() })
})

app.get('/api/proposals', (_req, res) => {
  res.json({ proposals: proposalViews() })
})

app.get('/api/capabilities', (_req, res) => {
  res.json({ capabilities: capabilities.list() })
})

const propertyValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const actorSchema = z.object({
  kind: z.enum(['human', 'agent', 'automation', 'system']),
  id: z.string().min(1),
  label: z.string().optional(),
})

const vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const supplySourceKindSchema = z.enum([
  'inventory',
  'reuse',
  'local-retail',
  'local-trade',
  'local-fabricator',
  'regional',
  'online',
  'self-fabrication',
])

const supplyObservationInputSchema = z.object({
  id: z.string().min(1).optional(),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceKind: supplySourceKindSchema,
  requirementId: z.string().min(1).optional(),
  specification: z.string().optional(),
  name: z.string().optional(),
  quantityAvailable: z.number().nonnegative(),
  unit: z.string().min(1),
  unitPrice: z.number().nonnegative().optional(),
  distanceMiles: z.number().nonnegative().optional(),
  leadTimeDays: z.number().nonnegative().optional(),
  fabricationMethod: z.string().optional(),
  notes: z.string().optional(),
  observedAt: z.string().optional(),
})

const proposalChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('createBox'),
    entityKind: z.string().min(1),
    name: z.string().min(1),
    parentId: z.string().min(1).optional(),
    position: vec3Schema,
    size: vec3Schema,
    properties: z.record(z.string(), propertyValueSchema).optional(),
  }),
  z.object({
    kind: z.literal('moveEntity'),
    entityId: z.string().min(1),
    position: vec3Schema,
  }),
  z.object({
    kind: z.literal('renameEntity'),
    entityId: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal('setProperty'),
    entityId: z.string().min(1),
    key: z.string().min(1),
    value: propertyValueSchema,
  }),
  z.object({
    kind: z.literal('removeProperty'),
    entityId: z.string().min(1),
    key: z.string().min(1),
  }),
  z.object({
    kind: z.literal('removeEntity'),
    entityId: z.string().min(1),
  }),
])

const proposalInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  note: z.string().optional(),
  changes: z.array(proposalChangeSchema).min(1),
})

const conceptShedInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  name: z.string().min(1).optional(),
  width: z.number().positive(),
  depth: z.number().positive(),
  wallHeight: z.number().positive(),
  origin: vec3Schema.optional(),
})

const rainwaterSystemInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  name: z.string().min(1).optional(),
  capacityGallons: z.number().positive(),
  pipeRunFeet: z.number().positive(),
  targetFlowGpm: z.number().positive().optional(),
  origin: vec3Schema.optional(),
})

function normalizeSupplyObservation(
  input: z.infer<typeof supplyObservationInputSchema>,
): SupplyObservation {
  return {
    ...input,
    id: input.id ?? createId('supply-observation'),
    observedAt: input.observedAt ?? new Date().toISOString(),
  }
}

function transactionActor(input?: ActorRef): ActorRef {
  return input ?? { kind: 'agent', id: 'mcp:agent' }
}

function proposalTransaction(
  input: z.infer<typeof proposalInputSchema>,
): WorldTransaction {
  const actor = transactionActor(input.actor)
  const at = new Date().toISOString()
  const mutations: WorldMutation[] = input.changes.map((change) => {
    switch (change.kind) {
      case 'createBox':
        return {
          kind: 'createEntity',
          entity: createBoxEntity({
            kind: change.entityKind,
            name: change.name,
            parentId: change.parentId,
            position: change.position,
            size: change.size,
            properties: change.properties,
            actor,
            at,
          }),
        }
      case 'moveEntity':
        return {
          kind: 'moveEntity',
          entityId: change.entityId,
          position: change.position,
        }
      case 'renameEntity':
        return {
          kind: 'renameEntity',
          entityId: change.entityId,
          name: change.name,
        }
      case 'setProperty':
        return {
          kind: 'setProperty',
          entityId: change.entityId,
          key: change.key,
          value: change.value,
        }
      case 'removeProperty':
        return {
          kind: 'removeProperty',
          entityId: change.entityId,
          key: change.key,
        }
      case 'removeEntity':
        return {
          kind: 'removeEntity',
          entityId: change.entityId,
        }
    }
  })

  return createTransaction({
    id: createId('proposal'),
    baseRevision: input.baseRevision,
    actor,
    mutations,
    note: input.note,
    at,
  })
}

app.post('/api/construction/concept-shed', (req, res) => {
  try {
    const input = conceptShedInputSchema.parse(req.body)
    const actor = input.actor ?? { kind: 'human' as const, id: 'studio:local-human', label: 'Studio user' }
    const transaction = createConceptShedTransaction(input.baseRevision, input, actor)
    const result = store.apply(transaction)
    res.json({
      result,
      buildGraph: buildGraph(),
      supplyGraph: supplyGraph(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Concept shed creation failed'
    const conflict = error instanceof Error && error.name === 'WorldConflictError'
    res.status(conflict ? 409 : 400).json({ error: message })
  }
})

app.post('/api/water/rainwater-system', (req, res) => {
  try {
    const input = rainwaterSystemInputSchema.parse(req.body)
    const actor = input.actor ?? { kind: 'human' as const, id: 'studio:local-human', label: 'Studio user' }
    const transaction = createRainwaterSystemTransaction(input.baseRevision, input, actor)
    const result = store.apply(transaction)
    res.json({
      result,
      buildGraph: buildGraph(),
      supplyGraph: supplyGraph(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rainwater system creation failed'
    const conflict = error instanceof Error && error.name === 'WorldConflictError'
    res.status(conflict ? 409 : 400).json({ error: message })
  }
})

app.post('/api/supply-observations', (req, res) => {
  try {
    const parsed = supplyObservationInputSchema.parse(req.body)
    const observation = supplyStore.record(normalizeSupplyObservation(parsed))
    res.json({
      observation,
      supplyGraph: supplyGraph(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supply observation failed'
    res.status(400).json({ error: message })
  }
})

app.post('/api/proposals', (req, res) => {
  try {
    const input = proposalInputSchema.parse(req.body)
    const proposal = proposalTransaction(input)
    const preview = previewTransaction(store.snapshot(), proposal)
    proposalStore.save(proposal)
    res.json({
      proposal,
      diff: preview.diff,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal failed'
    const conflict = error instanceof Error && error.name === 'WorldConflictError'
    res.status(conflict ? 409 : 400).json({ error: message })
  }
})

app.post('/api/proposals/:id/apply', (req, res) => {
  try {
    const proposal = proposalStore.get(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Unknown proposal' })
    const result = store.apply(proposal)
    proposalStore.remove(proposal.id)
    return res.json({
      result,
      buildGraph: buildGraph(),
      supplyGraph: supplyGraph(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal apply failed'
    const conflict = error instanceof Error && error.name === 'WorldConflictError'
    return res.status(conflict ? 409 : 400).json({ error: message })
  }
})

app.delete('/api/proposals/:id', (req, res) => {
  const removed = proposalStore.remove(req.params.id)
  res.status(removed ? 200 : 404).json({ removed })
})

app.post('/api/transactions', (req, res) => {
  try {
    const transaction = req.body as WorldTransaction
    const result = store.apply(transaction)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaction failed'
    const conflict = error instanceof Error && error.name === 'WorldConflictError'
    res.status(conflict ? 409 : 400).json({ error: message })
  }
})

function worldText() {
  return JSON.stringify(store.snapshot(), null, 2)
}

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({
    name: 'contractor-hub-vnext',
    version: '0.1.0',
  })

  server.registerTool(
    'capabilities_list',
    {
      description: 'List registered Contractor Hub capability packs and their current contribution surface.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(capabilities.list(), null, 2) }],
    }),
  )

  server.registerTool(
    'construction_create_concept_shed',
    {
      description: 'Create a conceptual shed shell through the Construction capability and canonical World transaction path.',
      inputSchema: conceptShedInputSchema,
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const transaction = createConceptShedTransaction(input.baseRevision, input, actor)
      const result = store.apply(transaction)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            result,
            buildGraph: buildGraph(),
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'construction_propose_concept_shed',
    {
      description: 'Create a reviewable conceptual shed proposal without mutating accepted World state.',
      inputSchema: conceptShedInputSchema,
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const proposal = createConceptShedTransaction(input.baseRevision, input, actor)
      const preview = previewTransaction(store.snapshot(), proposal)
      proposalStore.save(proposal)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            proposal,
            diff: preview.diff,
            buildGraphPreview: deriveBuildGraph(
              preview.previewWorld,
              new Date().toISOString(),
              capabilities.buildRequirementProviders(),
            ),
          }, null, 2),
        }],
      }
    },
  )


  server.registerTool(
    'water_create_rainwater_system',
    {
      description: 'Create a conceptual connected rainwater storage, pipe, and pump system through the Water capability.',
      inputSchema: rainwaterSystemInputSchema,
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const transaction = createRainwaterSystemTransaction(input.baseRevision, input, actor)
      const result = store.apply(transaction)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            result,
            buildGraph: buildGraph(),
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'water_propose_rainwater_system',
    {
      description: 'Create a reviewable rainwater-system proposal with explicit ports and fluid connections.',
      inputSchema: rainwaterSystemInputSchema,
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const proposal = createRainwaterSystemTransaction(input.baseRevision, input, actor)
      const preview = previewTransaction(store.snapshot(), proposal)
      proposalStore.save(proposal)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            proposal,
            diff: preview.diff,
            buildGraphPreview: deriveBuildGraph(
              preview.previewWorld,
              new Date().toISOString(),
              capabilities.buildRequirementProviders(),
            ),
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'world_snapshot',
    {
      description: 'Read the current Contractor Hub world and its revision.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: 'text', text: worldText() }],
    }),
  )

  server.registerTool(
    'world_history',
    {
      description: 'Read accepted transaction history for the current local world.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(store.history(), null, 2) }],
    }),
  )

  server.registerTool(
    'world_list_proposals',
    {
      description: 'List pending World proposals with current ready/stale status and structural diffs.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(proposalViews(), null, 2) }],
    }),
  )

  server.registerTool(
    'world_propose_changes',
    {
      description: 'Validate and persist a reviewable multi-change proposal without mutating accepted World state.',
      inputSchema: proposalInputSchema,
    },
    async (input) => {
      const proposal = proposalTransaction(input)
      const preview = previewTransaction(store.snapshot(), proposal)
      proposalStore.save(proposal)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            proposal,
            diff: preview.diff,
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'world_apply_proposal',
    {
      description: 'Apply one pending proposal if its base revision is still current.',
      inputSchema: z.object({ proposalId: z.string().min(1) }),
    },
    async ({ proposalId }) => {
      const proposal = proposalStore.get(proposalId)
      if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`)
      const result = store.apply(proposal)
      proposalStore.remove(proposalId)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    'world_discard_proposal',
    {
      description: 'Discard a pending proposal without changing accepted World state.',
      inputSchema: z.object({ proposalId: z.string().min(1) }),
    },
    async ({ proposalId }) => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ removed: proposalStore.remove(proposalId) }),
      }],
    }),
  )

  server.registerTool(
    'build_graph',
    {
      description: 'Derive the current Build Graph of required parts and materials from the accepted World.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify(buildGraph(), null, 2),
      }],
    }),
  )

  server.registerTool(
    'supply_graph',
    {
      description: 'Derive local-first sourcing resolutions from the Build Graph and current supply observations.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify(supplyGraph(), null, 2),
      }],
    }),
  )

  server.registerTool(
    'supply_observations',
    {
      description: 'Read current timestamped inventory, local supplier, fabrication, regional, and online observations.',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify(supplyStore.list(), null, 2),
      }],
    }),
  )

  server.registerTool(
    'supply_record_observation',
    {
      description: 'Record a timestamped sourcing observation without mutating canonical World design truth.',
      inputSchema: supplyObservationInputSchema,
    },
    async (input) => {
      const observation = supplyStore.record(normalizeSupplyObservation(input))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            observation,
            supplyGraph: supplyGraph(),
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'world_create_box',
    {
      description: 'Create a physical entity with simple box geometry through the canonical transaction path.',
      inputSchema: z.object({
        baseRevision: z.number().int().nonnegative(),
        actor: actorSchema.optional(),
        kind: z.string().min(1),
        name: z.string().min(1),
        parentId: z.string().optional(),
        position: vec3Schema,
        size: vec3Schema,
        properties: z.record(z.string(), propertyValueSchema).optional(),
      }),
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const entity = createBoxEntity({
        kind: input.kind,
        name: input.name,
        parentId: input.parentId,
        position: input.position,
        size: input.size,
        properties: input.properties,
        actor,
      })
      const result = store.apply(createTransaction({
        baseRevision: input.baseRevision,
        actor,
        mutations: [{ kind: 'createEntity', entity }],
        note: 'MCP create box',
      }))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ entityId: entity.id, revision: result.revision, world: result.world }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'world_move_entity',
    {
      description: 'Move an existing entity through the canonical transaction path.',
      inputSchema: z.object({
        baseRevision: z.number().int().nonnegative(),
        actor: actorSchema.optional(),
        entityId: z.string().min(1),
        position: vec3Schema,
      }),
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const result = store.apply(createTransaction({
        baseRevision: input.baseRevision,
        actor,
        mutations: [{
          kind: 'moveEntity',
          entityId: input.entityId,
          position: input.position,
        }],
        note: 'MCP move entity',
      }))
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    'world_set_property',
    {
      description: 'Set one primitive property on an existing entity.',
      inputSchema: z.object({
        baseRevision: z.number().int().nonnegative(),
        actor: actorSchema.optional(),
        entityId: z.string().min(1),
        key: z.string().min(1),
        value: propertyValueSchema,
      }),
    },
    async (input) => {
      const actor = transactionActor(input.actor)
      const value: PropertyValue = input.value
      const result = store.apply(createTransaction({
        baseRevision: input.baseRevision,
        actor,
        mutations: [{
          kind: 'setProperty',
          entityId: input.entityId,
          key: input.key,
          value,
        }],
        note: 'MCP set property',
      }))
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  return server
})

const nodeMcpHandler = toNodeHandler(mcpHandler)
app.all('/mcp', (req, res) => void nodeMcpHandler(req, res, req.body))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Contractor Hub vNext server listening on http://127.0.0.1:${PORT}`)
  console.log(`World persistence: ${WORLD_PATH}`)
  console.log(`Supply observations: ${SUPPLY_PATH}`)
  console.log(`Pending proposals: ${PROPOSAL_PATH}`)
  console.log(`MCP endpoint: http://127.0.0.1:${PORT}/mcp`)
})
