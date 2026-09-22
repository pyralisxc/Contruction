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

function cloneWorld(world: WorldDocument): WorldDocument {
  return structuredClone(world)
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

function applyMutation(world: WorldDocument, mutation: WorldMutation) {
  switch (mutation.kind) {
    case 'createEntity': {
      assertEntityDoesNotExist(world, mutation.entity.id)
      if (mutation.entity.parentId) entityById(world, mutation.entity.parentId)
      world.entities.push(structuredClone(mutation.entity))
      return
    }
    case 'renameEntity': {
      entityById(world, mutation.entityId).name = mutation.name
      return
    }
    case 'moveEntity': {
      const entity = entityById(world, mutation.entityId)
      if (!entity.geometry) throw new WorldValidationError(`Entity has no geometry: ${entity.id}`)
      entity.geometry.position = structuredClone(mutation.position)
      return
    }
    case 'resizeBox': {
      const entity = entityById(world, mutation.entityId)
      if (!entity.geometry || entity.geometry.type !== 'box') {
        throw new WorldValidationError(`Entity is not a box: ${entity.id}`)
      }
      if (mutation.size.x <= 0 || mutation.size.y <= 0 || mutation.size.z <= 0) {
        throw new WorldValidationError('Box dimensions must be positive')
      }
      entity.geometry.size = structuredClone(mutation.size)
      return
    }
    case 'setProperty': {
      entityById(world, mutation.entityId).properties[mutation.key] = mutation.value
      return
    }
    case 'removeProperty': {
      delete entityById(world, mutation.entityId).properties[mutation.key]
      return
    }
    case 'addRelation': {
      assertRelationDoesNotExist(world, mutation.relation.id)
      entityById(world, mutation.relation.fromEntityId)
      entityById(world, mutation.relation.toEntityId)
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
  }
}

export function applyTransaction(
  current: WorldDocument,
  transaction: WorldTransaction,
): TransactionResult {
  if (transaction.baseRevision !== current.revision) {
    throw new WorldConflictError(
      `Revision mismatch: expected ${current.revision}, received ${transaction.baseRevision}`,
    )
  }

  if (transaction.mutations.length === 0) {
    throw new WorldValidationError('A transaction must contain at least one mutation')
  }

  const next = cloneWorld(current)

  for (const mutation of transaction.mutations) {
    applyMutation(next, mutation)
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
): WorldRelation {
  return {
    id,
    kind,
    fromEntityId,
    toEntityId,
    provenance,
    properties,
  }
}
