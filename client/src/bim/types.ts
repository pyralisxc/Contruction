export type Units = 'imperial' | 'metric'
export type ViewMode = 'architectural' | 'framing' | 'mep' | 'code' | 'blueprint' | 'takeoff'
export type ModelDisplayMode = 'framing' | 'architectural' | 'painted'
export type EditorMode =
  | 'site'
  | 'structure'
  | 'openings'
  | 'roof'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'materials'
  | 'code'
  | 'blueprints'

export interface Point2 {
  x: number
  y: number
}

export interface Point3 extends Point2 {
  z: number
}

export interface TerrainPoint extends Point3 {
  id: string
}

export interface TerrainContour {
  id: string
  elevation: number
  points: Point2[]
}

export interface TerrainModel {
  type: 'flat' | 'slopedPlane' | 'tin'
  baseElevation: number
  points: TerrainPoint[]
  contours: TerrainContour[]
  plane?: {
    origin: Point2
    slopeX: number
    slopeY: number
  }
}

export interface SiteModel {
  units: Units
  boundary: Point2[]
  terrain: TerrainModel
}

export interface JurisdictionProfile {
  profile: 'GENERIC_IRC'
  edition: string
  notes: string
}

export interface LevelModel {
  id: string
  name: string
  elevation: number
  height: number
}

export interface AssemblyLayer {
  side?: AssemblyLayerSide
  role: AssemblyLayerRole
  materialId: string
  thickness?: number
  spacing?: number
  rValue?: number
  takeoff?: AssemblyTakeoffBehavior
}

export type AssemblyLayerSide = 'interior' | 'core' | 'exterior' | 'top' | 'bottom' | 'field' | 'edge'

export type AssemblyLayerRole =
  | 'finish'
  | 'paint'
  | 'structure'
  | 'insulation'
  | 'sheathing'
  | 'weatherBarrier'
  | 'siding'
  | 'roofing'
  | 'underlayment'
  | 'subfloor'
  | 'flooring'
  | 'service'

export interface AssemblyTakeoffBehavior {
  emitsTakeoff: boolean
  deductOpenings?: boolean
  coverage?: 'area' | 'linear' | 'count' | 'cavity'
  wasteFactorOverride?: number
  purchaseUnit?: 'sheet' | 'roll' | 'bundle' | 'box' | 'board' | 'each'
}

export interface Assembly {
  id: string
  name: string
  kind: 'wall' | 'floor' | 'roof'
  layers: AssemblyLayer[]
}

export interface SpaceModel {
  id: string
  name: string
  levelId: string
  polygon: Point2[]
  use: 'bedroom' | 'bath' | 'kitchen' | 'living' | 'utility' | 'garage' | 'other'
}

export interface BaseElement {
  id: string
  levelId?: string
  name: string
}

export interface FloorElement extends BaseElement {
  type: 'floor'
  polygon: Point2[]
  elevation: number
  assemblyId: string
  joistDirection: 'x' | 'y'
  joistSize: string
  joistSpacing: number
  beamSpacing: number
  pierSpacing: number
  framingMode?: 'platform' | 'raisedFloor' | 'deck' | 'porch'
  deckMode?: DeckMode
  ledgerEdge?: FloorEdgeCondition | null
  cantilever?: Partial<Record<FloorEdgeCondition, number>>
  blockingPolicy?: 'auto' | 'supportRows' | 'supportAndMidspan' | 'none'
  beamLayout?: 'auto' | 'edgeAndInterior' | 'interiorOnly'
  postLayout?: 'auto' | 'underBeams' | 'cornersOnly'
  surfaceMaterialId?: string
}

export interface BeamElement extends BaseElement {
  type: 'beam'
  start: Point2
  end: Point2
  elevation: number
  size: string
  materialId: string
}

export interface PierElement extends BaseElement {
  type: 'pier'
  x: number
  y: number
  topZ: number
  bottomZ: 'terrain' | number
  materialId: string
}

export interface WallElement extends BaseElement {
  type: 'wall'
  path: [Point2, Point2]
  height: number
  assemblyId: string
  bearing: boolean
  exterior: boolean
  studSize: string
  studSpacing: number
  joinPriority: 'miter' | 'butt'
  wallKind?: 'exterior' | 'interior' | 'halfWall' | 'ponyWall'
  cornerStyle?: WallCornerStyle
  intersectionStyle?: WallIntersectionStyle
  platePolicy?: 'singleTop' | 'doubleTop' | 'strapped'
  halfWallCap?: boolean
  finishAssemblyId?: string
}

