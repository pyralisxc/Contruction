export type EntityId = string
export type RelationId = string
export type Revision = number

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface BoxGeometry {
  type: 'box'
  position: Vec3
  size: Vec3
  rotation?: Vec3
}

export type Geometry = BoxGeometry

export type PropertyValue = string | number | boolean | null
export type PropertyBag = Record<string, PropertyValue>

export type ProvenanceOrigin =
  | 'user'
  | 'agent'
  | 'import'
  | 'derived'
  | 'system'
  | 'provider'

export interface Provenance {
  origin: ProvenanceOrigin
  actorId: string
  at: string
  note?: string
}

export interface Port {
  id: string
  kind: string
  name: string
  properties?: PropertyBag
}

export interface WorldEntity {
  id: EntityId
  kind: string
  name: string
  parentId?: EntityId
  geometry?: Geometry
  properties: PropertyBag
  ports: Port[]
  provenance: Provenance
}

export interface WorldRelation {
  id: RelationId
  kind: string
  fromEntityId: EntityId
  toEntityId: EntityId
  properties: PropertyBag
  provenance: Provenance
}

export interface WorldDocument {
  schemaVersion: 'contractor-world.v0'
  id: string
  name: string
  revision: Revision
  createdAt: string
  updatedAt: string
  entities: WorldEntity[]
  relations: WorldRelation[]
}

export type ActorKind = 'human' | 'agent' | 'automation' | 'system'

export interface ActorRef {
  kind: ActorKind
  id: string
  label?: string
}

export type WorldMutation =
  | {
      kind: 'createEntity'
      entity: WorldEntity
    }
  | {
      kind: 'renameEntity'
      entityId: EntityId
      name: string
    }
  | {
      kind: 'moveEntity'
      entityId: EntityId
      position: Vec3
    }
  | {
      kind: 'resizeBox'
      entityId: EntityId
      size: Vec3
    }
  | {
      kind: 'setProperty'
      entityId: EntityId
      key: string
      value: PropertyValue
    }
  | {
      kind: 'removeProperty'
      entityId: EntityId
      key: string
    }
  | {
      kind: 'addRelation'
      relation: WorldRelation
    }
  | {
      kind: 'removeRelation'
      relationId: RelationId
    }
  | {
      kind: 'removeEntity'
      entityId: EntityId
    }

export interface WorldTransaction {
  id: string
  baseRevision: Revision
  actor: ActorRef
  createdAt: string
  mutations: WorldMutation[]
  note?: string
}

export interface TransactionResult {
  transactionId: string
  previousRevision: Revision
  revision: Revision
  world: WorldDocument
}

export class WorldConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorldConflictError'
  }
}

export class WorldValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorldValidationError'
  }
}
