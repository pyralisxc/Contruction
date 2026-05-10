import { BuildingElement, FloorElement, ProjectDocument, Point2 } from './types'

// Minimal parametric family scaffolding. These are lightweight factories that
// produce building elements from a small set of parameters. Keep them pure
// (no side-effects) so they are easy to test and replay.

export type FamilyParams = Record<string, number | string | boolean>

export interface FamilyDefinition<P extends FamilyParams = FamilyParams> {
  id: string
  displayName: string
  description?: string
  defaultParams: P
  instantiate: (params: P, origin?: Point2, doc?: ProjectDocument) => Partial<BuildingElement>
}

export const sampleFloorFamily: FamilyDefinition<{ width: number; depth: number; thickness: number }> = {
  id: 'family-floor-simple',
  displayName: 'Simple Rectangular Floor',
  description: 'Creates a rectangular floor by width/depth at an origin point',
  defaultParams: { width: 10, depth: 10, thickness: 0.5 },
  instantiate: (params, origin = { x: 0, y: 0 }) => {
    const x = origin.x
    const y = origin.y
    const w = Number(params.width)
    const d = Number(params.depth)
    const halfW = w / 2
    const halfD = d / 2
    const footprint = [
      { x: x - halfW, y: y - halfD },
      { x: x + halfW, y: y - halfD },
      { x: x + halfW, y: y + halfD },
      { x: x - halfW, y: y + halfD },
    ]
    const floor: Partial<FloorElement> = {
      type: 'floor',
      name: 'Family Floor',
      path: footprint,
      thickness: Number(params.thickness),
    }
    return floor
  },
}

export const families = {
  sampleFloorFamily,
}

export default families
