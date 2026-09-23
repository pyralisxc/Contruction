import {
  ActorRef,
  BoxGeometry,
  PolylineGeometry,
  PolygonGeometry,
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



function entityBase(input: {
  id?: string
  kind: string
  name: string
  parentId?: string
  properties?: PropertyBag
  ports?: Port[]
  actor: ActorRef
  at?: string
}) {
  const at = input.at ?? new Date().toISOString()
  return {
    id: input.id ?? createId(input.kind.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'entity'),
    kind: input.kind,
    name: input.name,
    parentId: input.parentId,
    properties: structuredClone(input.properties ?? {}),
    ports: structuredClone(input.ports ?? []),
    provenance: {
      origin:
        input.actor.kind === 'human'
          ? 'user' as const
          : input.actor.kind === 'agent'
            ? 'agent' as const
            : 'system' as const,
      actorId: input.actor.id,
      at,
    },
  }
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
  return {
    ...entityBase(input),
    geometry: {
      type: 'box' as const,
      position: structuredClone(input.position),
      size: structuredClone(input.size),
    },
  }
}



export function createPolylineEntity(input: {
  id?: string
  kind: string
  name: string
  points: PolylineGeometry['points']
  parentId?: string
  properties?: PropertyBag
  ports?: Port[]
  actor: ActorRef
  at?: string
}): WorldEntity {
  return {
    ...entityBase(input),
    geometry: {
      type: 'polyline',
      points: structuredClone(input.points),
    },
  }
}

export function createPolygonEntity(input: {
  id?: string
  kind: string
  name: string
  points: PolygonGeometry['points']
  parentId?: string
  properties?: PropertyBag
  ports?: Port[]
  actor: ActorRef
  at?: string
}): WorldEntity {
  return {
    ...entityBase(input),
    geometry: {
      type: 'polygon',
      points: structuredClone(input.points),
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