export interface OpeningElement extends BaseElement {
  type: 'opening'
  hostWallId: string
  openingKind: 'door' | 'window'
  center: number
  width: number
  height: number
  sillHeight: number
  headerSize: string
}

export interface RoofElement extends BaseElement {
  type: 'roof'
  footprint: Point2[]
  baseElevation: number
  roofType: 'gable' | 'hip' | 'shed' | 'flat'
  pitchRise: number
  pitchRun: number
  overhang: number
  rafterSize: string
  rafterSpacing: number
  assemblyId: string
  attachment?: RoofAttachmentCondition
  ridgePolicy?: 'ridgeBoard' | 'ridgeBeam' | 'engineered'
  purlinMode?: PurlinMode
  eaveOverhang?: number
  rakeOverhang?: number
  roofingMaterialId?: string
}

export type FloorEdgeCondition = 'north' | 'south' | 'east' | 'west'
export type WallCornerStyle = 'threeStud' | 'california' | 'miter' | 'butt'
export type WallIntersectionStyle = 'teeBacking' | 'ladderBlocking' | 'none'
export type RoofAttachmentCondition = 'freestanding' | 'wallAttachedShed' | 'overDeck' | 'overPorch'
export type PurlinMode = 'none' | 'roofBattenNailer' | 'structuralPurlinWithStruts'
export type DeckMode = 'none' | 'freestanding' | 'ledger' | 'porch'

export interface FramingStyleProfile {
  id: string
  name: string
  platformDefault: boolean
  defaultStudSpacing: number
  defaultJoistSpacing: number
  defaultRafterSpacing: number
  defaultBlockingPolicy: NonNullable<FloorElement['blockingPolicy']>
  notes?: string
}

export interface BearingPoint {
  id: string
  sourceElementId: string
  kind: 'post' | 'pier' | 'beam' | 'ledger' | 'wall' | 'ridge' | 'strut'
  position: Point3
  supportsMemberId?: string
  supportedBy?: string
  tributaryWidth?: number
  terrainZ?: number
  status: 'resolved' | 'warning' | 'unresolved'
  note?: string
}

export interface SupportGrid {
  id: string
  sourceElementId: string
  system: 'floor' | 'deck' | 'roof' | 'wall'
  primaryDirection: 'x' | 'y'
  beamLines: Array<{
    id: string
    edge?: FloorEdgeCondition
    start: Point3
    end: Point3
    role: 'edgeBeam' | 'interiorBeam' | 'ledger' | 'bearingWall' | 'ridge'
  }>
  postPoints: BearingPoint[]
  warnings: string[]
}

export interface MemberCutFace {
  normal: Point3
  point: Point3
  angleDegrees: number
  reason: 'seatCut' | 'plumbCut' | 'miter' | 'buttTrim' | 'bearingTrim' | 'overlapTrim'
  againstMemberId?: string
}

export interface MemberJoinCondition {
  id: string
  memberId?: string
  sourceElementId: string
  kind: 'butt' | 'miter' | 'bearing' | 'ledger' | 'seatCut' | 'plumbCut' | 'blocked' | 'unresolved'
  at: Point3
  againstMemberId?: string
  note?: string
}

export interface HouseAccessoryElement extends BaseElement {
  type: 'houseAccessory'
  accessoryKind: 'deck' | 'porch' | 'landing' | 'guardRail' | 'column' | 'generic'
  position: Point3
  width: number
  depth: number
  height: number
  materialId?: string
}

export interface StairElement extends BaseElement {
  type: 'stair'
  position: Point2
  direction: 'x' | 'y'
  width: number
  totalRise: number
  treadDepth: number
  riserHeight: number
  stringerSize: string
  materialId: string
}

export interface ElectricalDeviceElement extends BaseElement {
  type: 'electricalDevice'
  deviceKind: 'panel' | 'outlet' | 'gfciOutlet' | 'switch' | 'light' | 'junction'
  position: Point3
  roomId?: string
  circuitId?: string
  loadWatts?: number
}

export interface CircuitElement extends BaseElement {
  type: 'circuit'
  panelId: string
  amperage: 15 | 20 | 30 | 40 | 50 | 60 | 100 | 200
  voltage: 120 | 240
  breakerType: 'standard' | 'gfci' | 'afci' | 'dualFunction'
  wireGauge: 14 | 12 | 10 | 8 | 6 | 4 | 2
  deviceIds: string[]
}

