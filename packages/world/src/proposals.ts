import { applyTransaction } from './operations'
import type {
  WorldDocument,
  WorldEntity,
  WorldRelation,
  WorldTransaction,
} from './types'

export interface ChangedEntity {
  entityId: string
  before: WorldEntity
  after: WorldEntity
}

export interface ChangedRelation {
  relationId: string
  before: WorldRelation
  after: WorldRelation
}

export interface WorldDiff {
  fromRevision: number
  toRevision: number
  createdEntities: WorldEntity[]
  removedEntities: WorldEntity[]
  changedEntities: ChangedEntity[]
  addedRelations: WorldRelation[]
  removedRelations: WorldRelation[]
  changedRelations: ChangedRelation[]
}

export interface TransactionPreview {
  transaction: WorldTransaction
  previewWorld: WorldDocument
  diff: WorldDiff
}

function stable(value: unknown): string {
  return JSON.stringify(value)
}

export function diffWorld(before: WorldDocument, after: WorldDocument): WorldDiff {
  const beforeEntities = new Map(before.entities.map((entity) => [entity.id, entity]))
  const afterEntities = new Map(after.entities.map((entity) => [entity.id, entity]))
  const beforeRelations = new Map(before.relations.map((relation) => [relation.id, relation]))
  const afterRelations = new Map(after.relations.map((relation) => [relation.id, relation]))

  const createdEntities = after.entities.filter((entity) => !beforeEntities.has(entity.id))
  const removedEntities = before.entities.filter((entity) => !afterEntities.has(entity.id))
  const changedEntities = after.entities.flatMap<ChangedEntity>((entity) => {
    const previous = beforeEntities.get(entity.id)
    if (!previous || stable(previous) === stable(entity)) return []
    return [{
      entityId: entity.id,
      before: structuredClone(previous),
      after: structuredClone(entity),
    }]
  })

  const addedRelations = after.relations.filter((relation) => !beforeRelations.has(relation.id))
  const removedRelations = before.relations.filter((relation) => !afterRelations.has(relation.id))
  const changedRelations = after.relations.flatMap<ChangedRelation>((relation) => {
    const previous = beforeRelations.get(relation.id)
    if (!previous || stable(previous) === stable(relation)) return []
    return [{
      relationId: relation.id,
      before: structuredClone(previous),
      after: structuredClone(relation),
    }]
  })

  return {
    fromRevision: before.revision,
    toRevision: after.revision,
    createdEntities: structuredClone(createdEntities),
    removedEntities: structuredClone(removedEntities),
    changedEntities,
    addedRelations: structuredClone(addedRelations),
    removedRelations: structuredClone(removedRelations),
    changedRelations,
  }
}

export function previewTransaction(
  world: WorldDocument,
  transaction: WorldTransaction,
): TransactionPreview {
  const result = applyTransaction(world, transaction)
  return {
    transaction: structuredClone(transaction),
    previewWorld: structuredClone(result.world),
    diff: diffWorld(world, result.world),
  }
}
