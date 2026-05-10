import { Point2 } from './types'

export type CreateFloorOp = { id: string; kind: 'createFloor'; params: { start: Point2; end: Point2 } }
export type CreateWallOp = { id: string; kind: 'createWall'; params: { start: Point2; end: Point2 } }
export type CreateRoofOp = { id: string; kind: 'createRoof'; params: { start: Point2; end: Point2 } }
export type CreatePipeOp = { id: string; kind: 'createPipe'; params: { points: Point2[]; kind?: string } }
export type CreateDuctOp = { id: string; kind: 'createDuct'; params: { points: Point2[] } }
export type UpdateElementOp = { id: string; kind: 'updateElement'; params: { elementId: string; updates: Record<string, any> } }
export type ExtrudeFaceOp = { id: string; kind: 'extrudeFace'; params: { elementId: string; faceId: string; distance: number } }

export type Operation = CreateFloorOp | CreateWallOp | CreateRoofOp | CreatePipeOp | CreateDuctOp | UpdateElementOp | ExtrudeFaceOp

export function opLabel(op: Operation): string {
  switch (op.kind) {
    case 'createFloor':
      return `CreateFloor ${op.params.start.x.toFixed(2)},${op.params.start.y.toFixed(2)} → ${op.params.end.x.toFixed(2)},${op.params.end.y.toFixed(2)}`
    case 'createWall':
      return `CreateWall ${op.params.start.x.toFixed(2)},${op.params.start.y.toFixed(2)} → ${op.params.end.x.toFixed(2)},${op.params.end.y.toFixed(2)}`
    case 'createRoof':
      return `CreateRoof ${op.params.start.x.toFixed(2)},${op.params.start.y.toFixed(2)} → ${op.params.end.x.toFixed(2)},${op.params.end.y.toFixed(2)}`
    case 'createPipe':
      return `CreatePipe ${op.params.points.length} pts` + (op.params.kind ? ` (${op.params.kind})` : '')
    case 'createDuct':
      return `CreateDuct ${op.params.points.length} pts`
    case 'updateElement':
      return `UpdateElement ${op.params.elementId} ${Object.keys(op.params.updates).join(',')}`
    case 'extrudeFace':
      return `Extrude ${op.params.elementId} ${op.params.faceId} ${op.params.distance.toFixed(2)}`
    default:
      return op.kind
  }
}

export function createOpId(prefix = 'op') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export default {
  opLabel,
  createOpId,
}