export interface PlumbingFixtureElement extends BaseElement {
  type: 'plumbingFixture'
  fixtureKind: 'sink' | 'toilet' | 'shower' | 'tub' | 'washer' | 'dishwasher' | 'waterHeater' | 'hoseBib'
  position: Point3
  roomId?: string
  supplyCount: number
  drainDiameter: number
  dfu: number
}

export interface PipeElement extends BaseElement {
  type: 'pipe'
  pipeKind: 'supply' | 'drain' | 'vent' | 'gas'
  materialId: string
  diameter: number
  path: Point3[]
  slope?: number
}

export interface DuctElement extends BaseElement {
  type: 'duct'
  ductKind: 'supply' | 'return' | 'exhaust'
  size: { width: number; height: number }
  path: Point3[]
}

export type BuildingElement =
  | FloorElement
  | BeamElement
  | PierElement
  | WallElement
  | OpeningElement
  | RoofElement
  | StairElement
  | ElectricalDeviceElement
  | CircuitElement
  | PlumbingFixtureElement
  | PipeElement
  | DuctElement
  | HouseAccessoryElement

export interface MaterialSpec {
  id: string
  name: string
  category: 'lumber' | 'sheetGood' | 'concrete' | 'fastener' | 'connector' | 'electrical' | 'plumbing' | 'finish' | 'roofing' | 'insulation' | 'hvac'
  unit: 'each' | 'linearFt' | 'sqFt' | 'cuFt' | 'box' | 'roll'
  wasteFactor: number
  nominal?: string
  profile?: MaterialProfile
  notes?: string
}

export interface MaterialProfile {
  nominal: string
  actualWidth: number
  actualDepth: number
  actualLength?: number
  visualRole?: 'dimensionalLumber' | 'post' | 'sheet' | 'finish' | 'mep'
}

export interface FramingMember {
  id: string
  sourceElementId: string
  subsystem: 'floor' | 'wall' | 'roof' | 'pier' | 'mep'
  role: string
  materialId: string
  start: Point3
  end: Point3
  lengthAxis: Point3
  widthAxis: Point3
  depthAxis: Point3
  size?: string
  visualRole?: 'joist' | 'beam' | 'rim' | 'blocking' | 'stud' | 'plate' | 'header' | 'sill' | 'rafter' | 'purlin' | 'ridge' | 'fascia' | 'rake' | 'post' | 'tie'
  orientation?: MemberOrientation
  spec?: StructuralMemberSpec
  cutLength?: number
  stockLength?: number
  endCuts?: FramingEndCuts
  startCondition?: MemberJoinCondition
  endCondition?: MemberJoinCondition
  bearingAt?: BearingPoint[]
  trimmedBy?: string[]
  cutFaces?: MemberCutFace[]
  collisionPriority?: number
  count: number
}

export type MemberOrientation = 'onEdge' | 'flat' | 'vertical' | 'slopedOnEdge' | 'builtUp' | 'nonStructural'

export interface FramingCut {
  kind: 'square' | 'plumb' | 'seat' | 'miter' | 'birdsmouth' | 'unknown'
  angleDegrees: number
  note?: string
}

export interface FramingEndCuts {
  start: FramingCut
  end: FramingCut
}

export interface StructuralMemberSpec {
  memberType:
    | 'stud'
    | 'joist'
    | 'rafter'
    | 'purlin'
    | 'beam'
    | 'header'
    | 'post'
    | 'strut'
    | 'blocking'
    | 'plate'
    | 'rim'
    | 'ridge'
    | 'tie'
  nominalSize: string
  materialId: string
  orientation: MemberOrientation
  spacing?: number
  span?: number
  plyCount?: number
  species?: string
  grade?: string
  bearingRole?: 'loadBearing' | 'nonBearing' | 'bracing' | 'finishSupport'
}

export type QuaternionTuple = [number, number, number, number]

export interface FramingCrossSection {
  width: number
  depth: number
}

export interface FramingRenderable {
  id: string
  memberId: string
  sourceElementId: string
  subsystem: FramingMember['subsystem']
  role: string
  materialId: string
  start: Point3
  end: Point3
  center: Point3
  length: number
  lengthAxis: Point3
  widthAxis: Point3
  depthAxis: Point3
  quaternion: QuaternionTuple
  crossSection: FramingCrossSection
  rollRadians: number
  profile?: MaterialProfile
  visualRole?: FramingMember['visualRole']
  cutLength?: number
  stockLength?: number
  endCuts?: FramingEndCuts
  startCondition?: MemberJoinCondition
  endCondition?: MemberJoinCondition
  cutFaces?: MemberCutFace[]
  collisionPriority?: number
  color: string
  size?: string
}

