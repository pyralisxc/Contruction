import {
  Provenance,
  TransactionResult,
  WorldConflictError,
  WorldDocument,
  WorldEntity,
  WorldMutation,
  WorldRelation,
  WorldTransaction,
  WorldValidationError,
} from './types'
import { checkPortCompatibility, defaultConnectionKind } from './ports'

function cloneWorld(world: WorldDocument): WorldDocument {
  return structuredClone(world)
}

function requireNonEmpty(label: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WorldValidationError(`${label} must be a non-empty string`)
  }
}

function requireFinite(label: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WorldValidationError(`${label} must be a finite number`)
  }
}

function validateVec3(label: string, value: { x: number; y: number; z: number }) {
  requireFinite(`${label}.x`, value?.x)
  requireFinite(`${label}.y`, value?.y)
  requireFinite(`${label}.z`, value?.z)
}

function validatePort(port: WorldEntity['ports'][number]) {
  requireNonEmpty('port.id', port?.id)
  requireNonEmpty('port.kind', port?.kind)
  requireNonEmpty('port.name', port?.name)
}

function validateEntity(entity: WorldEntity) {
  requireNonEmpty('entity.id', entity?.id)
  requireNonEmpty('entity.kind', entity?.kind)
  requireNonEmpty('entity.name', entity?.name)
  if (!entity.properties || typeof entity.properties !== 'object' || Array.isArray(entity.properties)) {
    throw new WorldValidationError(`Entity ${entity.id} properties must be an object`)
  }
  if (entity.propertyKnowledge !== undefined) {
    if (
      !entity.propertyKnowledge ||
      typeof entity.propertyKnowledge !== 'object' ||
      Array.isArray(entity.propertyKnowledge)
    ) {
      throw new WorldValidationError(`Entity ${entity.id} propertyKnowledge must be an object`)
    }
    for (const [key, knowledge] of Object.entries(entity.propertyKnowledge)) {
      if (!(key in entity.properties)) {
        throw new WorldValidationError(`Property knowledge has no matching property on ${entity.id}: ${key}`)
      }
      requireNonEmpty(`property knowledge basis for ${key}`, knowledge?.basis)
      requireNonEmpty(`property knowledge actor for ${key}`, knowledge?.provenance?.actorId)
      requireNonEmpty(`property knowledge timestamp for ${key}`, knowledge?.provenance?.at)
    }
  }
  if (!Array.isArray(entity.ports)) {
    throw new WorldValidationError(`Entity ${entity.id} ports must be an array`)
  }

  const portIds = new Set<string>()
  for (const port of entity.ports) {
    validatePort(port)
    if (portIds.has(port.id)) {
      throw new WorldValidationError(`Duplicate port on ${entity.id}: ${port.id}`)
    }
    portIds.add(port.id)
  }

  if (entity.geometry) {
    if (entity.geometry.type === 'box') {
      validateVec3(`entity ${entity.id} position`, entity.geometry.position)
      validateVec3(`entity ${entity.id} size`, entity.geometry.size)
      if (
        entity.geometry.size.x <= 0 ||
        entity.geometry.size.y <= 0 ||
        entity.geometry.size.z <= 0
      ) {
        throw new WorldValidationError(`Box dimensions must be positive on ${entity.id}`)
      }
      if (entity.geometry.rotation) {
        validateVec3(`entity ${entity.id} rotation`, entity.geometry.rotation)
      }
    } else if (entity.geometry.type === 'polyline') {
      if (entity.geometry.points.length < 2) {
        throw new WorldValidationError(`Polyline requires at least two points on ${entity.id}`)
      }
      entity.geometry.points.forEach((point, index) =>
        validateVec3(`entity ${entity.id} polyline[${index}]`, point),
      )
    } else if (entity.geometry.type === 'polygon') {
      if (entity.geometry.points.length < 3) {
        throw new WorldValidationError(`Polygon requires at least three points on ${entity.id}`)
      }
      entity.geometry.points.forEach((point, index) =>
        validateVec3(`entity ${entity.id} polygon[${index}]`, point),
      )
      let signedArea = 0
      for (let index = 0; index < entity.geometry.points.length; index += 1) {
        const current = entity.geometry.points[index]
        const next = entity.geometry.points[(index + 1) % entity.geometry.points.length]
        signedArea += current.x * next.y - next.x * current.y
      }
      if (Math.abs(signedArea) < 0.000001) {
        throw new WorldValidationError(`Polygon must have non-zero XY area on ${entity.id}`)
      }
    }
  }

  requireNonEmpty(`entity ${entity.id} provenance.actorId`, entity.provenance?.actorId)
  requireNonEmpty(`entity ${entity.id} provenance.at`, entity.provenance?.at)
}

