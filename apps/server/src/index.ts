import { resolve } from 'node:path'

import { createMcpExpressApp } from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import * as z from 'zod/v4'

import {
  constructionCapability,
  createConceptShedTransaction,
} from '../../../capabilities/construction/src/index'
import {
  createSolarMicrogridTransaction,
  energyCapability,
} from '../../../capabilities/energy/src/index'
import {
  createRainwaterSystemTransaction,
  waterCapability,
} from '../../../capabilities/water/src/index'
import { CapabilityRegistry } from '../../../packages/capabilities/src/index'
import {
  previewTransaction,
  type WorldTransaction,
} from '../../../packages/world/src/index'
import {
  conceptShedInputSchema,
  proposalInputSchema,
  rainwaterSystemInputSchema,
  solarMicrogridInputSchema,
  supplyObservationInputSchema,
} from './contracts'
import {
  normalizeSupplyObservation,
  proposalViews,
} from './helpers'
import { createContractorMcpHandler } from './mcp'
import { ProjectRuntimeManager } from './projectRuntime'

const PORT = Number(process.env.PORT ?? 3000)
const DATA_ROOT = resolve(process.env.CONTRACTOR_DATA_ROOT ?? '.data')

const capabilities = new CapabilityRegistry()
capabilities.register(constructionCapability)
capabilities.register(waterCapability)
capabilities.register(energyCapability)

const projects = new ProjectRuntimeManager(
  DATA_ROOT,
  capabilities.buildRequirementProviders(),
)

const app = createMcpExpressApp({ host: '127.0.0.1' })

function projectIdFrom(params: Record<string, unknown>): string {
  return String(params.projectId ?? '')
}

function errorResponse(
  res: { status: (code: number) => { json: (value: unknown) => unknown } },
  error: unknown,
  fallback: string,
) {
  const message = error instanceof Error ? error.message : fallback
  const code =
    error instanceof Error && error.name === 'WorldConflictError'
      ? 409
      : message.startsWith('Unknown project:')
        ? 404
        : 400
  return res.status(code).json({ error: message })
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    persistence: 'file',
    dataRoot: DATA_ROOT,
    projectCount: projects.list().length,
  })
})

app.get('/api/projects', (_req, res) => {
  res.json({ projects: projects.list() })
})

app.post('/api/projects', (req, res) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const project = projects.create(name)
    res.json({
      project,
      world: projects.runtime(project.id).store.snapshot(),
    })
  } catch (error) {
    errorResponse(res, error, 'Project creation failed')
  }
})

app.get('/api/capabilities', (_req, res) => {
  res.json({ capabilities: capabilities.list() })
})

app.get('/api/projects/:projectId/world', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({
      project: projects.registry.require(projectId),
      world: projects.runtime(projectId).store.snapshot(),
    })
  } catch (error) {
    errorResponse(res, error, 'World load failed')
  }
})

app.get('/api/projects/:projectId/history', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({ history: projects.runtime(projectId).store.history() })
  } catch (error) {
    errorResponse(res, error, 'History load failed')
  }
})

app.get('/api/projects/:projectId/build-graph', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({ buildGraph: projects.buildGraph(projectId) })
  } catch (error) {
    errorResponse(res, error, 'Build Graph failed')
  }
})

app.get('/api/projects/:projectId/supply-observations', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({
      observations: projects.runtime(projectId).supplyStore.list(),
    })
  } catch (error) {
    errorResponse(res, error, 'Supply observations failed')
  }
})

app.get('/api/projects/:projectId/supply-graph', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({ supplyGraph: projects.supplyGraph(projectId) })
  } catch (error) {
    errorResponse(res, error, 'Supply Graph failed')
  }
})

app.get('/api/projects/:projectId/proposals', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    res.json({ proposals: proposalViews(projects, projectId) })
  } catch (error) {
    errorResponse(res, error, 'Proposal load failed')
  }
})

app.post('/api/projects/:projectId/supply-observations', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const input = supplyObservationInputSchema.parse(req.body)
    const observation = projects.recordSupply(
      projectId,
      normalizeSupplyObservation(projects, projectId, input),
    )
    res.json({
      observation,
      supplyGraph: projects.supplyGraph(projectId),
    })
  } catch (error) {
    errorResponse(res, error, 'Supply observation failed')
  }
})