export interface PierBlockDerived {
  id: string
  sourceElementId: string
  materialId: string
  center: Point3
  width: number
  depth: number
  height: number
}

export interface RoofPlaneDerived {
  id: string
  sourceElementId: string
  kind: 'left' | 'right' | 'single' | 'hip' | 'gable'
  polygon: Point3[]
  area: number
  materialId?: string
  finishMaterialId?: string
}

export interface TerrainMesh {
  vertices: Point3[]
  triangles: [number, number, number][]
}

export interface TerrainContourDerived {
  id: string
  elevation: number
  points: Point3[]
}

export interface EnvelopeSurface {
  id: string
  sourceElementId: string
  assemblyId: string
  layerIndex: number
  layerRole: AssemblyLayerRole
  materialId: string
  side: AssemblyLayerSide
  polygon: Point3[]
  grossArea: number
  openingArea: number
  netArea: number
  thickness?: number
  location: string
  phase: TakeoffLine['phase']
}

export interface LayerTakeoffFragment {
  id: string
  sourceElementId: string
  assemblyId: string
  layerIndex: number
  materialId: string
  description: string
  subsystem: TakeoffLine['subsystem']
  phase: TakeoffLine['phase']
  location: string
  quantity: number
  unit: MaterialSpec['unit']
  wasteFactor: number
  supplierKey?: string
}

export interface DerivedModel {
  terrainMesh: TerrainMesh
  terrainContours: TerrainContourDerived[]
  framing: FramingMember[]
  framingRenderables: FramingRenderable[]
  pierBlocks: PierBlockDerived[]
  roofPlanes: RoofPlaneDerived[]
  envelopeSurfaces: EnvelopeSurface[]
  layerTakeoffFragments: LayerTakeoffFragment[]
  supportGrids: SupportGrid[]
  bearingPoints: BearingPoint[]
  joinConditions: MemberJoinCondition[]
  unresolvedIntersections: MemberJoinCondition[]
  pierHeights: Record<string, number>
  clashes: RuleResult[]
}

export interface RuleReference {
  standard: string
  section: string
  url: string
}

export interface RuleResult {
  id: string
  status: 'pass' | 'warning' | 'fail' | 'requiresEngineer' | 'requiresAHJ'
  severity: 'info' | 'warning' | 'error'
  elementId?: string
  title: string
  message: string
  suggestion?: string
  highlightTarget?: {
    elementId?: string
    memberId?: string
    kind: 'element' | 'framingMember' | 'terrain' | 'room'
  }
  reference: RuleReference
}

export interface TakeoffLine {
  id: string
  materialId: string
  description: string
  subsystem: 'site' | 'framing' | 'roofing' | 'siding' | 'flooring' | 'electrical' | 'plumbing' | 'hvac' | 'finishes'
  phase: 'sitework' | 'foundation' | 'roughFraming' | 'roughMEP' | 'dryIn' | 'finishes'
  location: string
  sourceElementId: string
  quantity: number
  unit: MaterialSpec['unit']
  wasteFactor: number
}

export interface TakeoffSummary {
  lines: TakeoffLine[]
  totalsBySubsystem: Record<string, number>
  totalsByLocation: Record<string, number>
  estimatedCost: number
}

export interface SupplierProduct {
  supplier: 'homeDepot' | 'lowes' | 'local'
  sku: string
  title: string
  materialId: string
  unitPrice: number
  unit: MaterialSpec['unit']
  storeName: string
  zipCode: string
  availableQty: number
  productUrl: string
  lastUpdated: string
}

export interface SupplierSelection {
  preferredSupplier: 'homeDepot' | 'lowes' | 'local'
  zipCode: string
  products: SupplierProduct[]
}

export interface ProjectDocument {
  schemaVersion: 'bimlite.v1'
  id: string
  name: string
  updatedAt: string
  jurisdiction: JurisdictionProfile
  site: SiteModel
  levels: LevelModel[]
  spaces: SpaceModel[]
  assemblies: Record<string, Assembly>
  materials: Record<string, MaterialSpec>
  elements: BuildingElement[]
  suppliers: SupplierSelection
}
