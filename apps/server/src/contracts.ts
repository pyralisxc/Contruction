import * as z from 'zod/v4'

import {
  createBoxEntity,
  createId,
  createPolygonEntity,
  createPolylineEntity,
  createTransaction,
  type ActorRef,
  type WorldMutation,
  type WorldTransaction,
} from '../../../packages/world/src/index'

export const projectIdSchema = z.string().min(1)
export const propertyValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const primitivePropertiesSchema = z.record(z.string(), propertyValueSchema)

export const propertyKnowledgeInputSchema = z.object({
  basis: z.enum([
    'chosen',
    'proposed',
    'imported',
    'manufacturer',
    'calculated',
    'inferred',
    'defaulted',
    'rule-required',
    'provider',
    'unknown',
  ]).optional(),
  confidence: z.enum(['low', 'medium', 'high', 'verified']).optional(),
  note: z.string().optional(),
}).optional()

export const actorSchema = z.object({
  kind: z.enum(['human', 'agent', 'automation', 'system']),
  id: z.string().min(1),
  label: z.string().optional(),
})

export const vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

export const portInputSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.string().min(1),
  name: z.string().min(1),
  properties: primitivePropertiesSchema.optional(),
})

export const supplySourceKindSchema = z.enum([
  'inventory',
  'reuse',
  'local-retail',
  'local-trade',
  'local-fabricator',
  'regional',
  'online',
  'self-fabrication',
])

export const supplyObservationInputSchema = z.object({
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

export const proposalChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('createBox'),
    entityKind: z.string().min(1),
    name: z.string().min(1),
    parentId: z.string().min(1).optional(),
    position: vec3Schema,
    size: vec3Schema,
    properties: primitivePropertiesSchema.optional(),
  }),
  z.object({
    kind: z.literal('createPolyline'),
    entityKind: z.string().min(1),
    name: z.string().min(1),
    parentId: z.string().min(1).optional(),
    points: z.array(vec3Schema).min(2),
    properties: primitivePropertiesSchema.optional(),
  }),
  z.object({
    kind: z.literal('createPolygon'),
    entityKind: z.string().min(1),
    name: z.string().min(1),
    parentId: z.string().min(1).optional(),
    points: z.array(vec3Schema).min(3),
    properties: primitivePropertiesSchema.optional(),
  }),
  z.object({
    kind: z.literal('moveEntity'),
    entityId: z.string().min(1),
    position: vec3Schema,
  }),
  z.object({
    kind: z.literal('translateEntity'),
    entityId: z.string().min(1),
    delta: vec3Schema,
  }),
  z.object({
    kind: z.literal('setGeometryPoint'),
    entityId: z.string().min(1),
    index: z.number().int().nonnegative(),
    point: vec3Schema,
  }),
  z.object({
    kind: z.literal('insertGeometryPoint'),
    entityId: z.string().min(1),
    index: z.number().int().nonnegative(),
    point: vec3Schema,
  }),
  z.object({
    kind: z.literal('removeGeometryPoint'),
    entityId: z.string().min(1),
    index: z.number().int().nonnegative(),
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
    knowledge: propertyKnowledgeInputSchema,
  }),
  z.object({
    kind: z.literal('removeProperty'),
    entityId: z.string().min(1),
    key: z.string().min(1),
  }),
  z.object({
    kind: z.literal('addPort'),
    entityId: z.string().min(1),
    port: portInputSchema,
  }),
  z.object({
    kind: z.literal('connectPorts'),
    relationId: z.string().min(1).optional(),
    relationKind: z.string().min(1).optional(),
    fromEntityId: z.string().min(1),
    fromPortId: z.string().min(1),
    toEntityId: z.string().min(1),
    toPortId: z.string().min(1),
    properties: primitivePropertiesSchema.optional(),
  }),
  z.object({
    kind: z.literal('removeEntity'),
    entityId: z.string().min(1),
  }),
])

export const proposalInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  note: z.string().optional(),
  changes: z.array(proposalChangeSchema).min(1),
})

export const mcpProposalInputSchema = proposalInputSchema.extend({
  projectId: projectIdSchema,
})

export const conceptShedInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  name: z.string().min(1).optional(),
  width: z.number().positive(),
  depth: z.number().positive(),
  wallHeight: z.number().positive(),
  origin: vec3Schema.optional(),
})

export const rainwaterSystemInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  name: z.string().min(1).optional(),
  capacityGallons: z.number().positive(),
  pipeRunFeet: z.number().positive(),
  targetFlowGpm: z.number().positive().optional(),
  origin: vec3Schema.optional(),
})

export const solarMicrogridInputSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  actor: actorSchema.optional(),
  name: z.string().min(1).optional(),
  panelCount: z.number().int().positive(),
  panelWatts: z.number().positive(),
  batteryKwh: z.number().positive(),
  inverterKw: z.number().positive(),
  origin: vec3Schema.optional(),
  loadEntityId: z.string().min(1).optional(),
  loadPortId: z.string().min(1).optional(),
})

export const mcpConceptShedInputSchema = conceptShedInputSchema.extend({
  projectId: projectIdSchema,
})
export const mcpRainwaterSystemInputSchema = rainwaterSystemInputSchema.extend({
  projectId: projectIdSchema,
})
export const mcpSolarMicrogridInputSchema = solarMicrogridInputSchema.extend({
  projectId: projectIdSchema,
})
export const mcpSupplyObservationInputSchema = supplyObservationInputSchema.extend({
  projectId: projectIdSchema,
})

export function transactionActor(input?: ActorRef): ActorRef {
  return input ?? { kind: 'agent', id: 'mcp:agent' }
}

export function proposalTransaction(
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
      case 'createPolyline':
        return {
          kind: 'createEntity',
          entity: createPolylineEntity({
            kind: change.entityKind,
            name: change.name,
            parentId: change.parentId,
            points: change.points,
            properties: change.properties,
            actor,
            at,
          }),
        }
      case 'createPolygon':
        return {
          kind: 'createEntity',
          entity: createPolygonEntity({
            kind: change.entityKind,
            name: change.name,
            parentId: change.parentId,
            points: change.points,
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
      case 'translateEntity':
        return {
          kind: 'translateEntity',
          entityId: change.entityId,
          delta: change.delta,
        }
      case 'setGeometryPoint':
        return {
          kind: 'setGeometryPoint',
          entityId: change.entityId,
          index: change.index,
          point: change.point,
        }
      case 'insertGeometryPoint':
        return {
          kind: 'insertGeometryPoint',
          entityId: change.entityId,
          index: change.index,
          point: change.point,
        }
      case 'removeGeometryPoint':
        return {
          kind: 'removeGeometryPoint',
          entityId: change.entityId,
          index: change.index,
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
          knowledge: change.knowledge,
        }
      case 'removeProperty':
        return {
          kind: 'removeProperty',
          entityId: change.entityId,
          key: change.key,
        }
      case 'addPort':
        return {
          kind: 'addPort',
          entityId: change.entityId,
          port: {
            ...change.port,
            id: change.port.id ?? createId('port'),
          },
        }
      case 'connectPorts':
        return {
          kind: 'connectPorts',
          relationId: change.relationId ?? createId('connection'),
          relationKind: change.relationKind,
          fromEntityId: change.fromEntityId,
          fromPortId: change.fromPortId,
          toEntityId: change.toEntityId,
          toPortId: change.toPortId,
          properties: change.properties,
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