function validateRelation(relation: WorldRelation) {
  requireNonEmpty('relation.id', relation?.id)
  requireNonEmpty('relation.kind', relation?.kind)
  requireNonEmpty('relation.fromEntityId', relation?.fromEntityId)
  requireNonEmpty('relation.toEntityId', relation?.toEntityId)
  requireNonEmpty(`relation ${relation.id} provenance.actorId`, relation.provenance?.actorId)
  requireNonEmpty(`relation ${relation.id} provenance.at`, relation.provenance?.at)
}

function validateTransactionShape(transaction: WorldTransaction) {
  requireNonEmpty('transaction.id', transaction?.id)
  requireNonEmpty('transaction.actor.id', transaction?.actor?.id)
  requireNonEmpty('transaction.createdAt', transaction?.createdAt)
  if (!Number.isInteger(transaction?.baseRevision) || transaction.baseRevision < 0) {
    throw new WorldValidationError('transaction.baseRevision must be a non-negative integer')
  }
  if (!Array.isArray(transaction?.mutations) || transaction.mutations.length === 0) {
    throw new WorldValidationError('A transaction must contain at least one mutation')
  }
}

function entityById(world: WorldDocument, entityId: string): WorldEntity {
  const entity = world.entities.find((candidate) => candidate.id === entityId)
  if (!entity) throw new WorldValidationError(`Unknown entity: ${entityId}`)
  return entity
}

function assertEntityDoesNotExist(world: WorldDocument, entityId: string) {
  if (world.entities.some((entity) => entity.id === entityId)) {
    throw new WorldValidationError(`Entity already exists: ${entityId}`)
  }
}

function assertRelationDoesNotExist(world: WorldDocument, relationId: string) {
  if (world.relations.some((relation) => relation.id === relationId)) {
    throw new WorldValidationError(`Relation already exists: ${relationId}`)
  }
}

function portById(entity: WorldEntity, portId: string) {
  const port = entity.ports.find((candidate) => candidate.id === portId)
  if (!port) throw new WorldValidationError(`Unknown port ${portId} on entity ${entity.id}`)
  return port
}


function pointGeometry(entity: WorldEntity) {
  if (!entity.geometry || entity.geometry.type === 'box') {
    throw new WorldValidationError(`Entity does not use point geometry: ${entity.id}`)
  }
  return entity.geometry
}

function requirePointIndex(entity: WorldEntity, index: number, allowEnd = false) {
  const geometry = pointGeometry(entity)
  if (!Number.isInteger(index)) {
    throw new WorldValidationError('Geometry point index must be an integer')
  }
  const max = allowEnd ? geometry.points.length : geometry.points.length - 1
  if (index < 0 || index > max) {
    throw new WorldValidationError(`Geometry point index out of range on ${entity.id}: ${index}`)
  }
  return geometry
}

function defaultPropertyBasis(actor: WorldTransaction['actor']): NonNullable<Extract<WorldMutation, { kind: 'setProperty' }>['knowledge']>['basis'] {
  if (actor.kind === 'human') return 'chosen'
  if (actor.kind === 'agent') return 'proposed'
  if (actor.kind === 'automation') return 'calculated'
  return 'defaulted'
}

