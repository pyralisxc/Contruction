import {
  ActorRef,
  BoxGeometry,
  Port,
  PropertyBag,
  WorldEntity,
  WorldTransaction,
} from './types'

let sequence = 0

export function createId(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}

export function createBoxEntity(input: {
  id?: string
  kind: string
  name: string
  position: BoxGeometry['position']
  size: BoxGeometry['size']
  parentId?: string
  properties?: PropertyBag
  ports?: Port[]
  actor: ActorRef
  at?: string
}): WorldEntity {
  const at = input.at ?? new Date().toISOString()
  return {
    id: input.id ?? createId(input.kind.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'entity'),
    kind: input.kind,
    name: input.name,
    parentId: input.parentId,
    geometry: {
      type: 'box',
      position: structuredClone(input.position),
      size: structuredClone(input.size),
    },
    properties: structuredClone(input.properties ?? {}),
    ports: structuredClone(input.ports ?? []),
    provenance: {
      origin:
        input.actor.kind === 'human'
          ? 'user'
          : input.actor.kind === 'agent'
            ? 'agent'
            : 'system',
      actorId: input.actor.id,
      at,
    },
  }
}

export function createTransaction(input: {
  baseRevision: number
  actor: ActorRef
  mutations: WorldTransaction['mutations']
  note?: string
  id?: string
  at?: string
}): WorldTransaction {
  return {
    id: input.id ?? createId('tx'),
    baseRevision: input.baseRevision,
    actor: structuredClone(input.actor),
    createdAt: input.at ?? new Date().toISOString(),
    mutations: structuredClone(input.mutations),
    note: input.note,
  }
}
