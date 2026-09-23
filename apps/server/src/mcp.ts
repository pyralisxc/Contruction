import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import {
  constructionCapability,
  createConceptShedTransaction,
} from '../../../capabilities/construction/src/index'
import {
  createSolarMicrogridTransaction,
} from '../../../capabilities/energy/src/index'
import {
  createRainwaterSystemTransaction,
} from '../../../capabilities/water/src/index'
import { deriveBuildGraph } from '../../../packages/build/src/index'
import type { CapabilityRegistry } from '../../../packages/capabilities/src/index'
import {
  createBoxEntity,
  createId,
  createPolygonEntity,
  createPolylineEntity,
  createTransaction,
  previewTransaction,
  type PropertyValue,
} from '../../../packages/world/src/index'
import {
  actorSchema,
  mcpConceptShedInputSchema,
  mcpProposalInputSchema,
  mcpRainwaterSystemInputSchema,
  mcpSolarMicrogridInputSchema,
  mcpSupplyObservationInputSchema,
  portInputSchema,
  primitivePropertiesSchema,
  projectIdSchema,
  propertyKnowledgeInputSchema,
  propertyValueSchema,
  proposalTransaction,
  transactionActor,
  vec3Schema,
} from './contracts'
import {
  normalizeSupplyObservation,
  proposalViews,
} from './helpers'
import type { ProjectRuntimeManager } from './projectRuntime'

