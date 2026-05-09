import { create } from 'zustand'
import { createSampleProject } from '../bim/sampleProject'
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
  ModelDisplayMode,
} from '../editor/types'
import {
  BuildingElement,
  CircuitElement,
  DuctElement,
  EditorMode,
  ElectricalDeviceElement,
  FloorElement,
  HouseAccessoryElement,
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
  setMode: (mode: EditorMode) => void
  setViewMode: (viewMode: ViewMode) => void
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
  updateFloorBounds: (id: string, width: number, depth: number) => void
  updateWallPath: (id: string, start: Point2, end: Point2) => void
  updateRoofFootprint: (id: string, width: number, depth: number) => void
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

function distanceToSegment(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return t * Math.sqrt(lengthSquared)
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

  setMode: (mode) => set({ mode, activeTool: 'select', toolSession: null }),
  setViewMode: (viewMode) => set({ viewMode }),
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
    if (session.toolId === 'drawFloor' && start && current) get().createFloorAt(start, current)
    if (session.toolId === 'drawWall' && start && current) get().createWallAt(start, current)
    if (session.toolId === 'drawRoof' && start && current) get().createRoofAt(start, current)
    if (session.toolId === 'drawPipe' && session.points.length >= 2) get().createPipeAt(session.points, session.elementKind as PipeElement['pipeKind'])
    if (session.toolId === 'drawDuct' && session.points.length >= 2) get().createDuctAt(session.points)
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
    set({ selectedId: id, mode: 'electrical' })
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
    set({ selectedId: id, mode: 'electrical' })
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
    set({ selectedId: id, mode: 'electrical' })
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
      center: distanceToSegment(point, wall.path[0], wall.path[1]),
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
    set({ selectedId: id, mode: 'electrical' })
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
    set({ selectedId: id, mode: 'electrical' })
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
    set({ selectedId: id, mode: 'electrical' })
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
    if (element.type === 'floor' && handle.startsWith('floor-')) {
      const bounds = boundsFromPolygon(element.polygon)
      const fixed = {
        x: handle.endsWith('w') ? bounds.maxX : bounds.minX,
        y: handle.includes('n') ? bounds.maxY : bounds.minY,
      }
      get().updateElement(id, { polygon: rectFromPoints(fixed, point) } as Partial<FloorElement>)
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
      if (handle === 'opening-left') get().updateElement(id, { center: Math.max(center + element.width / 2, 0), width: Math.max((element.center + element.width / 2) - center, 1) } as Partial<OpeningElement>)
      if (handle === 'opening-right') get().updateElement(id, { width: Math.max(center - (element.center - element.width / 2), 1) } as Partial<OpeningElement>)
    }
  },

  moveOpeningAlongWall: (id, center) => {
    get().updateElement(id, { center: Math.max(0, center) } as Partial<OpeningElement>)
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
