import { create } from 'zustand'
import { createSampleProject } from '../bim/sampleProject'
import { Operation, createOpId } from '../bim/ops'
import families from '../bim/families'
import {
  EditorDragState,
  EditorToolId,
  ElementMoveDelta,
  LayerId,
  PathPointUpdate,
  PlanViewportState,
  SelectionHandle,
  ToolSession,
  ViewportPanelMode,
  WorkspaceMode,
  ModelDisplayMode,
} from '../editor/types'
import {
  BuildingElement,
  SupplierProduct,
  CircuitElement,
  DuctElement,
  EditorMode,
  ElectricalDeviceElement,
  FloorElement,
  HouseAccessoryElement,
  LevelModel,
  OpeningElement,
  PipeElement,
  PlumbingFixtureElement,
  Point2,
  ProjectDocument,
  RoofElement,
  SpaceModel,
  StairElement,
  TerrainPoint,
  ViewMode,
  WallElement,
} from '../bim/types'

export interface BimProjectState {
  project: ProjectDocument
  selectedId: string | null
  mode: EditorMode
  viewMode: ViewMode
  workspaceMode: WorkspaceMode
  modelDisplayMode: ModelDisplayMode
  activeTool: EditorToolId
  toolSession: ToolSession | null
  hoverTarget: string | null
  dragState: EditorDragState | null
  viewportPanel: ViewportPanelMode
  visibleLayers: Record<LayerId, boolean>
  planViewport: PlanViewportState
  activeLevelId: string
  snapFeet: number
  past: ProjectDocument[]
  future: ProjectDocument[]
  operations: Operation[]
  operationsFuture: Operation[]
  pushOperation: (op: Operation) => void
  replayOperations: () => void
  isReplayingOperations: boolean
  exportOperations: () => string
  importOperations: (json: string) => void
  clearOperations: () => void
  persistCheckpoint: () => void
  loadCheckpointAndReplay: () => void
  undoOperation: () => void
  redoOperation: () => void
  selectedStore: { id: string; name?: string; zipCode?: string } | null
  setSelectedStore: (store: { id: string; name?: string; zipCode?: string } | null) => void
  addSupplierProduct: (product: SupplierProduct) => void
  cart: Array<{ product: SupplierProduct; quantity: number }>
  addToCart: (product: SupplierProduct, quantity?: number) => void
  removeFromCart: (sku: string) => void
  updateCartItem: (sku: string, quantity: number) => void
  clearCart: () => void
  setMode: (mode: EditorMode) => void
  setViewMode: (viewMode: ViewMode) => void
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  setModelDisplayMode: (mode: ModelDisplayMode) => void
  setActiveTool: (toolId: EditorToolId) => void
  beginToolSession: (session: ToolSession) => void
  updateToolSession: (updates: Partial<ToolSession>) => void
  commitToolSession: () => void
  cancelToolSession: () => void
  setHoverTarget: (id: string | null) => void
  beginDrag: (dragState: EditorDragState) => void
  updateDragPoint: (point: Point2) => void
  endDrag: () => void
  setViewportPanel: (mode: ViewportPanelMode) => void
  setLayerVisible: (layer: LayerId, visible: boolean) => void
  setLayerPreset: (preset: 'all' | 'framingOnly' | 'finishedOnly' | 'floorFrame' | 'wallFrame' | 'roofFrame' | 'foundationOnly' | 'systemsOnly') => void
  setPlanViewport: (updates: Partial<PlanViewportState>) => void
  fitPlanToProject: () => void
  selectElement: (id: string | null) => void
  setSnapFeet: (snapFeet: number) => void
  setActiveLevel: (levelId: string) => void
  commitProject: (project: ProjectDocument) => void
  updateElement: (id: string, updates: Partial<BuildingElement>) => void
  extrudeFace: (elementId: string, faceId: string, distance: number) => void
  setElementPreview: (id: string, updates: Partial<BuildingElement>) => void
  removeElement: (id: string) => void
  updateTerrain: (updates: Partial<ProjectDocument['site']['terrain']>) => void
  updateTerrainPoint: (id: string, updates: Partial<TerrainPoint>) => void
  addTerrainPoint: (point: Omit<TerrainPoint, 'id'>) => void
  setTerrainKind: (type: ProjectDocument['site']['terrain']['type']) => void
  addWall: () => void
  addFloor: () => void
  addDeck: () => void
  addHalfWall: () => void
  addRoof: () => void
  addStair: () => void
  addAccessory: (kind: HouseAccessoryElement['accessoryKind']) => void
  addOpening: (wallId?: string) => void
  addElectricalDevice: (kind?: ElectricalDeviceElement['deviceKind']) => void
  addCircuit: () => void
  addPlumbingFixture: (kind?: PlumbingFixtureElement['fixtureKind']) => void
  addPipe: (kind?: PipeElement['pipeKind']) => void
  addDuct: () => void
  createFloorAt: (start: Point2, end: Point2) => void
  createWallAt: (start: Point2, end: Point2) => void
  createRoofAt: (start: Point2, end: Point2) => void
  createRoofFromSelection: () => void
  createFloorFromWallBounds: () => void
  createSpacesFromWallLoops: () => void
  cleanWallConnections: () => void
  createOpeningAt: (wallId: string, point: Point2, kind?: OpeningElement['openingKind']) => void
  createElectricalDeviceAt: (point: Point2, kind?: ElectricalDeviceElement['deviceKind']) => void
  createPlumbingFixtureAt: (point: Point2, kind?: PlumbingFixtureElement['fixtureKind']) => void
  createPipeAt: (points: Point2[], kind?: PipeElement['pipeKind']) => void
  createDuctAt: (points: Point2[]) => void
  createFamilyInstance: (familyId: string, params?: Record<string, any>, origin?: Point2) => void
  updateFloorBounds: (id: string, width: number, depth: number) => void
  updateWallPath: (id: string, start: Point2, end: Point2) => void
  updateRoofFootprint: (id: string, width: number, depth: number) => void
  updatePolygonVertex: (id: string, pointIndex: number, point: Point2) => void
  movePolygonEdge: (id: string, edgeIndex: number, point: Point2) => void
  splitPolygonEdge: (id: string, edgeIndex: number, point?: Point2) => void
  deletePolygonVertex: (id: string, pointIndex: number) => void
  cleanPolygonFootprint: (id: string) => void
  syncExteriorWallsToFloorOutline: (floorId?: string) => void
  syncRoofToFloorOutline: (floorId?: string) => void
  createAttachedAddition: () => void
  createAttachedAdditionOnTarget: (targetId: string, edgeIndex?: number, depth?: number) => void
  moveElement: (id: string, delta: ElementMoveDelta) => void
  resizeElementFromHandle: (id: string, handle: SelectionHandle, point: Point2) => void
  moveOpeningAlongWall: (id: string, center: number) => void
  updatePathPoint: (id: string, pointIndex: number, point: PathPointUpdate) => void
  undo: () => void
  redo: () => void
  loadProject: (project: ProjectDocument) => void
  resetProject: () => void
}

function withUpdatedAt(project: ProjectDocument): ProjectDocument {
  return { ...project, updatedAt: new Date().toISOString() }
}

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

const defaultVisibleLayers: Record<LayerId, boolean> = {
  terrain: true,
  foundation: true,
  floors: true,
  floorFraming: true,
  wallFraming: true,
  roofFraming: true,
  walls: true,
  openings: true,
  framing: true,
  roof: true,
  sheathing: true,
  siding: true,
  roofing: true,
  flooring: true,
  electrical: true,
  plumbing: true,
  hvac: true,
  dimensions: true,
  warnings: true,
}

function rectFromPoints(start: Point2, end: Point2): Point2[] {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxY = Math.max(start.y, end.y)
  const width = Math.max(maxX - minX, 1)
  const depth = Math.max(maxY - minY, 1)
  return [
    { x: minX, y: minY },
    { x: minX + width, y: minY },
    { x: minX + width, y: minY + depth },
    { x: minX, y: minY + depth },
  ]
}

function movePoint(point: Point2, delta: ElementMoveDelta): Point2 {
  return { x: point.x + delta.x, y: point.y + delta.y }
}

function boundsFromPolygon(polygon: Point2[]) {
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    maxY: Math.max(...polygon.map((point) => point.y)),
  }
}

function pointsClose(a: Point2, b: Point2, tolerance = 0.35) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
}

function snapPointToWallEndpoint(point: Point2, project: ProjectDocument, excludeWallId?: string, tolerance = 0.5): Point2 {
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall' && element.id !== excludeWallId)
  let best: { point: Point2; distance: number } | null = null
  for (const wall of walls) {
    for (const endpoint of wall.path) {
      const distance = Math.hypot(endpoint.x - point.x, endpoint.y - point.y)
      if (distance <= tolerance && (!best || distance < best.distance)) best = { point: endpoint, distance }
    }
  }
  return best ? { ...best.point } : point
}

function normalizeWallNetwork(project: ProjectDocument, tolerance = 0.35): ProjectDocument {
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall')
  const clusters: { points: Point2[]; average: Point2 }[] = []
  for (const wall of walls) {
    for (const endpoint of wall.path) {
      const cluster = clusters.find((candidate) => pointsClose(candidate.average, endpoint, tolerance))
      if (cluster) {
        cluster.points.push(endpoint)
        cluster.average = {
          x: cluster.points.reduce((sum, point) => sum + point.x, 0) / cluster.points.length,
          y: cluster.points.reduce((sum, point) => sum + point.y, 0) / cluster.points.length,
        }
      } else {
        clusters.push({ points: [endpoint], average: { ...endpoint } })
      }
    }
  }
  function normalizedPoint(point: Point2) {
    const cluster = clusters.find((candidate) => candidate.points.some((item) => item === point) || pointsClose(candidate.average, point, tolerance))
    return cluster ? { ...cluster.average } : point
  }
  return {
    ...project,
    elements: project.elements.map((element) => {
      if (element.type !== 'wall') return element
      const start = normalizedPoint(element.path[0])
      const end = normalizedPoint(element.path[1])
      return { ...element, path: [start, end] as [Point2, Point2] }
    }),
  }
}