export function createContractorMcpHandler(
  projects: ProjectRuntimeManager,
  capabilities: CapabilityRegistry,
) {
  return createMcpHandler(() => {
    const server = new McpServer({
      name: 'contractor-hub-vnext',
      version: '0.1.0',
    })

    server.registerTool(
      'projects_list',
      {
        description: 'List Contractor Hub projects available to this local runtime.',
        inputSchema: z.object({}),
      },
      async () => ({
        content: [{ type: 'text', text: JSON.stringify(projects.list(), null, 2) }],
      }),
    )

    server.registerTool(
      'projects_create',
      {
        description: 'Create a new isolated Contractor Hub project.',
        inputSchema: z.object({ name: z.string().min(1) }),
      },
      async ({ name }) => {
        const project = projects.create(name)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              project,
              world: projects.runtime(project.id).store.snapshot(),
            }, null, 2),
          }],
        }
      },
    )

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
      'world_snapshot',
      {
        description: 'Read one project World and its revision.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(projects.runtime(projectId).store.snapshot(), null, 2),
        }],
      }),
    )

    server.registerTool(
      'world_history',
      {
        description: 'Read accepted transaction history for one project World.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(projects.runtime(projectId).store.history(), null, 2),
        }],
      }),
    )

    server.registerTool(
      'world_list_proposals',
      {
        description: 'List one project pending World proposals with ready/stale status and structural diffs.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(proposalViews(projects, projectId), null, 2),
        }],
      }),
    )

    server.registerTool(
      'world_propose_changes',
      {
        description: 'Validate and persist a reviewable multi-change proposal in one explicit project without mutating accepted World state.',
        inputSchema: mcpProposalInputSchema,
      },
      async (input) => {
        const { projectId, ...proposalInput } = input
        const proposal = proposalTransaction(proposalInput)
        const preview = previewTransaction(
          projects.runtime(projectId).store.snapshot(),
          proposal,
        )
        projects.runtime(projectId).proposalStore.save(proposal)
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
      'world_apply_proposal',
      {
        description: 'Apply one pending proposal to its explicit project if the base revision is still current.',
        inputSchema: z.object({
          projectId: projectIdSchema,
          proposalId: z.string().min(1),
        }),
      },
      async ({ projectId, proposalId }) => {
        const runtime = projects.runtime(projectId)
        const proposal = runtime.proposalStore.get(proposalId)
        if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`)
        const result = projects.apply(projectId, proposal)
        runtime.proposalStore.remove(proposalId)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    server.registerTool(
      'world_discard_proposal',
      {
        description: 'Discard one pending proposal from an explicit project without changing World state.',
        inputSchema: z.object({
          projectId: projectIdSchema,
          proposalId: z.string().min(1),
        }),
      },
      async ({ projectId, proposalId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            removed: projects.runtime(projectId).proposalStore.remove(proposalId),
          }),
        }],
      }),
    )

    server.registerTool(
      'build_graph',
      {
        description: 'Derive one project Build Graph of required parts and materials.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(projects.buildGraph(projectId), null, 2),
        }],
      }),
    )

    server.registerTool(
      'supply_graph',
      {
        description: 'Derive one project local-first sourcing resolutions from Build requirements and current observations.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(projects.supplyGraph(projectId), null, 2),
        }],
      }),
    )

    server.registerTool(
      'supply_observations',
      {
        description: 'Read one project timestamped inventory, local supplier, fabrication, regional, and online observations.',
        inputSchema: z.object({ projectId: projectIdSchema }),
      },
      async ({ projectId }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify(projects.runtime(projectId).supplyStore.list(), null, 2),
        }],
      }),
    )

    server.registerTool(
      'supply_record_observation',
      {
        description: 'Record a timestamped sourcing observation in one project without mutating canonical World design truth.',
        inputSchema: mcpSupplyObservationInputSchema,
      },
      async (input) => {
        const { projectId, ...observationInput } = input
        const observation = projects.recordSupply(
          projectId,
          normalizeSupplyObservation(projects, projectId, observationInput),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              observation,
              supplyGraph: projects.supplyGraph(projectId),
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'construction_create_concept_shed',
      {
        description: 'Create a conceptual shed shell in one explicit project through the Construction capability.',
        inputSchema: mcpConceptShedInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const transaction = createConceptShedTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const result = projects.apply(projectId, transaction)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              result,
              buildGraph: projects.buildGraph(projectId),
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'construction_propose_concept_shed',
      {
        description: 'Create a reviewable conceptual shed proposal in one explicit project.',
        inputSchema: mcpConceptShedInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const proposal = createConceptShedTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const preview = previewTransaction(
          projects.runtime(projectId).store.snapshot(),
          proposal,
        )
        projects.runtime(projectId).proposalStore.save(proposal)
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
        description: 'Create a conceptual connected rainwater system in one explicit project.',
        inputSchema: mcpRainwaterSystemInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const transaction = createRainwaterSystemTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const result = projects.apply(projectId, transaction)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              result,
              buildGraph: projects.buildGraph(projectId),
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'water_propose_rainwater_system',
      {
        description: 'Create a reviewable rainwater-system proposal in one explicit project.',
        inputSchema: mcpRainwaterSystemInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const proposal = createRainwaterSystemTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const preview = previewTransaction(
          projects.runtime(projectId).store.snapshot(),
          proposal,
        )
        projects.runtime(projectId).proposalStore.save(proposal)
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
      'energy_create_solar_microgrid',
      {
        description: 'Create a conceptual solar/battery/inverter/distribution system in one explicit project.',
        inputSchema: mcpSolarMicrogridInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const transaction = createSolarMicrogridTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const result = projects.apply(projectId, transaction)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              result,
              buildGraph: projects.buildGraph(projectId),
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'energy_propose_solar_microgrid',
      {
        description: 'Create a reviewable solar microgrid proposal in one explicit project.',
        inputSchema: mcpSolarMicrogridInputSchema,
      },
      async (input) => {
        const { projectId, ...domainInput } = input
        const actor = transactionActor(input.actor)
        const proposal = createSolarMicrogridTransaction(
          input.baseRevision,
          domainInput,
          actor,
        )
        const preview = previewTransaction(
          projects.runtime(projectId).store.snapshot(),
          proposal,
        )
        projects.runtime(projectId).proposalStore.save(proposal)
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

    const projectMutationBase = {
      projectId: projectIdSchema,
      baseRevision: z.number().int().nonnegative(),
      actor: actorSchema.optional(),
    }

    server.registerTool(
      'world_create_box',
      {
        description: 'Create a box entity in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          kind: z.string().min(1),
          name: z.string().min(1),
          parentId: z.string().optional(),
          position: vec3Schema,
          size: vec3Schema,
          properties: primitivePropertiesSchema.optional(),
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
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{ kind: 'createEntity', entity }],
            note: 'MCP create box',
          }),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entityId: entity.id,
              revision: result.revision,
              world: result.world,
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'world_create_polyline',
      {
        description: 'Create a path-like entity in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          kind: z.string().min(1),
          name: z.string().min(1),
          parentId: z.string().optional(),
          points: z.array(vec3Schema).min(2),
          properties: primitivePropertiesSchema.optional(),
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const entity = createPolylineEntity({
          kind: input.kind,
          name: input.name,
          parentId: input.parentId,
          points: input.points,
          properties: input.properties,
          actor,
        })
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{ kind: 'createEntity', entity }],
            note: 'MCP create polyline',
          }),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entityId: entity.id,
              revision: result.revision,
              world: result.world,
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'world_create_polygon',
      {
        description: 'Create an area-like entity in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          kind: z.string().min(1),
          name: z.string().min(1),
          parentId: z.string().optional(),
          points: z.array(vec3Schema).min(3),
          properties: primitivePropertiesSchema.optional(),
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const entity = createPolygonEntity({
          kind: input.kind,
          name: input.name,
          parentId: input.parentId,
          points: input.points,
          properties: input.properties,
          actor,
        })
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{ kind: 'createEntity', entity }],
            note: 'MCP create polygon',
          }),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entityId: entity.id,
              revision: result.revision,
              world: result.world,
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'world_translate_entity',
      {
        description: 'Translate box, path, or polygon geometry in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          delta: vec3Schema,
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'translateEntity',
              entityId: input.entityId,
              delta: input.delta,
            }],
            note: 'MCP translate entity',
          }),
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    server.registerTool(
      'world_set_geometry_point',
      {
        description: 'Move one path/polygon vertex in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          index: z.number().int().nonnegative(),
          point: vec3Schema,
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'setGeometryPoint',
              entityId: input.entityId,
              index: input.index,
              point: input.point,
            }],
            note: 'MCP edit geometry point',
          }),
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    server.registerTool(
      'world_insert_geometry_point',
      {
        description: 'Insert a vertex into path/polygon geometry in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          index: z.number().int().nonnegative(),
          point: vec3Schema,
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'insertGeometryPoint',
              entityId: input.entityId,
              index: input.index,
              point: input.point,
            }],
            note: 'MCP insert geometry point',
          }),
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    server.registerTool(
      'world_remove_geometry_point',
      {
        description: 'Remove a path/polygon vertex in one explicit project when geometry remains valid.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          index: z.number().int().nonnegative(),
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'removeGeometryPoint',
              entityId: input.entityId,
              index: input.index,
            }],
            note: 'MCP remove geometry point',
          }),
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    server.registerTool(
      'world_add_port',
      {
        description: 'Add a typed connection interface to an entity in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          port: portInputSchema,
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const port = {
          ...input.port,
          id: input.port.id ?? createId('port'),
        }
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'addPort',
              entityId: input.entityId,
              port,
            }],
            note: 'MCP add port',
          }),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ port, result }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'world_connect_ports',
      {
        description: 'Connect compatible ports in one explicit project.',
        inputSchema: z.object({
          ...projectMutationBase,
          relationId: z.string().min(1).optional(),
          relationKind: z.string().min(1).optional(),
          fromEntityId: z.string().min(1),
          fromPortId: z.string().min(1),
          toEntityId: z.string().min(1),
          toPortId: z.string().min(1),
          properties: primitivePropertiesSchema.optional(),
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const relationId = input.relationId ?? createId('connection')
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'connectPorts',
              relationId,
              relationKind: input.relationKind,
              fromEntityId: input.fromEntityId,
              fromPortId: input.fromPortId,
              toEntityId: input.toEntityId,
              toPortId: input.toPortId,
              properties: input.properties,
            }],
            note: 'MCP connect ports',
          }),
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ relationId, result }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      'world_set_property',
      {
        description: 'Set one primitive property in one explicit project and optionally record knowledge metadata.',
        inputSchema: z.object({
          ...projectMutationBase,
          entityId: z.string().min(1),
          key: z.string().min(1),
          value: propertyValueSchema,
          knowledge: propertyKnowledgeInputSchema,
        }),
      },
      async (input) => {
        const actor = transactionActor(input.actor)
        const value: PropertyValue = input.value
        const result = projects.apply(
          input.projectId,
          createTransaction({
            baseRevision: input.baseRevision,
            actor,
            mutations: [{
              kind: 'setProperty',
              entityId: input.entityId,
              key: input.key,
              value,
              knowledge: input.knowledge,
            }],
            note: 'MCP set property',
          }),
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      },
    )

    return server
  })
}