function applyMutation(world: WorldDocument, mutation: WorldMutation, transaction: WorldTransaction) {
  switch (mutation.kind) {
    case 'createEntity': {
      validateEntity(mutation.entity)
      assertEntityDoesNotExist(world, mutation.entity.id)
      if (mutation.entity.parentId) {
        if (mutation.entity.parentId === mutation.entity.id) {
          throw new WorldValidationError(`Entity cannot parent itself: ${mutation.entity.id}`)
        }
        entityById(world, mutation.entity.parentId)
      }
      world.entities.push(structuredClone(mutation.entity))
      return
    }
    case 'renameEntity': {
      requireNonEmpty('entity name', mutation.name)
      entityById(world, mutation.entityId).name = mutation.name
      return
    }
    case 'moveEntity': {
      const entity = entityById(world, mutation.entityId)
      if (!entity.geometry) throw new WorldValidationError(`Entity has no geometry: ${entity.id}`)
      if (entity.geometry.type !== 'box') {
        throw new WorldValidationError(`Absolute move is only supported for box geometry: ${entity.id}`)
      }
      validateVec3('position', mutation.position)
      entity.geometry.position = structuredClone(mutation.position)
      return
    }
    case 'resizeBox': {
      const entity = entityById(world, mutation.entityId)
      if (!entity.geometry || entity.geometry.type !== 'box') {
        throw new WorldValidationError(`Entity is not a box: ${entity.id}`)
      }
      validateVec3('size', mutation.size)
      if (mutation.size.x <= 0 || mutation.size.y <= 0 || mutation.size.z <= 0) {
        throw new WorldValidationError('Box dimensions must be positive')
      }
      entity.geometry.size = structuredClone(mutation.size)
      return
    }
    case 'translateEntity': {
      const entity = entityById(world, mutation.entityId)
      if (!entity.geometry) throw new WorldValidationError(`Entity has no geometry: ${entity.id}`)
      validateVec3('delta', mutation.delta)
      if (entity.geometry.type === 'box') {
        entity.geometry.position = {
          x: entity.geometry.position.x + mutation.delta.x,
          y: entity.geometry.position.y + mutation.delta.y,
          z: entity.geometry.position.z + mutation.delta.z,
        }
      } else {
        entity.geometry.points = entity.geometry.points.map((point) => ({
          x: point.x + mutation.delta.x,
          y: point.y + mutation.delta.y,
          z: point.z + mutation.delta.z,
        }))
      }
      return
    }
    case 'setGeometryPoint': {
      const entity = entityById(world, mutation.entityId)
      const geometry = requirePointIndex(entity, mutation.index)
      validateVec3('point', mutation.point)
      geometry.points[mutation.index] = structuredClone(mutation.point)
      validateEntity(entity)
      return
    }
    case 'insertGeometryPoint': {
      const entity = entityById(world, mutation.entityId)
      const geometry = requirePointIndex(entity, mutation.index, true)
      validateVec3('point', mutation.point)
      geometry.points.splice(mutation.index, 0, structuredClone(mutation.point))
      validateEntity(entity)
      return
    }
    case 'removeGeometryPoint': {
      const entity = entityById(world, mutation.entityId)
      const geometry = requirePointIndex(entity, mutation.index)
      geometry.points.splice(mutation.index, 1)
      validateEntity(entity)
      return
    }
    case 'setProperty': {
      requireNonEmpty('property key', mutation.key)
      if (
        mutation.value !== null &&
        !['string', 'number', 'boolean'].includes(typeof mutation.value)
      ) {
        throw new WorldValidationError('Property value must be string, number, boolean, or null')
      }
      if (typeof mutation.value === 'number' && !Number.isFinite(mutation.value)) {
        throw new WorldValidationError('Numeric property value must be finite')
      }
      const entity = entityById(world, mutation.entityId)
      entity.properties[mutation.key] = mutation.value
      entity.propertyKnowledge ??= {}
      entity.propertyKnowledge[mutation.key] = {
        basis: mutation.knowledge?.basis ?? defaultPropertyBasis(transaction.actor) ?? 'unknown',
        confidence: mutation.knowledge?.confidence,
        note: mutation.knowledge?.note,
        provenance: createProvenance(transaction),
      }
      return
    }
    case 'removeProperty': {
      const entity = entityById(world, mutation.entityId)
      delete entity.properties[mutation.key]
      if (entity.propertyKnowledge) delete entity.propertyKnowledge[mutation.key]
      return
    }
    case 'addPort': {
      const entity = entityById(world, mutation.entityId)
      validatePort(mutation.port)
      if (entity.ports.some((port) => port.id === mutation.port.id)) {
        throw new WorldValidationError(`Port already exists on ${entity.id}: ${mutation.port.id}`)
      }
      entity.ports.push(structuredClone(mutation.port))
      return
    }
    case 'updatePort': {
      const entity = entityById(world, mutation.entityId)
      const port = portById(entity, mutation.portId)
      if (mutation.updates.kind !== undefined) port.kind = mutation.updates.kind
      if (mutation.updates.name !== undefined) port.name = mutation.updates.name
      if (mutation.updates.properties !== undefined) {
        port.properties = structuredClone(mutation.updates.properties)
      }
      return
    }
    case 'removePort': {
      const entity = entityById(world, mutation.entityId)
      portById(entity, mutation.portId)
      entity.ports = entity.ports.filter((port) => port.id !== mutation.portId)
      world.relations = world.relations.filter((relation) => !(
        (relation.fromEntityId === mutation.entityId && relation.fromPortId === mutation.portId) ||
        (relation.toEntityId === mutation.entityId && relation.toPortId === mutation.portId)
      ))
      return
    }
    case 'connectPorts': {
      requireNonEmpty('relationId', mutation.relationId)
      if (mutation.relationKind !== undefined) requireNonEmpty('relationKind', mutation.relationKind)
      assertRelationDoesNotExist(world, mutation.relationId)

      const fromEntity = entityById(world, mutation.fromEntityId)
      const toEntity = entityById(world, mutation.toEntityId)
      const fromPort = portById(fromEntity, mutation.fromPortId)
      const toPort = portById(toEntity, mutation.toPortId)
      const compatibility = checkPortCompatibility(fromPort, toPort)

      if (!compatibility.compatible) {
        throw new WorldValidationError(
          compatibility.reason ?? `Ports are not compatible: ${fromPort.kind} -> ${toPort.kind}`,
        )
      }

      const duplicate = world.relations.some((relation) =>
        relation.fromEntityId === mutation.fromEntityId &&
        relation.fromPortId === mutation.fromPortId &&
        relation.toEntityId === mutation.toEntityId &&
        relation.toPortId === mutation.toPortId
      )
      if (duplicate) {
        throw new WorldValidationError(
          `Ports are already connected: ${mutation.fromEntityId}/${mutation.fromPortId} -> ${mutation.toEntityId}/${mutation.toPortId}`,
        )
      }

      world.relations.push({
        id: mutation.relationId,
        kind: mutation.relationKind ?? defaultConnectionKind(fromPort),
        fromEntityId: mutation.fromEntityId,
        fromPortId: mutation.fromPortId,
        toEntityId: mutation.toEntityId,
        toPortId: mutation.toPortId,
        properties: structuredClone(mutation.properties ?? {}),
        provenance: createProvenance(transaction),
      })
      return
    }
    case 'addRelation': {
      validateRelation(mutation.relation)
      assertRelationDoesNotExist(world, mutation.relation.id)
      const fromEntity = entityById(world, mutation.relation.fromEntityId)
      const toEntity = entityById(world, mutation.relation.toEntityId)
      if (mutation.relation.fromPortId) portById(fromEntity, mutation.relation.fromPortId)
      if (mutation.relation.toPortId) portById(toEntity, mutation.relation.toPortId)
      world.relations.push(structuredClone(mutation.relation))
      return
    }
    case 'removeRelation': {
      const index = world.relations.findIndex((relation) => relation.id === mutation.relationId)
      if (index < 0) throw new WorldValidationError(`Unknown relation: ${mutation.relationId}`)
      world.relations.splice(index, 1)
      return
    }
    case 'removeEntity': {
      entityById(world, mutation.entityId)
      const hasChildren = world.entities.some((entity) => entity.parentId === mutation.entityId)
      if (hasChildren) {
        throw new WorldValidationError(`Cannot remove entity with children: ${mutation.entityId}`)
      }
      world.entities = world.entities.filter((entity) => entity.id !== mutation.entityId)
      world.relations = world.relations.filter(
        (relation) =>
          relation.fromEntityId !== mutation.entityId &&
          relation.toEntityId !== mutation.entityId,
      )
      return
    }
    default: {
      const unknownMutation = mutation as { kind?: unknown }
      throw new WorldValidationError(`Unknown mutation kind: ${String(unknownMutation.kind)}`)
    }
  }
}

