import { resolve } from 'node:path'

import { createMcpExpressApp } from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import { deriveBuildGraph } from '../../../packages/build/src/index'
import {
  FileSupplyObservationStore,
  SupplyObservation,
  deriveSupplyGraph,
} from '../../../packages/supply/src/index'
import {
  ActorRef,
  FileWorldStore,
  PropertyValue,
  WorldTransaction,
  createBoxEntity,
  createEmptyWorld,
  createId,
  createTransaction,
} from '../../../packages/world/src/index'

const PORT = Number(process.env.PORT ?? 3000)
const WORLD_PATH = resolve(process.env.CONTRACTOR_WORLD_PATH ?? '.data/world.json')
const SUPPLY_PATH = resolve(process.env.CONTRACTOR_SUPPLY_PATH ?? '.data/supply-observations.json')

const store = new FileWorldStore(
  WORLD_PATH,
  createEmptyWorld('Contractor Hub vNext World', 'world-vnext'),
)
const supplyStore = new FileSupplyObservationStore(SUPPLY_PATH)

const app = createMcpExpressApp({ host: '127.0.0.1' })

function buildGraph() {
  return deriveBuildGraph(store.snapshot())
}

function supplyGraph() {
  return deriveSupplyGraph(buildGraph(), supplyStore.list())
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    revision: store.snapshot().revision,
    persistence: 'file',
    worldPath: WORLD_PATH,
    supplyPath: SUPPLY_PATH,
    supplyObservationCount: supplyStore.list().length,
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

function normalizeSupplyObservation(
  input: z.infer<typeof supplyObservationInputSchema>,
): SupplyObservation {
  return {
    ...input,
    id: input.id ?? createId('supply-observation'),
    observedAt: input.observedAt ?? new Date().toISOString(),
  }
}

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

function transactionActor(input?: ActorRef): ActorRef {
  return input ?? { kind: 'agent', id: 'mcp:agent' }
}

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({
    name: 'contractor-hub-vnext',
    version: '0.1.0',
  })

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
        properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
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
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
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
  console.log(`MCP endpoint: http://127.0.0.1:${PORT}/mcp`)
})