app.post('/api/projects/:projectId/proposals', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const input = proposalInputSchema.parse(req.body)
    const proposal = (await import('./contracts')).proposalTransaction(input)
    const preview = previewTransaction(
      projects.runtime(projectId).store.snapshot(),
      proposal,
    )
    projects.runtime(projectId).proposalStore.save(proposal)
    res.json({
      proposal,
      diff: preview.diff,
    })
  } catch (error) {
    errorResponse(res, error, 'Proposal failed')
  }
})

app.post('/api/projects/:projectId/proposals/:id/apply', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const runtime = projects.runtime(projectId)
    const proposal = runtime.proposalStore.get(String(req.params.id))
    if (!proposal) return res.status(404).json({ error: 'Unknown proposal' })

    const result = projects.apply(projectId, proposal)
    runtime.proposalStore.remove(proposal.id)
    return res.json({
      result,
      buildGraph: projects.buildGraph(projectId),
      supplyGraph: projects.supplyGraph(projectId),
    })
  } catch (error) {
    return errorResponse(res, error, 'Proposal apply failed')
  }
})

app.delete('/api/projects/:projectId/proposals/:id', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const removed = projects.runtime(projectId).proposalStore.remove(
      String(req.params.id),
    )
    res.status(removed ? 200 : 404).json({ removed })
  } catch (error) {
    errorResponse(res, error, 'Proposal discard failed')
  }
})

app.post('/api/projects/:projectId/transactions', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const result = projects.apply(projectId, req.body as WorldTransaction)
    res.json(result)
  } catch (error) {
    errorResponse(res, error, 'Transaction failed')
  }
})

app.post('/api/projects/:projectId/construction/concept-shed', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const input = conceptShedInputSchema.parse(req.body)
    const actor = input.actor ?? {
      kind: 'human' as const,
      id: 'studio:local-human',
      label: 'Studio user',
    }
    const transaction = createConceptShedTransaction(
      input.baseRevision,
      input,
      actor,
    )
    const result = projects.apply(projectId, transaction)
    res.json({
      result,
      buildGraph: projects.buildGraph(projectId),
      supplyGraph: projects.supplyGraph(projectId),
    })
  } catch (error) {
    errorResponse(res, error, 'Concept shed creation failed')
  }
})

app.post('/api/projects/:projectId/water/rainwater-system', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const input = rainwaterSystemInputSchema.parse(req.body)
    const actor = input.actor ?? {
      kind: 'human' as const,
      id: 'studio:local-human',
      label: 'Studio user',
    }
    const transaction = createRainwaterSystemTransaction(
      input.baseRevision,
      input,
      actor,
    )
    const result = projects.apply(projectId, transaction)
    res.json({
      result,
      buildGraph: projects.buildGraph(projectId),
      supplyGraph: projects.supplyGraph(projectId),
    })
  } catch (error) {
    errorResponse(res, error, 'Rainwater system creation failed')
  }
})

app.post('/api/projects/:projectId/energy/solar-microgrid', (req, res) => {
  try {
    const projectId = projectIdFrom(req.params)
    const input = solarMicrogridInputSchema.parse(req.body)
    const actor = input.actor ?? {
      kind: 'human' as const,
      id: 'studio:local-human',
      label: 'Studio user',
    }
    const transaction = createSolarMicrogridTransaction(
      input.baseRevision,
      input,
      actor,
    )
    const result = projects.apply(projectId, transaction)
    res.json({
      result,
      buildGraph: projects.buildGraph(projectId),
      supplyGraph: projects.supplyGraph(projectId),
    })
  } catch (error) {
    errorResponse(res, error, 'Solar microgrid creation failed')
  }
})

const nodeMcpHandler = toNodeHandler(
  createContractorMcpHandler(projects, capabilities),
)

app.all('/mcp', (req, res) => {
  void nodeMcpHandler(req, res, req.body)
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Contractor Hub vNext server listening on http://127.0.0.1:${PORT}`)
  console.log(`Projects: ${projects.list().length} under ${DATA_ROOT}`)
  console.log(`MCP endpoint: http://127.0.0.1:${PORT}/mcp`)
})