export function applyTransaction(
  current: WorldDocument,
  transaction: WorldTransaction,
): TransactionResult {
  validateTransactionShape(transaction)
  if (transaction.baseRevision !== current.revision) {
    throw new WorldConflictError(
      `Revision mismatch: expected ${current.revision}, received ${transaction.baseRevision}`,
    )
  }

  const next = cloneWorld(current)

  for (const mutation of transaction.mutations) {
    applyMutation(next, mutation, transaction)
  }

  const previousRevision = current.revision
  next.revision = previousRevision + 1
  next.updatedAt = transaction.createdAt

  return {
    transactionId: transaction.id,
    previousRevision,
    revision: next.revision,
    world: next,
  }
}

export function createProvenance(
  transaction: Pick<WorldTransaction, 'actor' | 'createdAt'>,
): Provenance {
  const origin =
    transaction.actor.kind === 'human'
      ? 'user'
      : transaction.actor.kind === 'agent'
        ? 'agent'
        : transaction.actor.kind === 'automation'
          ? 'system'
          : 'system'

  return {
    origin,
    actorId: transaction.actor.id,
    at: transaction.createdAt,
  }
}

export function relation(
  id: string,
  kind: string,
  fromEntityId: string,
  toEntityId: string,
  provenance: Provenance,
  properties: WorldRelation['properties'] = {},
  ports: { fromPortId?: string; toPortId?: string } = {},
): WorldRelation {
  return {
    id,
    kind,
    fromEntityId,
    fromPortId: ports.fromPortId,
    toEntityId,
    toPortId: ports.toPortId,
    provenance,
    properties,
  }
}
