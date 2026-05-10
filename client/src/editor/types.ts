import { EditorMode, ModelDisplayMode, Point2 } from '../bim/types'

export type EditorToolId =
  | 'select'
  | 'drawFloor'
  | 'drawWall'
  | 'pushPull'
  | 'placeOpening'
  | 'drawRoof'
  | 'attachAddition'
  | 'splitFootprint'
  | 'deleteFootprintVertex'
  | 'addTerrainPoint'
  | 'placeElectricalDevice'
  | 'placePlumbingFixture'
  | 'drawPipe'
  | 'drawDuct'

export type ViewportPanelMode = '3d' | 'diagram' | 'hidden'

export type WorkspaceMode = 'plan2d' | 'framing3d' | 'split' | 'sheets' | 'materials' | 'code'

export type SelectionHandle =
  | 'move'
  | 'floor-nw'
  | 'floor-ne'
  | 'floor-se'
  | 'floor-sw'
  | `floor-vertex-${number}`
  | `floor-edge-${number}`
  | 'roof-nw'
  | 'roof-ne'
  | 'roof-se'
  | 'roof-sw'
  | `roof-vertex-${number}`
  | `roof-edge-${number}`
  | 'wall-start'
  | 'wall-end'
  | 'opening-center'
  | 'opening-left'
  | 'opening-right'
  | `path-${number}`

export type LayerId =
  | 'terrain'
  | 'foundation'
  | 'floors'
  | 'floorFraming'
  | 'wallFraming'
  | 'roofFraming'
  | 'walls'
  | 'openings'
  | 'framing'
  | 'roof'
  | 'sheathing'
  | 'siding'
  | 'roofing'
  | 'flooring'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'dimensions'
  | 'warnings'

export interface SnapTarget {
  id: string
  kind: 'grid' | 'endpoint' | 'corner' | 'wall' | 'opening' | 'pathPoint'
  point: Point2
  label: string
}

export interface ToolSession {
  toolId: EditorToolId
  mode: EditorMode
  start?: Point2
  current?: Point2
  points: Point2[]
  hostElementId?: string
  elementKind?: string
}

export interface EditorDragState {
  elementId: string
  handle: SelectionHandle
  startPoint: Point2
  lastPoint: Point2
}

export interface PlanViewportState {
  zoom: number
  pan: Point2
}

export type { ModelDisplayMode }

export interface ElementMoveDelta {
  x: number
  y: number
  z?: number
}

export interface PathPointUpdate {
  x?: number
  y?: number
  z?: number
}