function boundsFromElements(elements: BuildingElement[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const points: Point2[] = []
  for (const element of elements) {
    if (element.type === 'floor') points.push(...element.polygon)
    if (element.type === 'roof') points.push(...element.footprint)
    if (element.type === 'wall') points.push(...element.path)
  }
  if (points.length === 0) return null
  return boundsFromPolygon(points)
}

function pointKey(point: Point2): string {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`
}

function polygonSignature(points: Point2[]): string {
  return points.map(pointKey).sort().join('|')
}

function wallLoopPolygons(project: ProjectDocument, levelId: string): Point2[][] {
  const normalized = normalizeWallNetwork(project)
  const walls = normalized.elements.filter((element): element is WallElement => element.type === 'wall' && element.levelId === levelId)
  const nodes = new Map<string, Point2>()
  const adjacency = new Map<string, Set<string>>()
  const components: string[][] = []
  const visited = new Set<string>()

  for (const wall of walls) {
    const a = pointKey(wall.path[0])
    const b = pointKey(wall.path[1])
    nodes.set(a, wall.path[0])
    nodes.set(b, wall.path[1])
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)?.add(b)
    adjacency.get(b)?.add(a)
  }

  for (const key of nodes.keys()) {
    if (visited.has(key)) continue
    const queue = [key]
    const component: string[] = []
    visited.add(key)
    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    components.push(component)
  }

  const loops: Point2[][] = []
  for (const component of components) {
    if (component.length < 3) continue
    if (!component.every((key) => (adjacency.get(key)?.size ?? 0) === 2)) continue
    const start = component[0]
    const ordered = [start]
    let previous: string | null = null
    let current = start
    for (let guard = 0; guard < component.length + 2; guard += 1) {
      const neighbors = [...(adjacency.get(current) ?? [])]
      const next = neighbors.find((candidate) => candidate !== previous)
      if (!next) break
      if (next === start) {
        if (ordered.length === component.length) {
          const polygon = ordered.map((key) => nodes.get(key)!).filter(Boolean)
          if (polygon.length >= 3) loops.push(ensureClockwise(polygon))
        }
        break
      }
      ordered.push(next)
      previous = current
      current = next
    }
  }

  const unique = new Map<string, Point2[]>()
  for (const loop of loops) unique.set(polygonSignature(loop), loop)
  return [...unique.values()]
}

function ensureClockwise(points: Point2[]): Point2[] {
  let signed = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    signed += (next.x - current.x) * (next.y + current.y)
  }
  return signed > 0 ? points : [...points].reverse()
}

function largestLoop(project: ProjectDocument, levelId: string): Point2[] | null {
  const loops = wallLoopPolygons(project, levelId)
  if (loops.length === 0) return null
  return loops.sort((a, b) => Math.abs(boundsArea(b)) - Math.abs(boundsArea(a)))[0]
}

function boundsArea(points: Point2[]) {
  const bounds = boundsFromPolygon(points)
  return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
}

function polygonCentroid(points: Point2[]): Point2 {
  const total = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 })
  return {
    x: total.x / Math.max(points.length, 1),
    y: total.y / Math.max(points.length, 1),
  }
}

function edgeMidpoint(start: Point2, end: Point2): Point2 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function outwardNormal(points: Point2[], edgeIndex: number): Point2 {
  const start = points[edgeIndex]
  const end = points[(edgeIndex + 1) % points.length]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const candidateA = { x: dy / length, y: -dx / length }
  const candidateB = { x: -dy / length, y: dx / length }
  const midpoint = edgeMidpoint(start, end)
  const toMidpoint = {
    x: midpoint.x - polygonCentroid(points).x,
    y: midpoint.y - polygonCentroid(points).y,
  }
  const dotA = candidateA.x * toMidpoint.x + candidateA.y * toMidpoint.y
  const dotB = candidateB.x * toMidpoint.x + candidateB.y * toMidpoint.y
  return dotA >= dotB ? candidateA : candidateB
}

function replacePolygonPoint(points: Point2[], pointIndex: number, point: Point2): Point2[] {
  return points.map((candidate, index) => index === pointIndex ? point : candidate)
}

function projectPointOntoSegment(point: Point2, start: Point2, end: Point2): Point2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return start
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }
}

function splitPolygonEdgeAtPoint(points: Point2[], edgeIndex: number, point?: Point2): Point2[] {
  if (points.length < 3) return points
  const startIndex = ((edgeIndex % points.length) + points.length) % points.length
  const endIndex = (startIndex + 1) % points.length
  const start = points[startIndex]
  const end = points[endIndex]
  const inserted = point ? projectPointOntoSegment(point, start, end) : edgeMidpoint(start, end)
  return [
    ...points.slice(0, startIndex + 1),
    inserted,
    ...points.slice(endIndex),
  ]
}

function removePolygonVertex(points: Point2[], pointIndex: number): Point2[] {
  if (points.length <= 3) return points
  return points.filter((_, index) => index !== pointIndex)
}

function cleanPolygonPoints(points: Point2[], tolerance = 0.125): Point2[] {
  if (points.length <= 3) return points
  const deduped: Point2[] = []
  for (const point of points) {
    const previous = deduped[deduped.length - 1]
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > tolerance) {
      deduped.push(point)
    }
  }
  if (deduped.length > 2) {
    const first = deduped[0]
    const last = deduped[deduped.length - 1]
    if (Math.hypot(first.x - last.x, first.y - last.y) <= tolerance) deduped.pop()
  }
  const cleaned = deduped.filter((point, index, list) => {
    if (list.length <= 3) return true
    const previous = list[(index - 1 + list.length) % list.length]
    const next = list[(index + 1) % list.length]
    const dx1 = point.x - previous.x
    const dy1 = point.y - previous.y
    const dx2 = next.x - point.x
    const dy2 = next.y - point.y
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2)
    const length1 = Math.hypot(dx1, dy1)
    const length2 = Math.hypot(dx2, dy2)
    if (length1 <= tolerance || length2 <= tolerance) return false
    return cross > tolerance * Math.max(length1, length2)
  })
  return cleaned.length >= 3 ? cleaned : points
}

function movePolygonEdgePoints(points: Point2[], edgeIndex: number, point: Point2): Point2[] {
  if (points.length < 2) return points
  const startIndex = ((edgeIndex % points.length) + points.length) % points.length
  const endIndex = (startIndex + 1) % points.length
  const start = points[startIndex]
  const end = points[endIndex]
  const midpoint = edgeMidpoint(start, end)
  const normal = outwardNormal(points, startIndex)
  const offset = (point.x - midpoint.x) * normal.x + (point.y - midpoint.y) * normal.y
  const translated = {
    x: normal.x * offset,
    y: normal.y * offset,
  }
  return points.map((candidate, index) => {
    if (index !== startIndex && index !== endIndex) return candidate
    return {
      x: candidate.x + translated.x,
      y: candidate.y + translated.y,
    }
  })
}

function addAttachedBay(points: Point2[], edgeIndex: number, depth: number): Point2[] {
  if (points.length < 3) return points
  const startIndex = ((edgeIndex % points.length) + points.length) % points.length
  const endIndex = (startIndex + 1) % points.length
  const start = points[startIndex]
  const end = points[endIndex]
  const edgeLength = Math.hypot(end.x - start.x, end.y - start.y)
  if (edgeLength < 1) return points
  const insetRatio = edgeLength < 8 ? 0.2 : 0.25
  const startInset = {
    x: start.x + (end.x - start.x) * insetRatio,
    y: start.y + (end.y - start.y) * insetRatio,
  }
  const endInset = {
    x: start.x + (end.x - start.x) * (1 - insetRatio),
    y: start.y + (end.y - start.y) * (1 - insetRatio),
  }
  const normal = outwardNormal(points, startIndex)
  const pushedStart = {
    x: startInset.x + normal.x * depth,
    y: startInset.y + normal.y * depth,
  }
  const pushedEnd = {
    x: endInset.x + normal.x * depth,
    y: endInset.y + normal.y * depth,
  }
  return [
    ...points.slice(0, startIndex + 1),
    startInset,
    pushedStart,
    pushedEnd,
    endInset,
    ...points.slice(endIndex),
  ]
}

function longestEdgeIndex(points: Point2[]): number {
  let bestIndex = 0
  let bestLength = 0
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length > bestLength) {
      bestLength = length
      bestIndex = index
    }
  }
  return bestIndex
}

function edgeLength(points: Point2[], edgeIndex: number): number {
  const start = points[edgeIndex]
  const end = points[(edgeIndex + 1) % points.length]
  return Math.hypot(end.x - start.x, end.y - start.y)
}

function clampedEdgeDepth(points: Point2[], edgeIndex: number, multiplier: number, minDepth: number, maxDepth: number, requestedDepth?: number): number {
  if (Number.isFinite(requestedDepth) && (requestedDepth ?? 0) > 0) return requestedDepth as number
  return Math.max(minDepth, Math.min(maxDepth, edgeLength(points, edgeIndex) * multiplier))
}

function distanceToSegment(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return t * Math.sqrt(lengthSquared)
}

function pointToSegmentDistance(point: Point2, start: Point2, end: Point2) {
  const projected = projectPointOntoSegment(point, start, end)
  return Math.hypot(point.x - projected.x, point.y - projected.y)
}

function pointOnWallPath(path: [Point2, Point2], center: number): Point2 {
  const length = Math.hypot(path[1].x - path[0].x, path[1].y - path[0].y)
  const ratio = length === 0 ? 0 : center / length
  return {
    x: path[0].x + (path[1].x - path[0].x) * ratio,
    y: path[0].y + (path[1].y - path[0].y) * ratio,
  }
}

function edgePath(points: Point2[], edgeIndex: number): [Point2, Point2] {
  return [points[edgeIndex], points[(edgeIndex + 1) % points.length]]
}

function wallMatchScore(wall: WallElement, path: [Point2, Point2]) {
  const direct =
    Math.hypot(wall.path[0].x - path[0].x, wall.path[0].y - path[0].y) +
    Math.hypot(wall.path[1].x - path[1].x, wall.path[1].y - path[1].y)
  const reversed =
    Math.hypot(wall.path[0].x - path[1].x, wall.path[0].y - path[1].y) +
    Math.hypot(wall.path[1].x - path[0].x, wall.path[1].y - path[0].y)
  return Math.min(direct, reversed)
}

function defaultExteriorWallForPath(path: [Point2, Point2], levelId: string, levelHeight: number, template?: Partial<WallElement>, idOverride?: string): WallElement {
  return {
    id: idOverride ?? nextId('wall'),
    type: 'wall',
    name: template?.name ?? 'Exterior wall from floor outline',
    levelId,
    path,
    height: template?.height ?? levelHeight,
    assemblyId: template?.assemblyId ?? 'wall-ext-2x6',
    bearing: template?.bearing ?? true,
    exterior: true,
    studSize: template?.studSize ?? '2x6',
    studSpacing: template?.studSpacing ?? 16,
    joinPriority: template?.joinPriority ?? 'miter',
    wallKind: template?.wallKind ?? 'exterior',
    cornerStyle: template?.cornerStyle ?? 'threeStud',
    intersectionStyle: template?.intersectionStyle ?? 'teeBacking',
    platePolicy: template?.platePolicy ?? 'doubleTop',
    halfWallCap: template?.halfWallCap ?? false,
    finishAssemblyId: template?.finishAssemblyId,
  }
}

function roofFromFloorOutline(floor: FloorElement, level: LevelModel | undefined, template?: RoofElement): RoofElement {
  return {
    id: template?.id ?? nextId('roof'),
    type: 'roof',
    name: template?.name ?? `Roof over ${floor.name}`,
    levelId: floor.levelId ?? level?.id ?? 'level-main',
    footprint: floor.polygon.map((point) => ({ ...point })),
    baseElevation: template?.baseElevation ?? ((level?.elevation ?? floor.elevation) + (level?.height ?? 9)),
    roofType: template?.roofType ?? 'gable',
    pitchRise: template?.pitchRise ?? 6,
    pitchRun: template?.pitchRun ?? 12,
    overhang: template?.overhang ?? 1,
    rafterSize: template?.rafterSize ?? '2x8',
    rafterSpacing: template?.rafterSpacing ?? 24,
    assemblyId: template?.assemblyId ?? 'roof-asphalt-gable',
    attachment: template?.attachment ?? 'freestanding',
    ridgePolicy: template?.ridgePolicy ?? 'ridgeBoard',
    purlinMode: template?.purlinMode ?? 'roofBattenNailer',
    eaveOverhang: template?.eaveOverhang ?? template?.overhang ?? 1,
    rakeOverhang: template?.rakeOverhang ?? template?.overhang ?? 1,
    roofingMaterialId: template?.roofingMaterialId ?? 'asphalt-shingle',
  }
}

export interface FloorDrivenUpdateSelection {
  syncWalls: boolean
  syncRoof: boolean
  preserveOpenings: boolean
}

export function buildProjectWithExteriorWallsSynced(
  project: ProjectDocument,
  floorId: string,
  activeLevelId: string,
  options: { preserveOpenings: boolean } = { preserveOpenings: true },
): ProjectDocument | null {
  const targetFloor = project.elements.find((element): element is FloorElement =>
    element.type === 'floor' && element.id === floorId,
  )
  if (!targetFloor || targetFloor.polygon.length < 3) return null
  const floorLevelId = targetFloor.levelId ?? activeLevelId
  const level = project.levels.find((candidate) => candidate.id === floorLevelId)
  const existingWalls = project.elements.filter(
    (element): element is WallElement => element.type === 'wall' && element.levelId === floorLevelId && element.exterior,
  )
  const openings = project.elements.filter(
    (element): element is OpeningElement => element.type === 'opening' && existingWalls.some((wall) => wall.id === element.hostWallId),
  )
  const edgePaths = targetFloor.polygon.map((_, edgeIndex) => edgePath(targetFloor.polygon, edgeIndex))
  const unusedWalls = [...existingWalls]
  const rebuiltWalls = edgePaths.map((path, edgeIndex) => {
    let bestIndex = -1
    let bestScore = Number.POSITIVE_INFINITY
    unusedWalls.forEach((wall, index) => {
      const score = wallMatchScore(wall, path)
      if (score < bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    const matchedWall = bestIndex >= 0 ? unusedWalls.splice(bestIndex, 1)[0] : undefined
    const template = matchedWall ?? existingWalls[edgeIndex] ?? existingWalls[0]
    return defaultExteriorWallForPath(path, floorLevelId, level?.height ?? 9, template, matchedWall?.id)
  })
  const remappedOpenings = options.preserveOpenings
    ? openings.flatMap((opening) => {
      const oldWall = existingWalls.find((wall) => wall.id === opening.hostWallId)
      if (!oldWall) return []
      const worldPoint = pointOnWallPath(oldWall.path, opening.center)
      let best: { wall: WallElement; distance: number } | null = null
      for (const wall of rebuiltWalls) {
        const distance = pointToSegmentDistance(worldPoint, wall.path[0], wall.path[1])
        if (!best || distance < best.distance) best = { wall, distance }
      }
      if (!best || best.distance > 3) return []
      return [{
        ...opening,
        hostWallId: best.wall.id,
        center: clampOpeningCenter(distanceToSegment(worldPoint, best.wall.path[0], best.wall.path[1]), best.wall, opening.width),
      }]
    })
    : []
  return normalizeWallNetwork({
    ...project,
    elements: [
      ...project.elements.filter((element) => {
        if (element.type === 'wall' && element.levelId === floorLevelId && element.exterior) return false
        if (element.type === 'opening' && existingWalls.some((wall) => wall.id === element.hostWallId)) return false
        return true
      }),
      ...rebuiltWalls,
      ...remappedOpenings,
    ],
  })
}

export function buildProjectWithRoofSynced(
  project: ProjectDocument,
  floorId: string,
  activeLevelId: string,
): ProjectDocument | null {
  const targetFloor = project.elements.find((element): element is FloorElement =>
    element.type === 'floor' && element.id === floorId,
  )
  if (!targetFloor || targetFloor.polygon.length < 3) return null
  const floorLevelId = targetFloor.levelId ?? activeLevelId
  const level = project.levels.find((candidate) => candidate.id === floorLevelId)
  const roofsOnLevel = project.elements.filter(
    (element): element is RoofElement => element.type === 'roof' && element.levelId === floorLevelId,
  )
  const primaryRoof = roofsOnLevel[0]
  const syncedRoof = roofFromFloorOutline(targetFloor, level, primaryRoof)
  return {
    ...project,
    elements: [
      ...project.elements.filter((element) => !(element.type === 'roof' && element.levelId === floorLevelId && element.id !== syncedRoof.id) && element.id !== syncedRoof.id),
      syncedRoof,
    ],
  }
}

export function buildProjectWithFloorDrivenUpdates(
  project: ProjectDocument,
  floorId: string,
  activeLevelId: string,
  selection: FloorDrivenUpdateSelection,
): ProjectDocument | null {
  let nextProject = project
  if (selection.syncWalls) {
    const withWalls = buildProjectWithExteriorWallsSynced(nextProject, floorId, activeLevelId, {
      preserveOpenings: selection.preserveOpenings,
    })
    if (!withWalls) return null
    nextProject = withWalls
  }
  if (selection.syncRoof) {
    const withRoof = buildProjectWithRoofSynced(nextProject, floorId, activeLevelId)
    if (!withRoof) return null
    nextProject = withRoof
  }
  return nextProject
}

function wallLength(wall: WallElement): number {
  return Math.hypot(wall.path[1].x - wall.path[0].x, wall.path[1].y - wall.path[0].y)
}

function clampOpeningCenter(center: number, wall: WallElement, width: number): number {
  const length = wallLength(wall)
  const half = Math.max(0.5, width / 2)
  if (length <= half * 2) return length / 2
  return Math.max(half, Math.min(length - half, center))
}

function clampOpeningBounds(left: number, right: number, wall: WallElement, minWidth = 1) {
  const length = wallLength(wall)
  const nextLeft = Math.max(0, Math.min(left, length - minWidth))
  const nextRight = Math.min(length, Math.max(right, nextLeft + minWidth))
  return {
    center: (nextLeft + nextRight) / 2,
    width: nextRight - nextLeft,
  }
}

function pushHistory(state: BimProjectState, project: ProjectDocument) {
  return {
    project: withUpdatedAt(project),
    past: [...state.past.slice(-49), state.project],
    future: [],
  }
}

const useBimProjectStore = create<BimProjectState>((set, get) => ({
  project: createSampleProject(),
  selectedId: null,
  mode: 'structure',
  viewMode: 'framing',
  workspaceMode: 'split',
  modelDisplayMode: 'framing',
  activeTool: 'select',
  toolSession: null,
  hoverTarget: null,
  dragState: null,
  viewportPanel: '3d',
  visibleLayers: defaultVisibleLayers,
  planViewport: { zoom: 1, pan: { x: 0, y: 0 } },
  activeLevelId: 'level-main',
  snapFeet: 0.5,
  past: [],
  future: [],
  operations: (function() {
    try {
      if (typeof localStorage !== 'undefined') return JSON.parse(localStorage.getItem('bim_ops_v1') || '[]')
    } catch (e) {}
    return []
  })(),
  operationsFuture: [],
  pushOperation: (op: Operation) => {
    const state = get()
    const nextOps = [...state.operations, op]
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bim_ops_v1', JSON.stringify(nextOps))
        // checkpoint every 10 ops to speed up replay
        if (nextOps.length % 10 === 0) {
          localStorage.setItem('bim_project_checkpoint_v1', JSON.stringify(state.project))
          localStorage.setItem('bim_checkpoint_index_v1', String(nextOps.length))
        }
      }
    } catch (e) {}
    // adding a new op clears the redo buffer
    set({ operations: nextOps, operationsFuture: [] })
  },

  createFamilyInstance: (familyId, params = undefined, origin = { x: 8, y: 8 }) => {
    const state = get()
    const registry: any = families
    const def = registry[familyId] ?? registry.sampleFloorFamily
    const p = params ?? def.defaultParams
    const partial = def.instantiate(p, origin, state.project) as Partial<BuildingElement>
    const id = nextId(def.id || 'family')
    const element = { id, ...partial } as BuildingElement
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, element] }))
    set({ selectedId: id, mode: 'structure' })
  },
  replayOperations: () => {
    // For compatibility, call loadCheckpointAndReplay which handles checkpoint index
    get().loadCheckpointAndReplay()
  },
  isReplayingOperations: false,
  exportOperations: () => {
    try { return JSON.stringify(get().operations, null, 2) } catch (e) { return '[]' }
  },
  importOperations: (json) => {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) return
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('bim_ops_v1', JSON.stringify(parsed)) } catch (e) {}
      set({ operations: parsed })
      // replay to rebuild project
      get().loadCheckpointAndReplay()
    } catch (e) {
      // ignore invalid JSON for prototype
    }
  },
  clearOperations: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bim_ops_v1')
        localStorage.removeItem('bim_project_checkpoint_v1')
        localStorage.removeItem('bim_checkpoint_index_v1')
      }
    } catch (e) {}
    set({ operations: [] })
  },
  persistCheckpoint: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bim_project_checkpoint_v1', JSON.stringify(get().project))
        localStorage.setItem('bim_checkpoint_index_v1', String(get().operations.length))
      }
    } catch (e) {}
  },
  loadCheckpointAndReplay: () => {
    const ops: Operation[] = get().operations.slice()
    // Prefer persisted checkpoint if available
    let baseline: ProjectDocument = createSampleProject()
    let checkpointIndex = 0
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('bim_project_checkpoint_v1')
        const idx = localStorage.getItem('bim_checkpoint_index_v1')
        if (raw) baseline = JSON.parse(raw)
        if (idx) checkpointIndex = Number(idx) || 0
      }
    } catch (e) {}
    set({ isReplayingOperations: true, project: baseline, past: [], future: [], selectedId: null })
    for (let i = checkpointIndex; i < ops.length; i++) {
      const op = ops[i]
      try {
        if (op.kind === 'createFloor') get().createFloorAt(op.params.start, op.params.end)
        if (op.kind === 'createWall') get().createWallAt(op.params.start, op.params.end)
        if (op.kind === 'createRoof') get().createRoofAt(op.params.start, op.params.end)
        if (op.kind === 'createPipe') get().createPipeAt(op.params.points, op.params.kind as PipeElement['pipeKind'])
        if (op.kind === 'createDuct') get().createDuctAt(op.params.points)
        if (op.kind === 'updateElement') get().updateElement(op.params.elementId, op.params.updates)
        if (op.kind === 'extrudeFace') get().extrudeFace(op.params.elementId, op.params.faceId, op.params.distance)
      } catch (e) {
        // ignore individual op failures during prototype replay
      }
    }
    set({ isReplayingOperations: false })
  },
  // Replay a specific operations array deterministically from a fresh baseline (no checkpoint)
  undoOperation: () => {
    const state = get()
    const ops = state.operations
    if (!ops || ops.length === 0) return
    const last = ops[ops.length - 1]
    const nextOps = ops.slice(0, -1)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('bim_ops_v1', JSON.stringify(nextOps))
    } catch (e) {}
    set({ operations: nextOps, operationsFuture: [last, ...state.operationsFuture] })
    // replay from baseline
    set({ isReplayingOperations: true, project: createSampleProject(), past: [], future: [], selectedId: null })
    for (const op of nextOps) {
      try {
        if (op.kind === 'createFloor') get().createFloorAt(op.params.start, op.params.end)
        if (op.kind === 'createWall') get().createWallAt(op.params.start, op.params.end)
        if (op.kind === 'createRoof') get().createRoofAt(op.params.start, op.params.end)
        if (op.kind === 'createPipe') get().createPipeAt(op.params.points, op.params.kind as PipeElement['pipeKind'])
        if (op.kind === 'createDuct') get().createDuctAt(op.params.points)
        if (op.kind === 'updateElement') get().updateElement(op.params.elementId, op.params.updates)
        if (op.kind === 'extrudeFace') get().extrudeFace(op.params.elementId, op.params.faceId, op.params.distance)
      } catch (e) {
        // ignore per-op failures during replay
      }
    }
    set({ isReplayingOperations: false })
  },

  redoOperation: () => {
    const state = get()
    const futureOps = state.operationsFuture
    if (!futureOps || futureOps.length === 0) return
    const next = futureOps[0]
    const nextOps = [...state.operations, next]
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('bim_ops_v1', JSON.stringify(nextOps))
    } catch (e) {}
    set({ operations: nextOps, operationsFuture: futureOps.slice(1) })
    // replay from baseline
    set({ isReplayingOperations: true, project: createSampleProject(), past: [], future: [], selectedId: null })
    for (const op of nextOps) {
      try {
        if (op.kind === 'createFloor') get().createFloorAt(op.params.start, op.params.end)
        if (op.kind === 'createWall') get().createWallAt(op.params.start, op.params.end)
        if (op.kind === 'createRoof') get().createRoofAt(op.params.start, op.params.end)
        if (op.kind === 'createPipe') get().createPipeAt(op.params.points, op.params.kind as PipeElement['pipeKind'])
        if (op.kind === 'createDuct') get().createDuctAt(op.params.points)
        if (op.kind === 'updateElement') get().updateElement(op.params.elementId, op.params.updates)
        if (op.kind === 'extrudeFace') get().extrudeFace(op.params.elementId, op.params.faceId, op.params.distance)
      } catch (e) {
        // ignore per-op failures during replay
      }
    }
    set({ isReplayingOperations: false })
  },
  selectedStore: null,
  cart: (function() {
    try {
      if (typeof localStorage !== 'undefined') return JSON.parse(localStorage.getItem('bim_cart') || '[]')
    } catch (e) {}
    return []
  })(),

  setMode: (mode) => set({ mode, activeTool: 'select', toolSession: null }),
  setViewMode: (viewMode) => set({ viewMode }),
  setWorkspaceMode: (workspaceMode) => set(() => {
    if (workspaceMode === 'sheets') return { workspaceMode, viewMode: 'blueprint' }
    if (workspaceMode === 'materials') return { workspaceMode, viewMode: 'takeoff' }
    if (workspaceMode === 'code') return { workspaceMode, viewMode: 'code', viewportPanel: '3d' }
    return { workspaceMode, viewMode: 'framing', viewportPanel: '3d' }
  }),
  setModelDisplayMode: (modelDisplayMode) => set({ modelDisplayMode, viewMode: modelDisplayMode === 'framing' ? 'framing' : 'architectural' }),
  setActiveTool: (toolId) => set({ activeTool: toolId, toolSession: null }),
  beginToolSession: (session) => set({ toolSession: session }),
  updateToolSession: (updates) => set((state) => ({ toolSession: state.toolSession ? { ...state.toolSession, ...updates } : null })),
  commitToolSession: () => {
    const state = get()
    const session = state.toolSession
    if (!session) return
    const start = session.start ?? session.points[0]
    const current = session.current ?? session.points[session.points.length - 1]
    if (session.toolId === 'drawFloor' && start && current) {
      get().createFloorAt(start, current)
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createFloor', params: { start, end: current } })
    }
    if (session.toolId === 'pushPull' && start && current) {
      // Prototype push/pull uses a rectangle drag to create a floor (extrude)
      get().createFloorAt(start, current)
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createFloor', params: { start, end: current } })
    }
    if (session.toolId === 'drawWall' && start && current) {
      get().createWallAt(start, current)
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createWall', params: { start, end: current } })
    }
    if (session.toolId === 'drawRoof' && start && current) {
      get().createRoofAt(start, current)
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createRoof', params: { start, end: current } })
    }
    if (session.toolId === 'drawPipe' && session.points.length >= 2) {
      get().createPipeAt(session.points, session.elementKind as PipeElement['pipeKind'])
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createPipe', params: { points: session.points, kind: session.elementKind } })
    }
    if (session.toolId === 'drawDuct' && session.points.length >= 2) {
      get().createDuctAt(session.points)
      if (!get().isReplayingOperations) get().pushOperation({ id: nextId('op'), kind: 'createDuct', params: { points: session.points } })
    }
    set({ toolSession: null, activeTool: 'select' })
  },
  cancelToolSession: () => set({ toolSession: null, activeTool: 'select', dragState: null }),
  setHoverTarget: (id) => set({ hoverTarget: id }),
  beginDrag: (dragState) => set({ dragState }),
  updateDragPoint: (point) => set((state) => ({ dragState: state.dragState ? { ...state.dragState, lastPoint: point } : null })),
  endDrag: () => set({ dragState: null }),
  setViewportPanel: (viewportPanel) => set({ viewportPanel }),
  setLayerVisible: (layer, visible) => set((state) => ({ visibleLayers: { ...state.visibleLayers, [layer]: visible } })),
  setLayerPreset: (preset) => set((state) => {
    const off = Object.fromEntries(Object.keys(defaultVisibleLayers).map((layer) => [layer, false])) as Record<LayerId, boolean>
    if (preset === 'framingOnly') {
      return {
        visibleLayers: {
          ...state.visibleLayers,
          floors: false,
          walls: false,
          roof: false,
          sheathing: false,
          siding: false,
          roofing: false,
          flooring: false,
          framing: true,
          floorFraming: true,
          wallFraming: true,
          roofFraming: true,
          foundation: true,
        },
        modelDisplayMode: 'framing',
        viewMode: 'framing',
      }
    }
    if (preset === 'floorFrame') {
      return {
        visibleLayers: { ...off, terrain: true, foundation: true, framing: true, floorFraming: true, dimensions: true, warnings: true },
        modelDisplayMode: 'framing',
        viewMode: 'framing',
      }
    }
    if (preset === 'wallFrame') {
      return {
        visibleLayers: { ...off, floors: true, framing: true, wallFraming: true, openings: true, dimensions: true, warnings: true },
        modelDisplayMode: 'framing',
        viewMode: 'framing',
      }
    }
    if (preset === 'roofFrame') {
      return {
        visibleLayers: { ...off, walls: true, framing: true, roofFraming: true, roof: true, dimensions: true, warnings: true },
        modelDisplayMode: 'framing',
        viewMode: 'framing',
      }
    }
    if (preset === 'foundationOnly') {
      return {
        visibleLayers: { ...off, terrain: true, foundation: true, framing: true, dimensions: true, warnings: true },
        modelDisplayMode: 'framing',
        viewMode: 'framing',
      }
    }
    if (preset === 'systemsOnly') {
      return {
        visibleLayers: { ...off, floors: true, walls: true, openings: true, electrical: true, plumbing: true, hvac: true, dimensions: true, warnings: true },
        modelDisplayMode: 'architectural',
        viewMode: 'mep',
      }
    }
    if (preset === 'finishedOnly') {
      return {
        visibleLayers: {
          ...state.visibleLayers,
          floors: true,
          walls: true,
          roof: true,
          sheathing: true,
          siding: true,
          roofing: true,
          flooring: true,
          framing: false,
          floorFraming: false,
          wallFraming: false,
          roofFraming: false,
          foundation: false,
        },
        modelDisplayMode: 'painted',
        viewMode: 'architectural',
      }
    }
    return { visibleLayers: { ...defaultVisibleLayers } }
  }),
  setPlanViewport: (updates) => set((state) => ({ planViewport: { ...state.planViewport, ...updates } })),
  fitPlanToProject: () => set({ planViewport: { zoom: 1, pan: { x: 0, y: 0 } } }),
  selectElement: (id) => set({ selectedId: id }),
  setSnapFeet: (snapFeet) => set({ snapFeet }),
  setActiveLevel: (levelId) => set({ activeLevelId: levelId }),

  setSelectedStore: (store) => set({ selectedStore: store }),

  addToCart: (product, quantity = 1) => {
    const state = get()
    const existing = state.cart.find((item) => item.product.sku === product.sku)
    let nextCart
    if (existing) {
      nextCart = state.cart.map((item) => (item.product.sku === product.sku ? { ...item, quantity: item.quantity + quantity } : item))
    } else {
      nextCart = [...state.cart, { product, quantity }]
    }
    try {
      localStorage.setItem('bim_cart', JSON.stringify(nextCart))
    } catch (e) {}
    set({ cart: nextCart })
  },

  removeFromCart: (sku) => {
    const state = get()
    const nextCart = state.cart.filter((item) => item.product.sku !== sku)
    try { localStorage.setItem('bim_cart', JSON.stringify(nextCart)) } catch (e) {}
    set({ cart: nextCart })
  },

  updateCartItem: (sku, quantity) => {
    const state = get()
    const nextCart = state.cart.map((item) => (item.product.sku === sku ? { ...item, quantity } : item)).filter((i) => i.quantity > 0)
    try { localStorage.setItem('bim_cart', JSON.stringify(nextCart)) } catch (e) {}
    set({ cart: nextCart })
  },

  clearCart: () => {
    try { localStorage.removeItem('bim_cart') } catch (e) {}
    set({ cart: [] })
  },

  commitProject: (project) => set((state) => pushHistory(state, project)),

  updateElement: (id, updates) => {
    const state = get()
    const project = {
      ...state.project,
      elements: state.project.elements.map((element) =>
        element.id === id ? ({ ...element, ...updates } as BuildingElement) : element,
      ),
    }
    set(pushHistory(state, project))
    try {
      if (!get().isReplayingOperations) {
        get().pushOperation({ id: createOpId('op'), kind: 'updateElement', params: { elementId: id, updates } })
      }
    } catch (e) {}
  },

  extrudeFace: (elementId, faceId, distance) => {
    const state = get()
    const element = state.project.elements.find((e) => e.id === elementId)
    if (!element) return
    if (element.type === 'wall') {
      const newHeight = Math.max(0.5, (element.height ?? 9) + distance)
      const project = {
        ...state.project,
        elements: state.project.elements.map((e) => (e.id === elementId ? ({ ...e, height: newHeight } as BuildingElement) : e)),
      }
      set(pushHistory(state, project))
    } else if (element.type === 'floor') {
      const newElevation = (element.elevation ?? 0) + distance
      const project = {
        ...state.project,
        elements: state.project.elements.map((e) => (e.id === elementId ? ({ ...e, elevation: newElevation } as BuildingElement) : e)),
      }
      set(pushHistory(state, project))
    } else {
      return
    }
    try {
      if (!get().isReplayingOperations) {
        get().pushOperation({ id: nextId('op'), kind: 'extrudeFace', params: { elementId, faceId, distance } as any })
      }
    } catch (e) {}
  },

  setElementPreview: (id, updates) => {
    set((state) => {
      const project = {
        ...state.project,
        elements: state.project.elements.map((element) => (element.id === id ? ({ ...element, ...updates } as BuildingElement) : element)),
      }
      return { project }
    })
  },

  addSupplierProduct: (product) => {
    const state = get()
    const existing = state.project.suppliers.products.filter((p) => p.sku !== product.sku)
    const project = {
      ...state.project,
      suppliers: { ...state.project.suppliers, products: [...existing, product] },
    }
    set(pushHistory(state, project))
  },

  removeElement: (id) => {
    const state = get()
    const project = {
      ...state.project,
      elements: state.project.elements.filter((element) => element.id !== id && (element.type !== 'opening' || element.hostWallId !== id)),
    }
    set({ ...pushHistory(state, project), selectedId: state.selectedId === id ? null : state.selectedId })
  },

  updateTerrain: (updates) => {
    const state = get()
    const project = {
      ...state.project,
      site: {
        ...state.project.site,
        terrain: {
          ...state.project.site.terrain,
          ...updates,
          plane: updates.plane ? { ...state.project.site.terrain.plane, ...updates.plane } : state.project.site.terrain.plane,
        },
      },
    }
    set(pushHistory(state, project))
  },

  updateTerrainPoint: (id, updates) => {
    const state = get()
    const project = {
      ...state.project,
      site: {
        ...state.project.site,
        terrain: {
          ...state.project.site.terrain,
          points: state.project.site.terrain.points.map((point) => (point.id === id ? { ...point, ...updates } : point)),
        },
      },
    }
    set(pushHistory(state, project))
  },

  addTerrainPoint: (point) => {
    const state = get()
    const newPoint: TerrainPoint = { ...point, id: nextId('terrain-point') }
    const project = {
      ...state.project,
      site: {
        ...state.project.site,
        terrain: {
          ...state.project.site.terrain,
          type: 'tin' as const,
          points: [...state.project.site.terrain.points, newPoint],
        },
      },
    }
    set(pushHistory(state, project))
  },

  setTerrainKind: (type) => {
    const state = get()
    const project = {
      ...state.project,
      site: {
        ...state.project.site,
        terrain: { ...state.project.site.terrain, type },
      },
    }
    set(pushHistory(state, project))
  },

  addWall: () => {
    const state = get()
    const offset = state.project.elements.filter((element) => element.type === 'wall').length * 2
    const wall = {
      id: nextId('wall'),
      type: 'wall' as const,
      name: 'New exterior wall',
      levelId: state.activeLevelId,
      path: [{ x: 4, y: 24 + offset }, { x: 18, y: 24 + offset }] as [Point2, Point2],
      height: 9,
      assemblyId: 'wall-ext-2x6',
      bearing: true,
      exterior: true,
      studSize: '2x6',
      studSpacing: 16,
      joinPriority: 'miter' as const,
      wallKind: 'exterior' as const,
      cornerStyle: 'threeStud' as const,
      intersectionStyle: 'teeBacking' as const,
      platePolicy: 'doubleTop' as const,
      halfWallCap: false,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, wall] }))
    set({ selectedId: wall.id })
  },

  addFloor: () => {
    const state = get()
    const id = nextId('floor')
    const floor = {
      id,
      type: 'floor' as const,
      name: 'New raised floor',
      levelId: state.activeLevelId,
      polygon: [
        { x: 2, y: 2 },
        { x: 18, y: 2 },
        { x: 18, y: 14 },
        { x: 2, y: 14 },
      ],
      elevation: 3,
      assemblyId: 'floor-2x10',
      joistDirection: 'x' as const,
      joistSize: '2x10',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      framingMode: 'raisedFloor' as const,
      deckMode: 'none' as const,
      blockingPolicy: 'supportAndMidspan' as const,
      beamLayout: 'edgeAndInterior' as const,
      postLayout: 'underBeams' as const,
      surfaceMaterialId: 'subfloor-3-4',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, floor] }))
    set({ selectedId: id })
  },

  addDeck: () => {
    const state = get()
    const id = nextId('deck')
    const deck: FloorElement = {
      id,
      type: 'floor',
      name: 'Raised deck platform',
      levelId: state.activeLevelId,
      polygon: [
        { x: 2, y: 22 },
        { x: 18, y: 22 },
        { x: 18, y: 34 },
        { x: 2, y: 34 },
      ],
      elevation: state.project.levels.find((level) => level.id === state.activeLevelId)?.elevation ?? 3,
      assemblyId: 'floor-2x10',
      joistDirection: 'x',
      joistSize: '2x10',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      framingMode: 'deck',
      deckMode: 'freestanding',
      ledgerEdge: null,
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
      surfaceMaterialId: 'oak-flooring-3-4',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, deck] }))
    set({ selectedId: id, mode: 'structure' })
  },

  addHalfWall: () => {
    const state = get()
    const id = nextId('half-wall')
    const wall: WallElement = {
      id,
      type: 'wall',
      name: 'Half wall / pony wall',
      levelId: state.activeLevelId,
      path: [{ x: 4, y: 18 }, { x: 14, y: 18 }],
      height: 3.5,
      assemblyId: 'wall-int-2x4',
      bearing: false,
      exterior: false,
      studSize: '2x4',
      studSpacing: 16,
      joinPriority: 'butt',
      wallKind: 'halfWall',
      cornerStyle: 'threeStud',
      intersectionStyle: 'teeBacking',
      platePolicy: 'singleTop',
      halfWallCap: true,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, wall] }))
    set({ selectedId: id, mode: 'structure' })
  },

  addRoof: () => {
    const state = get()
    const id = nextId('roof')
    const roof = {
      id,
      type: 'roof' as const,
      name: 'New gable roof',
      levelId: state.activeLevelId,
      footprint: [
        { x: 2, y: 2 },
        { x: 18, y: 2 },
        { x: 18, y: 14 },
        { x: 2, y: 14 },
      ],
      baseElevation: 12,
      roofType: 'gable' as const,
      pitchRise: 6,
      pitchRun: 12,
      overhang: 1,
      rafterSize: '2x8',
      rafterSpacing: 24,
      assemblyId: 'roof-asphalt-gable',
      attachment: 'freestanding' as const,
      ridgePolicy: 'ridgeBoard' as const,
      purlinMode: 'roofBattenNailer' as const,
      eaveOverhang: 1,
      rakeOverhang: 1,
      roofingMaterialId: 'asphalt-shingle',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, roof] }))
    set({ selectedId: id })
  },

  addStair: () => {
    const state = get()
    const id = nextId('stair')
    const stair: StairElement = {
      id,
      type: 'stair',
      name: 'Exterior access stairs',
      levelId: state.activeLevelId,
      position: { x: 12, y: 22 },
      direction: 'y',
      width: 4,
      totalRise: state.project.levels.find((level) => level.id === state.activeLevelId)?.elevation ?? 3,
      treadDepth: 0.92,
      riserHeight: 0.58,
      stringerSize: '2x12',
      materialId: 'stringer-2x12',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, stair] }))
    set({ selectedId: id, mode: 'structure' })
  },

  addAccessory: (kind) => {
    const state = get()
    const id = nextId(kind)
    const accessory: HouseAccessoryElement = {
      id,
      type: 'houseAccessory',
      name: kind === 'guardRail' ? 'Guard rail run' : kind === 'landing' ? 'Stair landing' : kind === 'column' ? 'Post / column' : `${kind} accessory`,
      levelId: state.activeLevelId,
      accessoryKind: kind,
      position: {
        x: kind === 'column' ? 2 : 10,
        y: kind === 'column' ? 2 : 22,
        z: state.project.levels.find((level) => level.id === state.activeLevelId)?.elevation ?? 3,
      },
      width: kind === 'guardRail' ? 12 : kind === 'column' ? 0.5 : 5,
      depth: kind === 'guardRail' ? 0.25 : kind === 'column' ? 0.5 : 5,
      height: kind === 'guardRail' ? 3.5 : kind === 'column' ? 8 : 0.5,
      materialId: kind === 'column' ? 'post-6x6-pt' : 'stud-2x4',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, accessory] }))
    set({ selectedId: id, mode: 'structure' })
  },

  addOpening: (wallId) => {
    const state = get()
    const hostWall = wallId ?? state.project.elements.find((element) => element.type === 'wall')?.id
    if (!hostWall) return
    const id = nextId('opening')
    const opening: OpeningElement = {
      id,
      type: 'opening',
      name: 'New window',
      levelId: state.activeLevelId,
      hostWallId: hostWall,
      openingKind: 'window',
      center: 6,
      width: 3,
      height: 4,
      sillHeight: 3,
      headerSize: '2x8',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, opening] }))
    set({ selectedId: id, mode: 'structure' })
  },

  addElectricalDevice: (kind = 'outlet') => {
    const state = get()
    const id = nextId(kind)
    const device: ElectricalDeviceElement = {
      id,
      type: 'electricalDevice',
      name: kind === 'panel' ? 'Electrical panel' : 'Electrical device',
      levelId: state.activeLevelId,
      deviceKind: kind,
      position: { x: 6, y: 6, z: kind === 'light' ? 9 : 1.5 },
      circuitId: state.project.elements.find((element) => element.type === 'circuit')?.id,
      loadWatts: kind === 'light' ? 60 : 180,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, device] }))
    set({ selectedId: id, mode: 'electrical' })
  },

  addCircuit: () => {
    const state = get()
    const panel = state.project.elements.find((element) => element.type === 'electricalDevice' && element.deviceKind === 'panel')
    const id = nextId('circuit')
    const circuit: CircuitElement = {
      id,
      type: 'circuit',
      name: 'New 20A circuit',
      panelId: panel?.id ?? 'panel-1',
      amperage: 20,
      voltage: 120,
      breakerType: 'dualFunction',
      wireGauge: 12,
      deviceIds: [],
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, circuit] }))
    set({ selectedId: id, mode: 'electrical' })
  },

  addPlumbingFixture: (kind = 'sink') => {
    const state = get()
    const id = nextId(kind)
    const fixture: PlumbingFixtureElement = {
      id,
      type: 'plumbingFixture',
      name: 'New plumbing fixture',
      levelId: state.activeLevelId,
      fixtureKind: kind,
      position: { x: 10, y: 10, z: 3 },
      supplyCount: kind === 'toilet' ? 1 : 2,
      drainDiameter: kind === 'toilet' ? 3 : 1.5,
      dfu: kind === 'toilet' ? 3 : 2,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, fixture] }))
    set({ selectedId: id, mode: 'plumbing' })
  },

  addPipe: (kind = 'drain') => {
    const state = get()
    const id = nextId(`${kind}-pipe`)
    const pipe: PipeElement = {
      id,
      type: 'pipe',
      name: 'New pipe run',
      levelId: state.activeLevelId,
      pipeKind: kind,
      materialId: kind === 'drain' || kind === 'vent' ? 'pex-1-2' : 'pex-1-2',
      diameter: kind === 'drain' ? 1.5 : 0.5,
      slope: kind === 'drain' ? 0.25 : undefined,
      path: [
        { x: 6, y: 6, z: 2.4 },
        { x: 14, y: 6, z: kind === 'drain' ? 2.2 : 2.4 },
      ],
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, pipe] }))
    set({ selectedId: id, mode: 'plumbing' })
  },

  addDuct: () => {
    const state = get()
    const id = nextId('duct')
    const duct: DuctElement = {
      id,
      type: 'duct',
      name: 'New duct run',
      levelId: state.activeLevelId,
      ductKind: 'supply',
      size: { width: 10, height: 6 },
      path: [
        { x: 5, y: 5, z: 8.5 },
        { x: 16, y: 5, z: 8.5 },
      ],
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, duct] }))
    set({ selectedId: id, mode: 'hvac' })
  },

  createFloorAt: (start, end) => {
    const state = get()
    const id = nextId('floor')
    const floor: FloorElement = {
      id,
      type: 'floor',
      name: 'Placed raised floor',
      levelId: state.activeLevelId,
      polygon: rectFromPoints(start, end),
      elevation: state.project.levels.find((level) => level.id === state.activeLevelId)?.elevation ?? 3,
      assemblyId: 'floor-2x10',
      joistDirection: 'x',
      joistSize: '2x10',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      framingMode: 'raisedFloor',
      deckMode: 'none',
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
      surfaceMaterialId: 'subfloor-3-4',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, floor] }))
    set({ selectedId: id, mode: 'structure' })
  },

  createWallAt: (start, end) => {
    const state = get()
    const id = nextId('wall')
    const snappedStart = snapPointToWallEndpoint(start, state.project)
    const snappedEnd = snapPointToWallEndpoint(end, state.project)
    const wall: WallElement = {
      id,
      type: 'wall',
      name: 'Placed wall',
      levelId: state.activeLevelId,
      path: [snappedStart, snappedEnd],
      height: state.project.levels.find((level) => level.id === state.activeLevelId)?.height ?? 9,
      assemblyId: 'wall-ext-2x6',
      bearing: true,
      exterior: true,
      studSize: '2x6',
      studSpacing: 16,
      joinPriority: 'miter',
      wallKind: 'exterior',
      cornerStyle: 'threeStud',
      intersectionStyle: 'teeBacking',
      platePolicy: 'doubleTop',
      halfWallCap: false,
    }
    const nextProject = normalizeWallNetwork({ ...state.project, elements: [...state.project.elements, wall] })
    set(pushHistory(state, nextProject))
    set({ selectedId: id, mode: 'structure' })
  },

  createRoofAt: (start, end) => {
    const state = get()
    const id = nextId('roof')
    const level = state.project.levels.find((candidate) => candidate.id === state.activeLevelId)
    const roof: RoofElement = {
      id,
      type: 'roof',
      name: 'Placed roof',
      levelId: state.activeLevelId,
      footprint: rectFromPoints(start, end),
      baseElevation: (level?.elevation ?? 3) + (level?.height ?? 9),
      roofType: 'gable',
      pitchRise: 6,
      pitchRun: 12,
      overhang: 1,
      rafterSize: '2x8',
      rafterSpacing: 24,
      assemblyId: 'roof-asphalt-gable',
      attachment: 'freestanding',
      ridgePolicy: 'ridgeBoard',
      purlinMode: 'roofBattenNailer',
      eaveOverhang: 1,
      rakeOverhang: 1,
      roofingMaterialId: 'asphalt-shingle',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, roof] }))
    set({ selectedId: id, mode: 'structure' })
  },

  createRoofFromSelection: () => {
    const state = get()
    const selected = state.project.elements.find((element) => element.id === state.selectedId)
    const level = state.project.levels.find((candidate) => candidate.id === (selected?.levelId ?? state.activeLevelId))
    const sourceElements = selected?.type === 'floor'
      ? [selected]
      : selected?.type === 'wall'
        ? state.project.elements.filter((element) => element.type === 'wall' && element.levelId === selected.levelId)
        : state.project.elements.filter((element) => element.type === 'floor' && element.levelId === state.activeLevelId)
    const bounds = boundsFromElements(sourceElements)
    const wallLoop = selected?.type === 'wall' ? largestLoop(state.project, selected.levelId ?? state.activeLevelId) : null
    if (!bounds && !wallLoop) return
    const footprint = selected?.type === 'floor'
      ? selected.polygon
      : wallLoop ?? [
        { x: bounds!.minX, y: bounds!.minY },
        { x: bounds!.maxX, y: bounds!.minY },
        { x: bounds!.maxX, y: bounds!.maxY },
        { x: bounds!.minX, y: bounds!.maxY },
      ]
    const id = nextId('roof')
    const roof: RoofElement = {
      id,
      type: 'roof',
      name: selected?.type === 'floor' ? `Roof over ${selected.name}` : 'Roof from wall envelope',
      levelId: level?.id ?? state.activeLevelId,
      footprint,
      baseElevation: (level?.elevation ?? 3) + (level?.height ?? 9),
      roofType: 'gable',
      pitchRise: 6,
      pitchRun: 12,
      overhang: 1,
      rafterSize: '2x8',
      rafterSpacing: 24,
      assemblyId: 'roof-asphalt-gable',
      attachment: 'freestanding',
      ridgePolicy: 'ridgeBoard',
      purlinMode: 'roofBattenNailer',
      eaveOverhang: 1,
      rakeOverhang: 1,
      roofingMaterialId: 'asphalt-shingle',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, roof] }))
    set({ selectedId: id, mode: 'structure' })
  },

  createFloorFromWallBounds: () => {
    const state = get()
    const selected = state.project.elements.find((element) => element.id === state.selectedId)
    const levelId = selected?.levelId ?? state.activeLevelId
    const walls = state.project.elements.filter((element) => element.type === 'wall' && element.levelId === levelId)
    const loop = largestLoop(state.project, levelId)
    const bounds = boundsFromElements(walls)
    if (!bounds && !loop) return
    const polygon = loop ?? [
      { x: bounds!.minX, y: bounds!.minY },
      { x: bounds!.maxX, y: bounds!.minY },
      { x: bounds!.maxX, y: bounds!.maxY },
      { x: bounds!.minX, y: bounds!.maxY },
    ]
    const id = nextId('floor')
    const floor: FloorElement = {
      id,
      type: 'floor',
      name: 'Floor from wall envelope',
      levelId,
      polygon,
      elevation: state.project.levels.find((level) => level.id === levelId)?.elevation ?? 3,
      assemblyId: 'floor-2x10',
      joistDirection: 'x',
      joistSize: '2x10',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      framingMode: 'raisedFloor',
      deckMode: 'none',
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
      surfaceMaterialId: 'subfloor-3-4',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, floor] }))
    set({ selectedId: id, mode: 'structure' })
  },

  createSpacesFromWallLoops: () => {
    const state = get()
    const levelId = state.project.elements.find((element) => element.id === state.selectedId)?.levelId ?? state.activeLevelId
    const loops = wallLoopPolygons(state.project, levelId)
    if (loops.length === 0) return
    const existing = new Set(state.project.spaces.filter((space) => space.levelId === levelId).map((space) => polygonSignature(space.polygon)))
    const spaces: SpaceModel[] = loops
      .filter((loop) => !existing.has(polygonSignature(loop)))
      .map((loop, index) => ({
        id: nextId('space'),
        name: `Detected Space ${state.project.spaces.length + index + 1}`,
        levelId,
        polygon: loop,
        use: 'other',
      }))
    if (spaces.length === 0) return
    set(pushHistory(state, { ...state.project, spaces: [...state.project.spaces, ...spaces] }))
  },

  cleanWallConnections: () => {
    const state = get()
    set(pushHistory(state, normalizeWallNetwork(state.project)))
  },

  createOpeningAt: (wallId, point, kind = 'window') => {
    const state = get()
    const wall = state.project.elements.find((element): element is WallElement => element.id === wallId && element.type === 'wall')
    if (!wall) return
    const id = nextId(kind)
    const opening: OpeningElement = {
      id,
      type: 'opening',
      name: kind === 'door' ? 'Placed door' : 'Placed window',
      levelId: state.activeLevelId,
      hostWallId: wallId,
      openingKind: kind,
      center: clampOpeningCenter(distanceToSegment(point, wall.path[0], wall.path[1]), wall, kind === 'door' ? 3 : 4),
      width: kind === 'door' ? 3 : 4,
      height: kind === 'door' ? 6.8 : 4,
      sillHeight: kind === 'door' ? 0 : 3,
      headerSize: '2x10',
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, opening] }))
    set({ selectedId: id, mode: 'structure' })
  },

  createElectricalDeviceAt: (point, kind = 'outlet') => {
    const state = get()
    const id = nextId(kind)
    const device: ElectricalDeviceElement = {
      id,
      type: 'electricalDevice',
      name: kind === 'panel' ? 'Placed panel' : `Placed ${kind}`,
      levelId: state.activeLevelId,
      deviceKind: kind,
      position: { ...point, z: kind === 'light' ? 9 : 1.5 },
      circuitId: state.project.elements.find((element) => element.type === 'circuit')?.id,
      loadWatts: kind === 'light' ? 60 : 180,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, device] }))
    set({ selectedId: id, mode: 'electrical' })
  },

  createPlumbingFixtureAt: (point, kind = 'sink') => {
    const state = get()
    const id = nextId(kind)
    const fixture: PlumbingFixtureElement = {
      id,
      type: 'plumbingFixture',
      name: `Placed ${kind}`,
      levelId: state.activeLevelId,
      fixtureKind: kind,
      position: { ...point, z: 3 },
      supplyCount: kind === 'toilet' ? 1 : 2,
      drainDiameter: kind === 'toilet' ? 3 : 1.5,
      dfu: kind === 'toilet' ? 3 : 2,
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, fixture] }))
    set({ selectedId: id, mode: 'plumbing' })
  },

  createPipeAt: (points, kind = 'drain') => {
    const state = get()
    const id = nextId(`${kind}-pipe`)
    const pipe: PipeElement = {
      id,
      type: 'pipe',
      name: `Placed ${kind} run`,
      levelId: state.activeLevelId,
      pipeKind: kind,
      materialId: 'pex-1-2',
      diameter: kind === 'drain' ? 1.5 : 0.5,
      slope: kind === 'drain' ? 0.25 : undefined,
      path: points.map((point, index) => ({ ...point, z: kind === 'drain' ? 2.4 - index * 0.08 : 2.4 })),
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, pipe] }))
    set({ selectedId: id, mode: 'plumbing' })
  },

  createDuctAt: (points) => {
    const state = get()
    const id = nextId('duct')
    const duct: DuctElement = {
      id,
      type: 'duct',
      name: 'Placed duct run',
      levelId: state.activeLevelId,
      ductKind: 'supply',
      size: { width: 10, height: 6 },
      path: points.map((point) => ({ ...point, z: 8.5 })),
    }
    set(pushHistory(state, { ...state.project, elements: [...state.project.elements, duct] }))
    set({ selectedId: id, mode: 'hvac' })
  },

  updateFloorBounds: (id, width, depth) => {
    const state = get()
    const floor = state.project.elements.find((element): element is FloorElement => element.id === id && element.type === 'floor')
    if (!floor) return
    const minX = Math.min(...floor.polygon.map((point) => point.x))
    const minY = Math.min(...floor.polygon.map((point) => point.y))
    get().updateElement(id, {
      polygon: [
        { x: minX, y: minY },
        { x: minX + width, y: minY },
        { x: minX + width, y: minY + depth },
        { x: minX, y: minY + depth },
      ],
    } as Partial<FloorElement>)
  },

  updateWallPath: (id, start, end) => {
    const state = get()
    const snappedStart = snapPointToWallEndpoint(start, state.project, id)
    const snappedEnd = snapPointToWallEndpoint(end, state.project, id)
    const project = normalizeWallNetwork({
      ...state.project,
      elements: state.project.elements.map((element) =>
        element.id === id && element.type === 'wall' ? { ...element, path: [snappedStart, snappedEnd] as [Point2, Point2] } : element,
      ),
    })
    set(pushHistory(state, project))
  },

  updateRoofFootprint: (id, width, depth) => {
    const state = get()
    const roof = state.project.elements.find((element): element is RoofElement => element.id === id && element.type === 'roof')
    if (!roof) return
    const minX = Math.min(...roof.footprint.map((point) => point.x))
    const minY = Math.min(...roof.footprint.map((point) => point.y))
    get().updateElement(id, {
      footprint: [
        { x: minX, y: minY },
        { x: minX + width, y: minY },
        { x: minX + width, y: minY + depth },
        { x: minX, y: minY + depth },
      ],
    } as Partial<RoofElement>)
  },

  updatePolygonVertex: (id, pointIndex, point) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor' && pointIndex >= 0 && pointIndex < element.polygon.length) {
      get().updateElement(id, { polygon: replacePolygonPoint(element.polygon, pointIndex, point) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof' && pointIndex >= 0 && pointIndex < element.footprint.length) {
      get().updateElement(id, { footprint: replacePolygonPoint(element.footprint, pointIndex, point) } as Partial<RoofElement>)
    }
  },

  movePolygonEdge: (id, edgeIndex, point) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor' && element.polygon.length >= 3) {
      get().updateElement(id, { polygon: movePolygonEdgePoints(element.polygon, edgeIndex, point) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof' && element.footprint.length >= 3) {
      get().updateElement(id, { footprint: movePolygonEdgePoints(element.footprint, edgeIndex, point) } as Partial<RoofElement>)
    }
  },

  splitPolygonEdge: (id, edgeIndex, point) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor' && element.polygon.length >= 3) {
      get().updateElement(id, { polygon: splitPolygonEdgeAtPoint(element.polygon, edgeIndex, point) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof' && element.footprint.length >= 3) {
      get().updateElement(id, { footprint: splitPolygonEdgeAtPoint(element.footprint, edgeIndex, point) } as Partial<RoofElement>)
    }
  },

  deletePolygonVertex: (id, pointIndex) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor' && element.polygon.length > 3) {
      get().updateElement(id, { polygon: removePolygonVertex(element.polygon, pointIndex) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof' && element.footprint.length > 3) {
      get().updateElement(id, { footprint: removePolygonVertex(element.footprint, pointIndex) } as Partial<RoofElement>)
    }
  },

  cleanPolygonFootprint: (id) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor') {
      get().updateElement(id, { polygon: cleanPolygonPoints(element.polygon) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof') {
      get().updateElement(id, { footprint: cleanPolygonPoints(element.footprint) } as Partial<RoofElement>)
    }
  },

  syncExteriorWallsToFloorOutline: (floorId) => {
    const state = get()
    const resolvedFloorId = floorId ?? state.selectedId
    if (!resolvedFloorId) return
    const project = buildProjectWithExteriorWallsSynced(state.project, resolvedFloorId, state.activeLevelId, {
      preserveOpenings: true,
    })
    if (!project) return
    set(pushHistory(state, project))
    set({ selectedId: resolvedFloorId, mode: 'structure' })
  },

  syncRoofToFloorOutline: (floorId) => {
    const state = get()
    const resolvedFloorId = floorId ?? state.selectedId
    if (!resolvedFloorId) return
    const project = buildProjectWithRoofSynced(state.project, resolvedFloorId, state.activeLevelId)
    if (!project) return
    set(pushHistory(state, project))
    set({ selectedId: resolvedFloorId, mode: 'structure' })
  },

  createAttachedAddition: () => {
    const state = get()
    const selected = state.project.elements.find((element) => element.id === state.selectedId)
    if (!selected) return
    get().createAttachedAdditionOnTarget(selected.id)
  },

  createAttachedAdditionOnTarget: (targetId, edgeIndex, depth) => {
    const state = get()
    const selected = state.project.elements.find((element) => element.id === targetId)
    if (!selected) return
    if (selected.type === 'floor') {
      const targetEdgeIndex = edgeIndex ?? longestEdgeIndex(selected.polygon)
      const targetDepth = clampedEdgeDepth(selected.polygon, targetEdgeIndex, 0.45, 6, 12, depth)
      get().updateElement(selected.id, { polygon: addAttachedBay(selected.polygon, targetEdgeIndex, targetDepth) } as Partial<FloorElement>)
      return
    }
    if (selected.type === 'roof') {
      const targetEdgeIndex = edgeIndex ?? longestEdgeIndex(selected.footprint)
      const targetDepth = clampedEdgeDepth(selected.footprint, targetEdgeIndex, 0.35, 4, 10, depth)
      get().updateElement(selected.id, { footprint: addAttachedBay(selected.footprint, targetEdgeIndex, targetDepth) } as Partial<RoofElement>)
      return
    }
    if (selected.type === 'wall') {
      const stateLevel = state.project.levels.find((level) => level.id === selected.levelId)
      const start = selected.path[0]
      const end = selected.path[1]
      const levelPoints = state.project.elements
        .filter((element) => element.levelId === selected.levelId)
        .flatMap((element) => {
          if (element.type === 'floor') return element.polygon
          if (element.type === 'roof') return element.footprint
          if (element.type === 'wall') return element.path
          return []
        })
      const centroid = levelPoints.length > 0 ? polygonCentroid(levelPoints) : edgeMidpoint(start, end)
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy) || 1
      const normalA = { x: dy / length, y: -dx / length }
      const normalB = { x: -dy / length, y: dx / length }
      const midpoint = edgeMidpoint(start, end)
      const toMidpoint = { x: midpoint.x - centroid.x, y: midpoint.y - centroid.y }
      const normal = normalA.x * toMidpoint.x + normalA.y * toMidpoint.y >= normalB.x * toMidpoint.x + normalB.y * toMidpoint.y ? normalA : normalB
      const targetDepth = Number.isFinite(depth) && (depth ?? 0) > 0 ? depth as number : 8
      const footprint = [
        start,
        end,
        { x: end.x + normal.x * targetDepth, y: end.y + normal.y * targetDepth },
        { x: start.x + normal.x * targetDepth, y: start.y + normal.y * targetDepth },
      ]
      const id = nextId('floor')
      const floor: FloorElement = {
        id,
        type: 'floor',
        name: `Attached addition at ${selected.name}`,
        levelId: selected.levelId,
        polygon: footprint,
        elevation: stateLevel?.elevation ?? 3,
        assemblyId: 'floor-2x10',
        joistDirection: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'y' : 'x',
        joistSize: '2x10',
        joistSpacing: 16,
        beamSpacing: 8,
        pierSpacing: 6,
        framingMode: 'raisedFloor',
        deckMode: 'none',
        blockingPolicy: 'supportAndMidspan',
        beamLayout: 'edgeAndInterior',
        postLayout: 'underBeams',
        surfaceMaterialId: 'subfloor-3-4',
      }
      set(pushHistory(state, { ...state.project, elements: [...state.project.elements, floor] }))
      set({ selectedId: id, mode: 'structure' })
    }
  },

  moveElement: (id, delta) => {
    const state = get()
    const project = {
      ...state.project,
      elements: state.project.elements.map((element) => {
        if (element.id !== id) return element
        if (element.type === 'floor') return { ...element, polygon: element.polygon.map((point) => movePoint(point, delta)) }
        if (element.type === 'roof') return { ...element, footprint: element.footprint.map((point) => movePoint(point, delta)) }
        if (element.type === 'wall') return { ...element, path: [movePoint(element.path[0], delta), movePoint(element.path[1], delta)] as [Point2, Point2] }
        if (element.type === 'stair') return { ...element, position: movePoint(element.position, delta) }
        if (element.type === 'houseAccessory') return { ...element, position: { ...element.position, x: element.position.x + delta.x, y: element.position.y + delta.y, z: element.position.z + (delta.z ?? 0) } }
        if (element.type === 'electricalDevice' || element.type === 'plumbingFixture') return { ...element, position: { ...element.position, x: element.position.x + delta.x, y: element.position.y + delta.y, z: element.position.z + (delta.z ?? 0) } }
        if (element.type === 'pipe' || element.type === 'duct') return { ...element, path: element.path.map((point) => ({ ...point, x: point.x + delta.x, y: point.y + delta.y, z: point.z + (delta.z ?? 0) })) }
        if (element.type === 'beam') return { ...element, start: movePoint(element.start, delta), end: movePoint(element.end, delta) }
        if (element.type === 'pier') return { ...element, x: element.x + delta.x, y: element.y + delta.y }
        return element
      }),
    }
    set(pushHistory(state, project))
  },

  resizeElementFromHandle: (id, handle, point) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element) return
    if (element.type === 'floor' && handle.startsWith('floor-vertex-')) {
      get().updatePolygonVertex(id, Number(handle.replace('floor-vertex-', '')), point)
      return
    }
    if (element.type === 'floor' && handle.startsWith('floor-edge-')) {
      get().movePolygonEdge(id, Number(handle.replace('floor-edge-', '')), point)
      return
    }
    if (element.type === 'floor' && handle.startsWith('floor-')) {
      const bounds = boundsFromPolygon(element.polygon)
      const fixed = {
        x: handle.endsWith('w') ? bounds.maxX : bounds.minX,
        y: handle.includes('n') ? bounds.maxY : bounds.minY,
      }
      get().updateElement(id, { polygon: rectFromPoints(fixed, point) } as Partial<FloorElement>)
      return
    }
    if (element.type === 'roof' && handle.startsWith('roof-vertex-')) {
      get().updatePolygonVertex(id, Number(handle.replace('roof-vertex-', '')), point)
      return
    }
    if (element.type === 'roof' && handle.startsWith('roof-edge-')) {
      get().movePolygonEdge(id, Number(handle.replace('roof-edge-', '')), point)
      return
    }
    if (element.type === 'roof' && handle.startsWith('roof-')) {
      const bounds = boundsFromPolygon(element.footprint)
      const fixed = {
        x: handle.endsWith('w') ? bounds.maxX : bounds.minX,
        y: handle.includes('n') ? bounds.maxY : bounds.minY,
      }
      get().updateElement(id, { footprint: rectFromPoints(fixed, point) } as Partial<RoofElement>)
      return
    }
    if (element.type === 'wall') {
      if (handle === 'wall-start') get().updateWallPath(id, point, element.path[1])
      if (handle === 'wall-end') get().updateWallPath(id, element.path[0], point)
      return
    }
    if (element.type === 'opening' && (handle === 'opening-center' || handle === 'opening-left' || handle === 'opening-right')) {
      const wall = state.project.elements.find((candidate): candidate is WallElement => candidate.id === element.hostWallId && candidate.type === 'wall')
      if (!wall) return
      const center = distanceToSegment(point, wall.path[0], wall.path[1])
      if (handle === 'opening-center') get().moveOpeningAlongWall(id, center)
      if (handle === 'opening-left') {
        const next = clampOpeningBounds(center, element.center + element.width / 2, wall)
        get().updateElement(id, next as Partial<OpeningElement>)
      }
      if (handle === 'opening-right') {
        const next = clampOpeningBounds(element.center - element.width / 2, center, wall)
        get().updateElement(id, next as Partial<OpeningElement>)
      }
    }
  },

  moveOpeningAlongWall: (id, center) => {
    const state = get()
    const opening = state.project.elements.find((candidate): candidate is OpeningElement => candidate.id === id && candidate.type === 'opening')
    const wall = opening ? state.project.elements.find((candidate): candidate is WallElement => candidate.id === opening.hostWallId && candidate.type === 'wall') : undefined
    if (!opening || !wall) return
    get().updateElement(id, { center: clampOpeningCenter(center, wall, opening.width) } as Partial<OpeningElement>)
  },

  updatePathPoint: (id, pointIndex, point) => {
    const state = get()
    const element = state.project.elements.find((candidate) => candidate.id === id)
    if (!element || (element.type !== 'pipe' && element.type !== 'duct')) return
    const path = element.path.map((candidate, index) => (index === pointIndex ? { ...candidate, ...point } : candidate))
    get().updateElement(id, { path } as Partial<PipeElement | DuctElement>)
  },

  undo: () => {
    const state = get()
    const previous = state.past[state.past.length - 1]
    if (!previous) return
    set({
      project: previous,
      past: state.past.slice(0, -1),
      future: [state.project, ...state.future],
      selectedId: null,
    })
  },

  redo: () => {
    const state = get()
    const next = state.future[0]
    if (!next) return
    set({
      project: next,
      past: [...state.past, state.project],
      future: state.future.slice(1),
      selectedId: null,
    })
  },

  loadProject: (project) => set((state) => ({ ...pushHistory(state, project), selectedId: null })),
  resetProject: () => set((state) => ({ ...pushHistory(state, createSampleProject()), selectedId: null })),
}))

export default useBimProjectStore
