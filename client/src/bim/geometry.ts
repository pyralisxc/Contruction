import {
  BuildingElement,
  BearingPoint,
  DerivedModel,
  FloorEdgeCondition,
  FloorElement,
  FramingCrossSection,
  FramingEndCuts,
  FramingMember,
  FramingRenderable,
  MaterialProfile,
  MemberOrientation,
  OpeningElement,
  PierBlockDerived,
  PipeElement,
  Point2,
  Point3,
  ProjectDocument,
  QuaternionTuple,
  RoofElement,
  RoofPlaneDerived,
  RoofTopologyDerived,
  RuleResult,
  StairElement,
  SupportGrid,
  TerrainContourDerived,
  WallSolidDerived,
  WallElement,
} from './types'
import { deriveEnvelopeSurfaces, deriveLayerTakeoffFragments, normalizeAssembly } from './assembly'
import { intervalContains, isOrthogonalPolygon, lineIntervalsInPolygon, pointInPolygon, polygonPerimeterSegments } from './framingGeometry'
import { purlinSpacingForRoof } from './spanTables'
import { calculatePierHeight, generateTerrainMesh, sampleTerrain } from './terrain'

const inchesToFeet = (value: number) => value / 12

export function distance2(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function polygonArea(points: Point2[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return Math.abs(area / 2)
}

export function polygonBounds(points: Point2[]) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

export function getElement(project: ProjectDocument, id: string): BuildingElement | undefined {
  return project.elements.find((element) => element.id === id)
}

export function getWallOpenings(project: ProjectDocument, wallId: string): OpeningElement[] {
  return project.elements.filter(
    (element): element is OpeningElement => element.type === 'opening' && element.hostWallId === wallId,
  )
}

function vectorBetween(start: Point3, end: Point3): Point3 {
  return { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z }
}

function normalize3(vector: Point3, fallback: Point3 = { x: 1, y: 0, z: 0 }): Point3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length < 0.0001) return fallback
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function cross3(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function dot3(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function axesForMember(lengthAxis: Point3, orientation: MemberOrientation, visualRole?: FramingMember['visualRole']): Pick<FramingMember, 'widthAxis' | 'depthAxis'> {
  const up = { x: 0, y: 0, z: 1 }
  if (orientation === 'vertical') {
    return { widthAxis: { x: 1, y: 0, z: 0 }, depthAxis: { x: 0, y: 1, z: 0 } }
  }
  if (orientation === 'flat' || visualRole === 'sill') {
    const depthAxis = normalize3(cross3(up, lengthAxis), { x: 0, y: 1, z: 0 })
    return { widthAxis: up, depthAxis }
  }
  const depthAxis = Math.abs(dot3(lengthAxis, up)) > 0.95
    ? { x: 0, y: 1, z: 0 }
    : up
  return { widthAxis: normalize3(cross3(lengthAxis, depthAxis), { x: 1, y: 0, z: 0 }), depthAxis }
}

function wallAxes(dx: number, dy: number) {
  return {
    along: normalize3({ x: dx, y: dy, z: 0 }),
    normal: normalize3({ x: -dy, y: dx, z: 0 }, { x: 0, y: 1, z: 0 }),
    up: { x: 0, y: 0, z: 1 },
  }
}

function quaternionFromAxes(widthAxis: Point3, lengthAxis: Point3, depthAxis: Point3): QuaternionTuple {
  const wx = { x: widthAxis.x, y: widthAxis.z, z: widthAxis.y }
  const ly = { x: lengthAxis.x, y: lengthAxis.z, z: lengthAxis.y }
  const mappedDepth = { x: depthAxis.x, y: depthAxis.z, z: depthAxis.y }
  let dz = {
    x: wx.y * ly.z - wx.z * ly.y,
    y: wx.z * ly.x - wx.x * ly.z,
    z: wx.x * ly.y - wx.y * ly.x,
  }
  if (dz.x * mappedDepth.x + dz.y * mappedDepth.y + dz.z * mappedDepth.z < 0) {
    wx.x *= -1
    wx.y *= -1
    wx.z *= -1
    dz = {
      x: wx.y * ly.z - wx.z * ly.y,
      y: wx.z * ly.x - wx.x * ly.z,
      z: wx.x * ly.y - wx.y * ly.x,
    }
  }
  const m00 = wx.x
  const m01 = ly.x
  const m02 = dz.x
  const m10 = wx.y
  const m11 = ly.y
  const m12 = dz.y
  const m20 = wx.z
  const m21 = ly.z
  const m22 = dz.z
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    return normalizeQuaternion([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s])
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    return normalizeQuaternion([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s])
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    return normalizeQuaternion([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s])
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2
  return normalizeQuaternion([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s])
}

function member(
  id: string,
  sourceElementId: string,
  subsystem: FramingMember['subsystem'],
  role: string,
  materialId: string,
  start: Point3,
  end: Point3,
  size?: string,
  visualRole?: FramingMember['visualRole'],
  endCuts?: FramingEndCuts,
  metadata: Partial<Pick<FramingMember, 'bearingAt' | 'trimmedBy' | 'cutFaces' | 'startCondition' | 'endCondition' | 'collisionPriority' | 'widthAxis' | 'depthAxis' | 'orientation'>> = {},
): FramingMember {
  const orientation = metadata.orientation ?? orientationFor(visualRole)
  const cutLength = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z)
  const lengthAxis = normalize3(vectorBetween(start, end), { x: 0, y: 0, z: 1 })
  const axes = axesForMember(lengthAxis, orientation, visualRole)
  const widthAxis = normalize3(metadata.widthAxis ?? axes.widthAxis)
  let depthAxis = normalize3(metadata.depthAxis ?? axes.depthAxis)
  if (Math.abs(dot3(widthAxis, depthAxis)) > 0.01 || Math.abs(dot3(lengthAxis, depthAxis)) > 0.01) {
    depthAxis = normalize3(cross3(widthAxis, lengthAxis), axes.depthAxis)
  }
  return {
    id,
    sourceElementId,
    subsystem,
    role,
    materialId,
    start,
    end,
    size,
    visualRole,
    spec: visualRole ? {
      memberType: memberTypeFor(visualRole),
      nominalSize: size ?? 'unknown',
      materialId,
      orientation,
      span: cutLength,
      bearingRole: bearingRoleFor(visualRole),
      plyCount: visualRole === 'beam' || visualRole === 'header' ? 2 : 1,
    } : undefined,
    cutLength,
    stockLength: stockLengthFor(cutLength, visualRole),
    endCuts: endCuts ?? defaultEndCuts(visualRole),
    ...metadata,
    orientation,
    lengthAxis,
    widthAxis,
    depthAxis,
    count: 1,
  }
}

function stockLengthFor(cutLength: number, visualRole?: FramingMember['visualRole']): number {
  if (visualRole === 'post' || visualRole === 'stud') return cutLength <= 8 ? 8 : cutLength <= 10 ? 10 : 12
  if (cutLength <= 8) return 8
  if (cutLength <= 10) return 10
  if (cutLength <= 12) return 12
  return 16
}

function defaultEndCuts(visualRole?: FramingMember['visualRole']): FramingEndCuts {
  if (visualRole === 'rafter' || visualRole === 'rake') {
    return {
      start: { kind: 'birdsmouth', angleDegrees: 90, note: 'seat/plumb cut at bearing' },
      end: { kind: 'plumb', angleDegrees: 90, note: 'plumb cut to ridge or rake' },
    }
  }
  return {
    start: { kind: 'square', angleDegrees: 90 },
    end: { kind: 'square', angleDegrees: 90 },
  }
}

function inches(width: number): number {
  return width / 12
}

const nominalProfiles: Record<string, MaterialProfile> = {
  '2x4': { nominal: '2x4', actualWidth: inches(1.5), actualDepth: inches(3.5), visualRole: 'dimensionalLumber' },
  '2x6': { nominal: '2x6', actualWidth: inches(1.5), actualDepth: inches(5.5), visualRole: 'dimensionalLumber' },
  '2x8': { nominal: '2x8', actualWidth: inches(1.5), actualDepth: inches(7.25), visualRole: 'dimensionalLumber' },
  '2x10': { nominal: '2x10', actualWidth: inches(1.5), actualDepth: inches(9.25), visualRole: 'dimensionalLumber' },
  '2x12': { nominal: '2x12', actualWidth: inches(1.5), actualDepth: inches(11.25), visualRole: 'dimensionalLumber' },
  '4x4': { nominal: '4x4', actualWidth: inches(3.5), actualDepth: inches(3.5), visualRole: 'post' },
  '4x6': { nominal: '4x6', actualWidth: inches(3.5), actualDepth: inches(5.5), visualRole: 'post' },
  '4x10': { nominal: '4x10', actualWidth: inches(3.5), actualDepth: inches(9.25), visualRole: 'dimensionalLumber' },
  '6x6': { nominal: '6x6', actualWidth: inches(5.5), actualDepth: inches(5.5), visualRole: 'post' },
  '7/16 OSB': { nominal: '7/16 OSB', actualWidth: inches(0.4375), actualDepth: inches(48), actualLength: 8, visualRole: 'sheet' },
  '3/4 subfloor': { nominal: '3/4 subfloor', actualWidth: inches(0.75), actualDepth: inches(48), actualLength: 8, visualRole: 'sheet' },
}

function profileFor(project: ProjectDocument, member: FramingMember): MaterialProfile {
  const material = project.materials[member.materialId]
  if (material?.profile) return material.profile
  if (member.size && nominalProfiles[member.size]) return nominalProfiles[member.size]
  if (material?.nominal && nominalProfiles[material.nominal]) return nominalProfiles[material.nominal]
  if (member.subsystem === 'pier') return nominalProfiles['6x6']
  if (member.role.includes('beam')) return nominalProfiles['4x10']
  if (member.role.includes('rim') || member.role.includes('joist')) return nominalProfiles['2x10']
  if (member.role.includes('rafter') || member.role.includes('ridge') || member.role.includes('fascia') || member.role.includes('rake')) return nominalProfiles['2x8']
  if (member.role.includes('purlin')) return nominalProfiles['2x4']
  if (member.role.includes('header')) return nominalProfiles['4x10']
  return nominalProfiles['2x6']
}

function materialIdForNominal(project: ProjectDocument, nominal: string, fallback: string): string {
  const match = Object.values(project.materials).find((material) => material.category === 'lumber' && material.nominal === nominal)
  return match?.id ?? fallback
}

function supportPositions(min: number, max: number, spacing: number): number[] {
  const positions = [min]
  if (spacing > 0) {
    for (let value = min + spacing; value < max - 0.001; value += spacing) positions.push(value)
  }
  if (Math.abs(positions[positions.length - 1] - max) > 0.001) positions.push(max)
  return positions
}

function normalizedFloor(floor: FloorElement): Required<Pick<FloorElement, 'framingMode' | 'deckMode' | 'blockingPolicy' | 'beamLayout' | 'postLayout'>> & FloorElement {
  const deckMode = floor.deckMode ?? (floor.name.toLowerCase().includes('deck') ? 'freestanding' : 'none')
  return {
    ...floor,
    framingMode: floor.framingMode ?? (deckMode === 'none' ? 'raisedFloor' : 'deck'),
    deckMode,
    blockingPolicy: floor.blockingPolicy ?? 'supportAndMidspan',
    beamLayout: floor.beamLayout ?? 'edgeAndInterior',
    postLayout: floor.postLayout ?? 'underBeams',
  }
}

function normalizedWall(wall: WallElement): Required<Pick<WallElement, 'wallKind' | 'cornerStyle' | 'intersectionStyle' | 'platePolicy' | 'halfWallCap'>> & WallElement {
  const wallKind = wall.wallKind ?? (wall.height <= 4 ? 'halfWall' : wall.exterior ? 'exterior' : 'interior')
  return {
    ...wall,
    wallKind,
    cornerStyle: wall.cornerStyle ?? 'threeStud',
    intersectionStyle: wall.intersectionStyle ?? 'teeBacking',
    platePolicy: wall.platePolicy ?? (wallKind === 'halfWall' || wallKind === 'ponyWall' ? 'singleTop' : 'doubleTop'),
    halfWallCap: wall.halfWallCap ?? (wallKind === 'halfWall' || wallKind === 'ponyWall' || wall.height <= 4),
  }
}

function normalizedRoof(roof: RoofElement): Required<Pick<RoofElement, 'attachment' | 'ridgePolicy' | 'purlinMode' | 'eaveOverhang' | 'rakeOverhang' | 'roofingMaterialId'>> & RoofElement {
  const shedLike = isSinglePlaneRoof(roof.roofType)
  return {
    ...roof,
    attachment: roof.attachment ?? (roof.roofType === 'shed' || roof.roofType === 'leanTo' ? 'wallAttachedShed' : roof.roofType === 'porch' ? 'overPorch' : roof.roofType === 'roofOverDeck' ? 'overDeck' : 'freestanding'),
    ridgePolicy: roof.ridgePolicy ?? (roof.roofType === 'hip' || roof.roofType === 'mansard' ? 'engineered' : shedLike ? 'ridgeBeam' : 'ridgeBoard'),
    purlinMode: roof.purlinMode ?? 'roofBattenNailer',
    eaveOverhang: roof.eaveOverhang ?? roof.overhang,
    rakeOverhang: roof.rakeOverhang ?? roof.overhang,
    roofingMaterialId: roof.roofingMaterialId ?? 'asphalt-shingle',
  }
}

function isSinglePlaneRoof(roofType: RoofElement['roofType']): boolean {
  return roofType === 'shed' || roofType === 'leanTo' || roofType === 'porch' || roofType === 'roofOverDeck' || roofType === 'flat' || roofType === 'lowSlope'
}

function roofRolePrefix(roof: RoofElement): string {
  if (roof.roofType === 'leanTo') return 'lean-to'
  if (roof.roofType === 'porch') return 'porch'
  if (roof.roofType === 'roofOverDeck') return 'roof-over-deck'
  if (roof.roofType === 'lowSlope') return 'low-slope'
  if (roof.roofType === 'flat') return 'flat'
  return 'shed'
}

function edgeForLine(floor: FloorElement, line: number): FloorEdgeCondition | undefined {
  const bounds = polygonBounds(floor.polygon)
  if (floor.joistDirection === 'x') {
    if (Math.abs(line - bounds.minX) < 0.001) return 'west'
    if (Math.abs(line - bounds.maxX) < 0.001) return 'east'
  } else {
    if (Math.abs(line - bounds.minY) < 0.001) return 'north'
    if (Math.abs(line - bounds.maxY) < 0.001) return 'south'
  }
  return undefined
}

function deriveWallSolids(project: ProjectDocument): WallSolidDerived[] {
  const solids: WallSolidDerived[] = []
  for (const inputWall of project.elements.filter((element): element is WallElement => element.type === 'wall')) {
    const wall = normalizedWall(inputWall)
    const length = distance2(wall.path[0], wall.path[1])
    if (length < 0.1) continue
    const assembly = normalizeAssembly(project, wall.assemblyId)
    const thickness = Math.max(assembly?.thickness ?? (wall.exterior ? 0.5 : 0.35), 0.125)
    const baseElevation = project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0
    const dx = (wall.path[1].x - wall.path[0].x) / length
    const dy = (wall.path[1].y - wall.path[0].y) / length
    const axes = wallAxes(dx, dy)
    const halfThickness = thickness / 2
    const insideFace = [
      { x: wall.path[0].x - axes.normal.x * halfThickness, y: wall.path[0].y - axes.normal.y * halfThickness, z: baseElevation },
      { x: wall.path[1].x - axes.normal.x * halfThickness, y: wall.path[1].y - axes.normal.y * halfThickness, z: baseElevation },
      { x: wall.path[1].x - axes.normal.x * halfThickness, y: wall.path[1].y - axes.normal.y * halfThickness, z: baseElevation + wall.height },
      { x: wall.path[0].x - axes.normal.x * halfThickness, y: wall.path[0].y - axes.normal.y * halfThickness, z: baseElevation + wall.height },
    ]
    const outsideFace = [
      { x: wall.path[0].x + axes.normal.x * halfThickness, y: wall.path[0].y + axes.normal.y * halfThickness, z: baseElevation },
      { x: wall.path[1].x + axes.normal.x * halfThickness, y: wall.path[1].y + axes.normal.y * halfThickness, z: baseElevation },
      { x: wall.path[1].x + axes.normal.x * halfThickness, y: wall.path[1].y + axes.normal.y * halfThickness, z: baseElevation + wall.height },
      { x: wall.path[0].x + axes.normal.x * halfThickness, y: wall.path[0].y + axes.normal.y * halfThickness, z: baseElevation + wall.height },
    ]
    let runningOffset = -halfThickness
    const layerBands = (assembly?.layers ?? []).map((layer) => {
      const materialThickness = layer.thickness ? layer.thickness / 12 : 0
      const profileThickness = project.materials[layer.materialId]?.profile?.actualDepth ?? 0
      const contributes = ['finish', 'paint', 'sheathing', 'weatherBarrier', 'siding', 'roofing', 'underlayment', 'subfloor', 'flooring', 'structure'].includes(layer.role)
      const bandThickness = contributes ? Math.max(materialThickness, profileThickness) : 0
      const startOffset = runningOffset
      const endOffset = Math.min(halfThickness, startOffset + bandThickness)
      runningOffset = endOffset
      return {
        layerIndex: layer.index,
        layerRole: layer.role,
        materialId: layer.materialId,
        side: layer.side,
        startOffset,
        endOffset,
      }
    })
    if (layerBands.length > 0 && Math.abs(layerBands[layerBands.length - 1].endOffset - halfThickness) > 0.001) {
      layerBands[layerBands.length - 1] = { ...layerBands[layerBands.length - 1], endOffset: halfThickness }
    }
    const openingVoids = getWallOpenings(project, wall.id)
      .map((opening) => ({
        openingId: opening.id,
        openingKind: opening.openingKind,
        centerOffset: opening.center,
        startOffset: Math.max(0, opening.center - opening.width / 2),
        endOffset: Math.min(length, opening.center + opening.width / 2),
        sillHeight: Math.max(0, opening.sillHeight),
        headHeight: Math.min(wall.height, opening.sillHeight + opening.height),
        width: opening.width,
        height: opening.height,
      }))
      .filter((opening) => opening.endOffset - opening.startOffset > 0.05 && opening.headHeight - opening.sillHeight > 0.05)

    // helper: centroid for 3D polygon
    function centroid3(points: { x: number; y: number; z: number }[]) {
      const total = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 })
      return { x: total.x / Math.max(points.length, 1), y: total.y / Math.max(points.length, 1), z: total.z / Math.max(points.length, 1) }
    }

    const insideFaceDerived = {
      id: `${wall.id}-face-inside`,
      sourceElementId: wall.id,
      kind: 'inside',
      polygon: insideFace,
      normal: { x: -axes.normal.x, y: -axes.normal.y, z: 0 },
      center: centroid3(insideFace),
    }
    const outsideFaceDerived = {
      id: `${wall.id}-face-outside`,
      sourceElementId: wall.id,
      kind: 'outside',
      polygon: outsideFace,
      normal: { x: axes.normal.x, y: axes.normal.y, z: 0 },
      center: centroid3(outsideFace),
    }

    solids.push({
      id: `${wall.id}-solid`,
      sourceElementId: wall.id,
      assemblyId: wall.assemblyId,
      start: { ...wall.path[0], z: baseElevation },
      end: { ...wall.path[1], z: baseElevation },
      center: {
        x: (wall.path[0].x + wall.path[1].x) / 2,
        y: (wall.path[0].y + wall.path[1].y) / 2,
        z: baseElevation + wall.height / 2,
      },
      length,
      height: wall.height,
      thickness,
      baseElevation,
      insideFace,
      outsideFace,
      lengthAxis: axes.along,
      thicknessAxis: axes.normal,
      upAxis: axes.up,
      openingVoids,
      layerBands,
      faces: [insideFaceDerived, outsideFaceDerived],
    })
  }
  return solids
}

function deriveFloorSupportGrid(project: ProjectDocument, inputFloor: FloorElement): SupportGrid {
  const floor = normalizedFloor(inputFloor)
  const bounds = polygonBounds(floor.polygon)
  const lines = floor.joistDirection === 'x'
    ? supportPositions(bounds.minX, bounds.maxX, floor.beamSpacing)
    : supportPositions(bounds.minY, bounds.maxY, floor.beamSpacing)
  const beamLines: SupportGrid['beamLines'] = []
  const postPoints: BearingPoint[] = []
  const warnings: string[] = []
  const beamZ = floor.elevation - 0.8
  const supportAxis = floor.joistDirection === 'x' ? 'y' : 'x'

  for (const line of lines) {
    const edge = edgeForLine(floor, line)
    const isLedger = floor.deckMode === 'ledger' && floor.ledgerEdge === edge
    const role: SupportGrid['beamLines'][number]['role'] = isLedger ? 'ledger' : edge && floor.beamLayout !== 'interiorOnly' ? 'edgeBeam' : 'interiorBeam'
    if (edge && floor.beamLayout === 'interiorOnly' && !isLedger) continue
    const intervals = lineIntervalsInPolygon(floor.polygon, supportAxis, line)
    for (const interval of intervals) {
      const start = floor.joistDirection === 'x'
        ? { x: line, y: interval.start, z: beamZ }
        : { x: interval.start, y: line, z: beamZ }
      const end = floor.joistDirection === 'x'
        ? { x: line, y: interval.end, z: beamZ }
        : { x: interval.end, y: line, z: beamZ }
      const beamLine = { id: `${floor.id}-support-${beamLines.length}`, edge, start, end, role }
      beamLines.push(beamLine)
      if (isLedger) {
        postPoints.push({
          id: `${beamLine.id}-ledger-bearing`,
          sourceElementId: floor.id,
          kind: 'ledger',
          position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: beamZ },
          supportsMemberId: beamLine.id,
          status: 'warning',
          note: 'Ledger decks require verified rim/band joist attachment and lateral load connection.',
        })
        continue
      }
      if (floor.postLayout === 'cornersOnly' && !edge) continue
      const postAxis = supportPositions(interval.start, interval.end, floor.pierSpacing)
      for (const value of postAxis) {
        const x = floor.joistDirection === 'x' ? line : value
        const y = floor.joistDirection === 'x' ? value : line
        if (!pointInPolygon({ x, y }, floor.polygon)) continue
        const terrainZ = sampleTerrain(project.site.terrain, x, y)
        const post: BearingPoint = {
          id: `${beamLine.id}-post-${postPoints.length}`,
          sourceElementId: floor.id,
          kind: 'post',
          position: { x, y, z: terrainZ },
          supportsMemberId: beamLine.id,
          terrainZ,
          status: 'resolved',
          note: edge ? `Post centered under ${edge} beam/edge line.` : 'Post centered under interior beam.',
        }
        postPoints.push(post)
      }
    }
  }

  if (!isOrthogonalPolygon(floor.polygon)) warnings.push('Skewed floor/deck footprint kept in the model; review generated beam intervals, joists, and post layout before purchase.')
  if (floor.deckMode === 'ledger' && !floor.ledgerEdge) warnings.push('Ledger deck mode is selected without a ledger edge.')
  if (postPoints.filter((point) => point.kind === 'post').length === 0 && floor.deckMode !== 'ledger') warnings.push('No post points were generated for this floor/deck support grid.')

  return {
    id: `${floor.id}-support-grid`,
    sourceElementId: floor.id,
    system: floor.deckMode === 'none' ? 'floor' : 'deck',
    primaryDirection: floor.joistDirection,
    beamLines,
    postPoints,
    warnings,
  }
}

function crossSectionFor(project: ProjectDocument, member: FramingMember): FramingCrossSection {
  const profile = profileFor(project, member)
  return { width: profile.actualWidth, depth: profile.actualDepth }
}

function colorFor(member: FramingMember): string {
  if (member.subsystem === 'pier') return '#7f5539'
  if (member.role.includes('beam')) return '#6b3f1d'
  if (member.role.includes('rim')) return '#8b5a2b'
  if (member.role.includes('joist') || member.role.includes('blocking')) return '#a16207'
  if (member.subsystem === 'roof') return '#92400e'
  if (member.role.includes('header')) return '#b45309'
  return '#8b5a2b'
}

function normalizeQuaternion(q: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(q[0], q[1], q[2], q[3])
  if (length === 0) return [0, 0, 0, 1]
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length]
}

function toRenderable(project: ProjectDocument, member: FramingMember): FramingRenderable {
  const length = Math.max(0.01, Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y, member.end.z - member.start.z))
  const profile = profileFor(project, member)
  return {
    id: `render-${member.id}`,
    memberId: member.id,
    sourceElementId: member.sourceElementId,
    subsystem: member.subsystem,
    role: member.role,
    materialId: member.materialId,
    start: member.start,
    end: member.end,
    center: {
      x: (member.start.x + member.end.x) / 2,
      y: (member.start.y + member.end.y) / 2,
      z: (member.start.z + member.end.z) / 2,
    },
    length,
    lengthAxis: member.lengthAxis,
    widthAxis: member.widthAxis,
    depthAxis: member.depthAxis,
    quaternion: quaternionFromAxes(member.widthAxis, member.lengthAxis, member.depthAxis),
    crossSection: crossSectionFor(project, member),
    rollRadians: rollFor(member),
    profile,
    visualRole: member.visualRole,
    cutLength: member.cutLength,
    stockLength: member.stockLength,
    endCuts: member.endCuts,
    startCondition: member.startCondition,
    endCondition: member.endCondition,
    cutFaces: member.cutFaces,
    collisionPriority: member.collisionPriority,
    color: colorFor(member),
    size: member.size,
  }
}

function rollFor(member: FramingMember): number {
  if (member.visualRole === 'stud' || member.visualRole === 'plate' || member.visualRole === 'header' || member.visualRole === 'sill') return Math.PI / 2
  return 0
}

function orientationFor(visualRole: FramingMember['visualRole']): MemberOrientation {
  if (visualRole === 'stud' || visualRole === 'post') return 'vertical'
  if (visualRole === 'rafter') return 'slopedOnEdge'
  if (visualRole === 'beam' || visualRole === 'header') return 'builtUp'
  if (visualRole === 'plate' || visualRole === 'sill') return 'flat'
  if (visualRole === 'joist' || visualRole === 'rim' || visualRole === 'blocking' || visualRole === 'tie' || visualRole === 'purlin' || visualRole === 'ridge' || visualRole === 'fascia' || visualRole === 'rake') return 'onEdge'
  return 'nonStructural'
}

function memberTypeFor(visualRole: NonNullable<FramingMember['visualRole']>): NonNullable<FramingMember['spec']>['memberType'] {
  if (visualRole === 'fascia' || visualRole === 'rake') return 'rafter'
  if (visualRole === 'sill') return 'blocking'
  return visualRole
}

function bearingRoleFor(visualRole: FramingMember['visualRole']): NonNullable<FramingMember['spec']>['bearingRole'] {
  if (visualRole === 'stud' || visualRole === 'joist' || visualRole === 'rafter' || visualRole === 'beam' || visualRole === 'header' || visualRole === 'post' || visualRole === 'rim') return 'loadBearing'
  if (visualRole === 'blocking' || visualRole === 'tie' || visualRole === 'purlin') return 'bracing'
  return 'finishSupport'
}

function generateFloorFraming(project: ProjectDocument, inputFloor: FloorElement, supportGrid: SupportGrid): FramingMember[] {
  const floor = normalizedFloor(inputFloor)
  const bounds = polygonBounds(floor.polygon)
  const spacing = inchesToFeet(floor.joistSpacing)
  const members: FramingMember[] = []
  const joistMaterial = materialIdForNominal(project, floor.joistSize, 'joist-2x10')
  const rimMaterial = materialIdForNominal(project, floor.joistSize, 'rim-2x10')
  const beamMaterial = materialIdForNominal(project, '4x10', 'beam-4x10')
  const topZ = floor.elevation
  const joistBearing = supportGrid.postPoints.filter((point) => point.kind === 'post')

  for (const [index, segment] of polygonPerimeterSegments(floor.polygon).entries()) {
    const bearingAt = joistBearing.filter((point) => pointInPolygon({ x: point.position.x, y: point.position.y }, [segment.start, segment.end, segment.end, segment.start]))
    members.push(member(`${floor.id}-rim-${index}`, floor.id, 'floor', 'rim/band joist', rimMaterial, { ...segment.start, z: topZ }, { ...segment.end, z: topZ }, floor.joistSize, 'rim', undefined, { bearingAt }))
  }

  if (floor.joistDirection === 'x') {
    for (let y = bounds.minY; y <= bounds.maxY + 0.001; y += spacing) {
      for (const interval of lineIntervalsInPolygon(floor.polygon, 'x', y)) {
        members.push(member(`${floor.id}-joist-${members.length}`, floor.id, 'floor', 'floor joist', joistMaterial, { x: interval.start, y, z: topZ }, { x: interval.end, y, z: topZ }, floor.joistSize, 'joist'))
      }
    }
    for (const line of supportGrid.beamLines) {
      members.push(member(`${floor.id}-beam-${members.length}`, floor.id, 'floor', line.role === 'ledger' ? 'ledger board / band attachment' : `${line.role === 'edgeBeam' ? 'edge' : 'drop'} beam`, beamMaterial, line.start, line.end, '4x10', 'beam', undefined, {
        bearingAt: supportGrid.postPoints.filter((point) => point.supportsMemberId === line.id),
        collisionPriority: line.role === 'ledger' ? 5 : 10,
      }))
    }
    members.push(...generateFloorBlocking(floor, bounds, joistMaterial, topZ, members.length))
  } else {
    for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += spacing) {
      for (const interval of lineIntervalsInPolygon(floor.polygon, 'y', x)) {
        members.push(member(`${floor.id}-joist-${members.length}`, floor.id, 'floor', 'floor joist', joistMaterial, { x, y: interval.start, z: topZ }, { x, y: interval.end, z: topZ }, floor.joistSize, 'joist'))
      }
    }
    for (const line of supportGrid.beamLines) {
      members.push(member(`${floor.id}-beam-${members.length}`, floor.id, 'floor', line.role === 'ledger' ? 'ledger board / band attachment' : `${line.role === 'edgeBeam' ? 'edge' : 'drop'} beam`, beamMaterial, line.start, line.end, '4x10', 'beam', undefined, {
        bearingAt: supportGrid.postPoints.filter((point) => point.supportsMemberId === line.id),
        collisionPriority: line.role === 'ledger' ? 5 : 10,
      }))
    }
    members.push(...generateFloorBlocking(floor, bounds, joistMaterial, topZ, members.length))
  }

  return members
}

function generateFloorBlocking(floor: FloorElement, bounds: ReturnType<typeof polygonBounds>, materialId: string, topZ: number, idOffset: number): FramingMember[] {
  const normalized = normalizedFloor(floor)
  if (normalized.blockingPolicy === 'none') return []
  const blocks: FramingMember[] = []
  const joistSpacing = inchesToFeet(floor.joistSpacing)
  const beamLines = floor.joistDirection === 'x'
    ? supportPositions(bounds.minX, bounds.maxX, floor.beamSpacing)
    : supportPositions(bounds.minY, bounds.maxY, floor.beamSpacing)
  const joistLines = floor.joistDirection === 'x'
    ? supportPositions(bounds.minY, bounds.maxY, joistSpacing)
    : supportPositions(bounds.minX, bounds.maxX, joistSpacing)
  const midspanRows = normalized.blockingPolicy === 'supportRows'
    ? []
    : floor.joistDirection === 'x'
    ? supportPositions(bounds.minX, bounds.maxX, Math.max(8, floor.beamSpacing)).slice(1, -1)
    : supportPositions(bounds.minY, bounds.maxY, Math.max(8, floor.beamSpacing)).slice(1, -1)
  const blockingRows = Array.from(new Set([...beamLines, ...midspanRows].map((value) => Number(value.toFixed(3))))).sort((a, b) => a - b)

  for (const row of blockingRows) {
    for (let index = 0; index < joistLines.length - 1; index += 1) {
      const a = joistLines[index]
      const b = joistLines[index + 1]
      const inset = Math.min(0.08, Math.max(0, (b - a) / 8))
      if (floor.joistDirection === 'x') {
        if (!intervalContains(lineIntervalsInPolygon(floor.polygon, 'y', row), a + inset, b - inset)) continue
        blocks.push(member(`${floor.id}-blocking-${idOffset}-${blocks.length}`, floor.id, 'floor', row === bounds.minX || row === bounds.maxX ? 'rim-end blocking' : 'solid blocking between joists', materialId, { x: row, y: a + inset, z: topZ }, { x: row, y: b - inset, z: topZ }, floor.joistSize, 'blocking'))
      } else {
        if (!intervalContains(lineIntervalsInPolygon(floor.polygon, 'x', row), a + inset, b - inset)) continue
        blocks.push(member(`${floor.id}-blocking-${idOffset}-${blocks.length}`, floor.id, 'floor', row === bounds.minY || row === bounds.maxY ? 'rim-end blocking' : 'solid blocking between joists', materialId, { x: a + inset, y: row, z: topZ }, { x: b - inset, y: row, z: topZ }, floor.joistSize, 'blocking'))
      }
    }
  }

  return blocks
}

function generatePiers(floor: FloorElement, supportGrid: SupportGrid): FramingMember[] {
  const members: FramingMember[] = []
  for (const point of supportGrid.postPoints.filter((candidate) => candidate.kind === 'post')) {
    members.push(member(`${floor.id}-pier-${members.length}`, floor.id, 'pier', '6x6 post over centered pier block', 'post-6x6-pt', point.position, { x: point.position.x, y: point.position.y, z: floor.elevation - 0.8 }, '6x6', 'post', undefined, {
      bearingAt: [point],
      collisionPriority: 20,
    }))
  }

  return members
}

function samePoint(a: Point2, b: Point2, tolerance = 0.05): boolean {
  return distance2(a, b) <= tolerance
}

function pointOnSegment(point: Point2, start: Point2, end: Point2, tolerance = 0.08): boolean {
  const length = distance2(start, end)
  if (length < 0.001) return false
  const dot = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / (length * length)
  if (dot <= 0.02 || dot >= 0.98) return false
  const projected = { x: start.x + (end.x - start.x) * dot, y: start.y + (end.y - start.y) * dot }
  return distance2(point, projected) <= tolerance
}

function wallJoinPoints(project: ProjectDocument, wall: WallElement) {
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall' && element.id !== wall.id)
  const endpointJoins = [wall.path[0], wall.path[1]].map((point) => ({
    point,
    connected: walls.filter((other) => samePoint(point, other.path[0]) || samePoint(point, other.path[1])),
  }))
  const teePoints = walls
    .flatMap((other) => [other.path[0], other.path[1]])
    .filter((point) => pointOnSegment(point, wall.path[0], wall.path[1]))
  return { endpointJoins, teePoints }
}

function generateWallFraming(project: ProjectDocument, inputWall: WallElement): FramingMember[] {
  const wall = normalizedWall(inputWall)
  const openings = getWallOpenings(project, wall.id)
  const length = distance2(wall.path[0], wall.path[1])
  if (length < 0.1) return []
  const spacing = inchesToFeet(wall.studSpacing)
  const start = wall.path[0]
  const end = wall.path[1]
  const dx = (end.x - start.x) / length
  const dy = (end.y - start.y) / length
  const axes = wallAxes(dx, dy)
  const studAxes = { widthAxis: axes.along, depthAxis: axes.normal }
  const flatPlateAxes = { widthAxis: axes.up, depthAxis: axes.normal, orientation: 'flat' as const }
  const headerAxes = { widthAxis: axes.normal, depthAxis: axes.up, orientation: 'builtUp' as const }
  const baseZ = project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0
  const members: FramingMember[] = []
  const materialId = materialIdForNominal(project, wall.studSize, wall.exterior ? 'stud-2x6' : 'stud-2x4')

  const { endpointJoins, teePoints } = wallJoinPoints(project, wall)
  const bottomJoin = {
    start: { id: `${wall.id}-bottom-start-join`, sourceElementId: wall.id, kind: endpointJoins[0].connected.length > 0 ? 'butt' as const : 'bearing' as const, at: { ...start, z: baseZ }, note: endpointJoins[0].connected.length > 0 ? 'Plate terminates into wall corner pack.' : 'Open wall end.' },
    end: { id: `${wall.id}-bottom-end-join`, sourceElementId: wall.id, kind: endpointJoins[1].connected.length > 0 ? 'butt' as const : 'bearing' as const, at: { ...end, z: baseZ }, note: endpointJoins[1].connected.length > 0 ? 'Plate terminates into wall corner pack.' : 'Open wall end.' },
  }

  members.push(
    member(`${wall.id}-bottom-plate`, wall.id, 'wall', 'bottom plate', materialId, { ...start, z: baseZ }, { ...end, z: baseZ }, wall.studSize, 'plate', undefined, { ...flatPlateAxes, startCondition: bottomJoin.start, endCondition: bottomJoin.end, collisionPriority: 10 }),
    member(`${wall.id}-top-plate-1`, wall.id, 'wall', 'top plate', materialId, { ...start, z: baseZ + wall.height }, { ...end, z: baseZ + wall.height }, wall.studSize, 'plate', undefined, { ...flatPlateAxes, collisionPriority: 10 }),
  )

  if (wall.platePolicy === 'doubleTop') {
    members.push(member(`${wall.id}-top-plate-2`, wall.id, 'wall', 'double top plate', materialId, { ...start, z: baseZ + wall.height - 0.12 }, { ...end, z: baseZ + wall.height - 0.12 }, wall.studSize, 'plate', undefined, { ...flatPlateAxes, collisionPriority: 11 }))
  }

  const cornerPackCount = wall.cornerStyle === 'california' ? 2 : wall.cornerStyle === 'threeStud' ? 3 : 1
  for (const [cornerIndex, endpoint] of [start, end].entries()) {
    const normalX = -dy
    const normalY = dx
    for (let packIndex = 0; packIndex < cornerPackCount; packIndex += 1) {
      const offset = (packIndex - (cornerPackCount - 1) / 2) * inchesToFeet(1.5)
      members.push(member(`${wall.id}-corner-stud-${cornerIndex}-${packIndex}`, wall.id, 'wall', `${wall.cornerStyle} corner stud pack`, materialId, { x: endpoint.x + normalX * offset, y: endpoint.y + normalY * offset, z: baseZ }, { x: endpoint.x + normalX * offset, y: endpoint.y + normalY * offset, z: baseZ + wall.height }, wall.studSize, 'stud', undefined, { ...studAxes, collisionPriority: 20 }))
    }
  }

  for (let offset = spacing; offset < length - 0.001; offset += spacing) {
    const inOpening = openings.some((opening) => offset > opening.center - opening.width / 2 && offset < opening.center + opening.width / 2)
    if (!inOpening) {
      const x = start.x + dx * offset
      const y = start.y + dy * offset
      members.push(member(`${wall.id}-stud-${members.length}`, wall.id, 'wall', 'stud', materialId, { x, y, z: baseZ }, { x, y, z: baseZ + wall.height }, wall.studSize, 'stud', undefined, studAxes))
    }
  }

  for (const opening of openings) {
    const left = opening.center - opening.width / 2
    const right = opening.center + opening.width / 2
    const sill = baseZ + opening.sillHeight
    const head = sill + opening.height
    const headerMaterialId = materialIdForNominal(project, openingHeaderNominal(opening.headerSize), 'beam-4x10')
    for (const offset of [left, right]) {
      const x = start.x + dx * offset
      const y = start.y + dy * offset
      members.push(
        member(`${opening.id}-king-${offset}`, wall.id, 'wall', 'king stud', materialId, { x, y, z: baseZ }, { x, y, z: baseZ + wall.height }, wall.studSize, 'stud', undefined, studAxes),
        member(`${opening.id}-trimmer-${offset}`, wall.id, 'wall', 'trimmer stud', materialId, { x, y, z: baseZ }, { x, y, z: head }, wall.studSize, 'stud', undefined, studAxes),
      )
    }
    members.push(member(`${opening.id}-header`, wall.id, 'wall', `${opening.headerSize} header`, headerMaterialId, { x: start.x + dx * left, y: start.y + dy * left, z: head }, { x: start.x + dx * right, y: start.y + dy * right, z: head }, openingHeaderNominal(opening.headerSize), 'header', undefined, headerAxes))
    if (opening.openingKind === 'window') {
      members.push(member(`${opening.id}-sill`, wall.id, 'wall', 'rough sill', materialId, { x: start.x + dx * left, y: start.y + dy * left, z: sill }, { x: start.x + dx * right, y: start.y + dy * right, z: sill }, wall.studSize, 'sill', undefined, flatPlateAxes))
    }
    for (let offset = left + spacing; offset < right - 0.001; offset += spacing) {
      const x = start.x + dx * offset
      const y = start.y + dy * offset
      if (opening.openingKind === 'window' && sill > baseZ + 0.5) {
        members.push(member(`${opening.id}-cripple-below-${members.length}`, wall.id, 'wall', 'sill cripple stud', materialId, { x, y, z: baseZ }, { x, y, z: sill }, wall.studSize, 'stud', undefined, studAxes))
      }
      if (head < baseZ + wall.height - 0.5) {
        members.push(member(`${opening.id}-cripple-above-${members.length}`, wall.id, 'wall', 'header cripple stud', materialId, { x, y, z: head }, { x, y, z: baseZ + wall.height }, wall.studSize, 'stud', undefined, studAxes))
      }
    }
  }

  if (wall.intersectionStyle !== 'none') {
    for (const [index, point] of teePoints.entries()) {
      members.push(member(`${wall.id}-tee-backing-${index}`, wall.id, 'wall', wall.intersectionStyle === 'ladderBlocking' ? 'ladder backing at wall intersection' : 'tee backing at wall intersection', materialId, { x: point.x, y: point.y, z: baseZ }, { x: point.x, y: point.y, z: baseZ + wall.height }, wall.studSize, 'stud', undefined, { ...studAxes, collisionPriority: 22 }))
      if (wall.intersectionStyle === 'ladderBlocking') {
        for (let z = baseZ + 2; z < baseZ + wall.height - 1; z += 2) {
          members.push(member(`${wall.id}-ladder-block-${index}-${z.toFixed(1)}`, wall.id, 'wall', 'ladder backing block', materialId, { x: point.x - dx * 0.65, y: point.y - dy * 0.65, z }, { x: point.x + dx * 0.65, y: point.y + dy * 0.65, z }, wall.studSize, 'blocking'))
        }
      }
    }
  }

  if (wall.halfWallCap) {
    const capMaterial = materialIdForNominal(project, wall.studSize === '2x4' ? '2x6' : wall.studSize, materialId)
    members.push(member(`${wall.id}-half-wall-cap`, wall.id, 'wall', 'half wall cap plate', capMaterial, { ...start, z: baseZ + wall.height + 0.12 }, { ...end, z: baseZ + wall.height + 0.12 }, wall.studSize === '2x4' ? '2x6' : wall.studSize, 'plate', undefined, { ...flatPlateAxes, collisionPriority: 12 }))
  }

  return members
}

function openingHeaderNominal(headerSize: string): string {
  if (headerSize.includes('2x12')) return '2x12'
  if (headerSize.includes('2x10')) return '4x10'
  if (headerSize.includes('2x8')) return '4x10'
  return '4x10'
}

function generateRoofFraming(project: ProjectDocument, inputRoof: RoofElement): FramingMember[] {
  const roof = normalizedRoof(inputRoof)
  const bounds = polygonBounds(roof.footprint)
  const width = bounds.maxY - bounds.minY
  const length = bounds.maxX - bounds.minX
  if (isSinglePlaneRoof(roof.roofType)) return generateShedRoofFraming(project, roof, bounds)
  const peakZ = roof.baseElevation + (width / 2) * (roof.pitchRise / roof.pitchRun)
  const spacing = inchesToFeet(roof.rafterSpacing)
  const rafterMaterial = materialIdForNominal(project, roof.rafterSize, 'rafter-2x8')
  const ridgeMaterial = materialIdForNominal(project, roof.rafterSize, 'rafter-2x8')
  const gableStudMaterial = materialIdForNominal(project, '2x6', 'stud-2x6')
  const purlinMaterial = materialIdForNominal(project, '2x4', 'stud-2x4')
  const purlinTopOffset = roof.purlinMode === 'structuralPurlinWithStruts' ? -0.16 : 0.45
  const eaveOverhang = roof.eaveOverhang
  const rakeOverhang = roof.rakeOverhang
  const ridgeY = bounds.minY + width / 2
  const ridgeSetback = 0.08
  const members: FramingMember[] = []
  for (const interval of lineIntervalsInPolygon(roof.footprint, 'x', ridgeY)) {
    members.push(member(`${roof.id}-ridge-${members.length}`, roof.id, 'roof', roof.ridgePolicy === 'ridgeBeam' ? 'structural ridge beam' : 'ridge board', ridgeMaterial, { x: interval.start, y: ridgeY, z: peakZ }, { x: interval.end, y: ridgeY, z: peakZ }, roof.rafterSize, 'ridge', undefined, { collisionPriority: roof.ridgePolicy === 'ridgeBeam' ? 30 : 18 }))
  }
  const roofZAtY = (y: number) => peakZ - Math.abs(y - ridgeY) * (roof.pitchRise / roof.pitchRun)

  for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += spacing) {
    for (const interval of lineIntervalsInPolygon(roof.footprint, 'y', x)) {
      if (interval.start < ridgeY && interval.end > ridgeY) {
        members.push(
          member(`${roof.id}-rafter-l-${members.length}`, roof.id, 'roof', 'rafter', rafterMaterial, { x, y: interval.start - eaveOverhang, z: roof.baseElevation }, { x, y: ridgeY - ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 15 }),
          member(`${roof.id}-rafter-r-${members.length}`, roof.id, 'roof', 'rafter', rafterMaterial, { x, y: interval.end + eaveOverhang, z: roof.baseElevation }, { x, y: ridgeY + ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 15 }),
          member(`${roof.id}-ceiling-joist-${members.length}`, roof.id, 'roof', 'ceiling tie / rafter tie', rafterMaterial, { x, y: interval.start, z: roof.baseElevation + 0.1 }, { x, y: interval.end, z: roof.baseElevation + 0.1 }, roof.rafterSize, 'tie'),
        )
      } else {
        members.push(member(`${roof.id}-rafter-clipped-${members.length}`, roof.id, 'roof', 'clipped gable rafter segment', rafterMaterial, { x, y: interval.start, z: roofZAtY(interval.start) }, { x, y: interval.end, z: roofZAtY(interval.end) }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 15 }))
      }
    }
  }

  if (roof.purlinMode !== 'none') {
    const purlinSpacing = purlinSpacingForRoof(project, roof.assemblyId)
    for (let offset = purlinSpacing; offset < width / 2 - 0.001; offset += purlinSpacing) {
      const z = roof.baseElevation + offset * (roof.pitchRise / roof.pitchRun) + purlinTopOffset
      const role = roof.purlinMode === 'structuralPurlinWithStruts' ? 'structural purlin with strut support' : 'roof batten / sheathing nailer'
      for (const y of [bounds.minY + offset, bounds.maxY - offset]) {
        for (const interval of lineIntervalsInPolygon(roof.footprint, 'x', y)) {
          members.push(member(`${roof.id}-purlin-${members.length}`, roof.id, 'roof', role, purlinMaterial, { x: interval.start - rakeOverhang, y, z }, { x: interval.end + rakeOverhang, y, z }, '2x4', 'purlin'))
        }
      }
      if (roof.purlinMode === 'structuralPurlinWithStruts') {
        for (const x of supportPositions(bounds.minX, bounds.maxX, 8).slice(1, -1)) {
          members.push(
            member(`${roof.id}-strut-l-${offset}-${x}`, roof.id, 'roof', 'purlin strut to bearing wall', purlinMaterial, { x, y: bounds.minY + offset, z }, { x, y: bounds.minY, z: roof.baseElevation }, '2x4', 'purlin', undefined, { collisionPriority: 14 }),
            member(`${roof.id}-strut-r-${offset}-${x}`, roof.id, 'roof', 'purlin strut to bearing wall', purlinMaterial, { x, y: bounds.maxY - offset, z }, { x, y: bounds.maxY, z: roof.baseElevation }, '2x4', 'purlin', undefined, { collisionPriority: 14 }),
          )
        }
      }
    }
  }

  for (const [index, segment] of polygonPerimeterSegments(roof.footprint).entries()) {
    const horizontal = Math.abs(segment.start.y - segment.end.y) < 0.001
    const startZ = roofZAtY(segment.start.y)
    const endZ = roofZAtY(segment.end.y)
    members.push(member(`${roof.id}-${horizontal ? 'fascia' : 'rake'}-${index}`, roof.id, 'roof', horizontal ? 'fascia' : 'rake board', rafterMaterial, { ...segment.start, z: startZ }, { ...segment.end, z: endZ }, roof.rafterSize, horizontal ? 'fascia' : 'rake'))
  }

  for (const x of [bounds.minX, bounds.maxX]) {
    for (let y = bounds.minY; y <= bounds.maxY + 0.001; y += inchesToFeet(16)) {
      const run = Math.abs(y - (bounds.minY + width / 2))
      const topZ = peakZ - run * (roof.pitchRise / roof.pitchRun)
      if (topZ > roof.baseElevation + 0.35) {
        members.push(member(`${roof.id}-gable-stud-${x}-${members.length}`, roof.id, 'roof', 'gable end stud', gableStudMaterial, { x, y, z: roof.baseElevation }, { x, y, z: topZ }, '2x6', 'stud'))
      }
    }
    for (let y = bounds.minY + 2; y < bounds.maxY - 1; y += 4) {
      const run = Math.abs(y - (bounds.minY + width / 2))
      const topZ = peakZ - run * (roof.pitchRise / roof.pitchRun)
      members.push(member(`${roof.id}-gable-lookout-${x}-${members.length}`, roof.id, 'roof', 'gable lookout / outrigger', rafterMaterial, { x: x - Math.sign(x - (bounds.minX + bounds.maxX) / 2) * rakeOverhang, y, z: topZ }, { x, y, z: topZ }, roof.rafterSize, 'rafter'))
    }
  }

  if (length > 36) {
    members.push(member(`${roof.id}-engineering-flag`, roof.id, 'roof', 'long roof span review marker', rafterMaterial, { x: bounds.minX, y: bounds.minY, z: roof.baseElevation }, { x: bounds.maxX, y: bounds.maxY, z: roof.baseElevation }, roof.rafterSize, 'rafter'))
  }

  if (roof.roofType === 'hip') {
    const ridgeInset = Math.min(width * 0.18, Math.max(2, length * 0.12))
    const ridgeStart = { x: bounds.minX + ridgeInset, y: ridgeY, z: peakZ }
    const ridgeEnd = { x: bounds.maxX - ridgeInset, y: ridgeY, z: peakZ }
    const corners = [
      { x: bounds.minX - rakeOverhang, y: bounds.minY - eaveOverhang, z: roof.baseElevation },
      { x: bounds.minX - rakeOverhang, y: bounds.maxY + eaveOverhang, z: roof.baseElevation },
      { x: bounds.maxX + rakeOverhang, y: bounds.minY - eaveOverhang, z: roof.baseElevation },
      { x: bounds.maxX + rakeOverhang, y: bounds.maxY + eaveOverhang, z: roof.baseElevation },
    ]
    members.push(
      member(`${roof.id}-hip-nw`, roof.id, 'roof', 'hip rafter with plumb/seat cuts', rafterMaterial, corners[0], ridgeStart, roof.rafterSize, 'rafter', undefined, { collisionPriority: 24 }),
      member(`${roof.id}-hip-sw`, roof.id, 'roof', 'hip rafter with plumb/seat cuts', rafterMaterial, corners[1], ridgeStart, roof.rafterSize, 'rafter', undefined, { collisionPriority: 24 }),
      member(`${roof.id}-hip-ne`, roof.id, 'roof', 'hip rafter with plumb/seat cuts', rafterMaterial, corners[2], ridgeEnd, roof.rafterSize, 'rafter', undefined, { collisionPriority: 24 }),
      member(`${roof.id}-hip-se`, roof.id, 'roof', 'hip rafter with plumb/seat cuts', rafterMaterial, corners[3], ridgeEnd, roof.rafterSize, 'rafter', undefined, { collisionPriority: 24 }),
    )
    for (const x of supportPositions(bounds.minX + spacing, bounds.maxX - spacing, spacing * 2)) {
      members.push(
        member(`${roof.id}-jack-n-${members.length}`, roof.id, 'roof', 'jack rafter trimmed to hip', rafterMaterial, { x, y: bounds.minY - eaveOverhang, z: roof.baseElevation }, { x: Math.min(Math.max(x, ridgeStart.x), ridgeEnd.x), y: ridgeY - ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 16 }),
        member(`${roof.id}-jack-s-${members.length}`, roof.id, 'roof', 'jack rafter trimmed to hip', rafterMaterial, { x, y: bounds.maxY + eaveOverhang, z: roof.baseElevation }, { x: Math.min(Math.max(x, ridgeStart.x), ridgeEnd.x), y: ridgeY + ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 16 }),
      )
    }
  }

  if (roof.roofType === 'crossGable' || roof.roofType === 'valley' || roof.roofType === 'dormer') {
    const centerX = bounds.minX + length / 2
    const crossWidth = Math.max(width * 0.42, 6)
    const crossPeakZ = roof.baseElevation + (crossWidth / 2) * (roof.pitchRise / roof.pitchRun)
    members.push(
      member(`${roof.id}-cross-ridge`, roof.id, 'roof', roof.roofType === 'dormer' ? 'dormer ridge board' : 'cross gable ridge board', ridgeMaterial, { x: centerX, y: bounds.minY + width * 0.2, z: crossPeakZ }, { x: centerX, y: bounds.maxY - width * 0.2, z: crossPeakZ }, roof.rafterSize, 'ridge', undefined, { collisionPriority: 22 }),
      member(`${roof.id}-valley-nw`, roof.id, 'roof', 'valley rafter at intersecting roof plane', rafterMaterial, { x: centerX - crossWidth / 2, y: ridgeY, z: peakZ - 0.1 }, { x: centerX, y: ridgeY - crossWidth / 2, z: crossPeakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 25 }),
      member(`${roof.id}-valley-ne`, roof.id, 'roof', 'valley rafter at intersecting roof plane', rafterMaterial, { x: centerX + crossWidth / 2, y: ridgeY, z: peakZ - 0.1 }, { x: centerX, y: ridgeY - crossWidth / 2, z: crossPeakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 25 }),
    )
    const dormerRole = roof.roofType === 'dormer' ? 'dormer jack rafter' : 'cross gable jack rafter trimmed to valley'
    for (let y = bounds.minY + spacing; y < bounds.maxY - spacing; y += spacing * 2) {
      members.push(member(`${roof.id}-cross-jack-${members.length}`, roof.id, 'roof', dormerRole, rafterMaterial, { x: centerX - crossWidth / 2, y, z: roof.baseElevation }, { x: centerX, y, z: roofZAtY(y) + 0.3 }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 16 }))
    }
  }

  if (roof.roofType === 'gambrel' || roof.roofType === 'mansard') {
    const lowerBreak = width * 0.22
    const upperBreak = width * 0.38
    for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += spacing * 2) {
      members.push(
        member(`${roof.id}-${roof.roofType}-lower-l-${members.length}`, roof.id, 'roof', `${roof.roofType} lower steep rafter`, rafterMaterial, { x, y: bounds.minY - eaveOverhang, z: roof.baseElevation }, { x, y: bounds.minY + lowerBreak, z: roof.baseElevation + upperBreak }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 17 }),
        member(`${roof.id}-${roof.roofType}-upper-l-${members.length}`, roof.id, 'roof', `${roof.roofType} upper rafter`, rafterMaterial, { x, y: bounds.minY + lowerBreak, z: roof.baseElevation + upperBreak }, { x, y: ridgeY - ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 17 }),
        member(`${roof.id}-${roof.roofType}-lower-r-${members.length}`, roof.id, 'roof', `${roof.roofType} lower steep rafter`, rafterMaterial, { x, y: bounds.maxY + eaveOverhang, z: roof.baseElevation }, { x, y: bounds.maxY - lowerBreak, z: roof.baseElevation + upperBreak }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 17 }),
        member(`${roof.id}-${roof.roofType}-upper-r-${members.length}`, roof.id, 'roof', `${roof.roofType} upper rafter`, rafterMaterial, { x, y: bounds.maxY - lowerBreak, z: roof.baseElevation + upperBreak }, { x, y: ridgeY + ridgeSetback, z: peakZ }, roof.rafterSize, 'rafter', undefined, { collisionPriority: 17 }),
      )
    }
  }

  return members
}

function generateShedRoofFraming(project: ProjectDocument, inputRoof: RoofElement, bounds: ReturnType<typeof polygonBounds>): FramingMember[] {
  const roof = normalizedRoof(inputRoof)
  const width = bounds.maxY - bounds.minY
  const highZ = roof.baseElevation + width * (roof.pitchRise / Math.max(roof.pitchRun, 0.1))
  const spacing = inchesToFeet(roof.rafterSpacing)
  const rafterMaterial = materialIdForNominal(project, roof.rafterSize, 'rafter-2x8')
  const purlinMaterial = materialIdForNominal(project, '2x4', 'stud-2x4')
  const purlinTopOffset = roof.purlinMode === 'structuralPurlinWithStruts' ? -0.16 : 0.45
  const members: FramingMember[] = []

  for (let x = bounds.minX; x <= bounds.maxX + 0.001; x += spacing) {
    for (const interval of lineIntervalsInPolygon(roof.footprint, 'y', x)) {
      const startZ = roof.baseElevation + (interval.start - bounds.minY) * (roof.pitchRise / Math.max(roof.pitchRun, 0.1))
      const endZ = roof.baseElevation + (interval.end - bounds.minY) * (roof.pitchRise / Math.max(roof.pitchRun, 0.1))
      const prefix = roofRolePrefix(roof)
      members.push(member(`${roof.id}-${prefix}-rafter-${members.length}`, roof.id, 'roof', roof.attachment === 'wallAttachedShed' ? `${prefix} wall-attached rafter` : `${prefix} rafter`, rafterMaterial, { x, y: interval.start - roof.eaveOverhang, z: startZ }, { x, y: interval.end + roof.eaveOverhang, z: endZ }, roof.rafterSize, 'rafter'))
    }
  }

  if (roof.purlinMode !== 'none') {
    const purlinSpacing = purlinSpacingForRoof(project, roof.assemblyId)
    for (let offset = purlinSpacing; offset < width - 0.001; offset += purlinSpacing) {
      const z = roof.baseElevation + offset * (roof.pitchRise / Math.max(roof.pitchRun, 0.1)) + purlinTopOffset
      const y = bounds.minY + offset
      for (const interval of lineIntervalsInPolygon(roof.footprint, 'x', y)) {
        members.push(member(`${roof.id}-shed-purlin-${members.length}`, roof.id, 'roof', roof.purlinMode === 'structuralPurlinWithStruts' ? `${roofRolePrefix(roof)} structural purlin with struts` : `${roofRolePrefix(roof)} roof batten / sheathing nailer`, purlinMaterial, { x: interval.start - roof.rakeOverhang, y, z }, { x: interval.end + roof.rakeOverhang, y, z }, '2x4', 'purlin'))
      }
      if (roof.purlinMode === 'structuralPurlinWithStruts') {
        for (const x of supportPositions(bounds.minX, bounds.maxX, 8).slice(1, -1)) {
          members.push(member(`${roof.id}-shed-strut-${offset}-${x}`, roof.id, 'roof', 'shed purlin strut to low wall', purlinMaterial, { x, y: bounds.minY + offset, z }, { x, y: bounds.minY, z: roof.baseElevation }, '2x4', 'purlin'))
        }
      }
    }
  }

  members.push(
    member(`${roof.id}-fascia-low`, roof.id, 'roof', 'low fascia', rafterMaterial, { x: bounds.minX - roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation }, { x: bounds.maxX + roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation }, roof.rafterSize, 'fascia'),
    member(`${roof.id}-fascia-high`, roof.id, 'roof', roof.attachment === 'wallAttachedShed' ? 'wall ledger / high fascia' : 'high fascia', rafterMaterial, { x: bounds.minX - roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ }, { x: bounds.maxX + roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ }, roof.rafterSize, roof.attachment === 'wallAttachedShed' ? 'ridge' : 'fascia'),
    member(`${roof.id}-rake-w`, roof.id, 'roof', 'shed rake board', rafterMaterial, { x: bounds.minX - roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation }, { x: bounds.minX - roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ }, roof.rafterSize, 'rake'),
    member(`${roof.id}-rake-e`, roof.id, 'roof', 'shed rake board', rafterMaterial, { x: bounds.maxX + roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation }, { x: bounds.maxX + roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ }, roof.rafterSize, 'rake'),
  )

  return members
}

function generatePierBlocks(framing: FramingMember[]): PierBlockDerived[] {
  return framing
    .filter((item) => item.subsystem === 'pier')
    .map((pier) => ({
      id: `block-${pier.id}`,
      sourceElementId: pier.sourceElementId,
      materialId: 'concrete-pier-block',
      center: { x: pier.start.x, y: pier.start.y, z: pier.start.z - 0.18 },
      width: 1.3,
      depth: 1.3,
      height: 0.36,
    }))
}

function roofSlopeArea(points: Point3[]): number {
  if (points.length < 3) return 0
  let area = 0
  const anchor = points[0]
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = { x: points[index].x - anchor.x, y: points[index].y - anchor.y, z: points[index].z - anchor.z }
    const b = { x: points[index + 1].x - anchor.x, y: points[index + 1].y - anchor.y, z: points[index + 1].z - anchor.z }
    const cross = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    }
    area += Math.hypot(cross.x, cross.y, cross.z) / 2
  }
  return area
}

function generateRoofPlanes(project: ProjectDocument): RoofPlaneDerived[] {
  const planes: RoofPlaneDerived[] = []
  for (const inputRoof of project.elements.filter((element): element is RoofElement => element.type === 'roof')) {
    const roof = normalizedRoof(inputRoof)
    const bounds = polygonBounds(roof.footprint)
    const width = bounds.maxY - bounds.minY
    const ridgeY = bounds.minY + width / 2
    const peakZ = roof.baseElevation + (width / 2) * (roof.pitchRise / roof.pitchRun)
    if (isSinglePlaneRoof(roof.roofType)) {
      const highZ = roof.baseElevation + width * (roof.pitchRise / Math.max(roof.pitchRun, 0.1))
      const single = [
        { x: bounds.minX - roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation },
        { x: bounds.maxX + roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation },
        { x: bounds.maxX + roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ },
        { x: bounds.minX - roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: highZ },
      ]
      const kind = roof.roofType === 'flat' ? 'flat' : roof.roofType === 'lowSlope' ? 'lowSlope' : roof.roofType === 'porch' ? 'porch' : roof.roofType === 'roofOverDeck' ? 'deck' : 'single'
      planes.push({ id: `${roof.id}-plane-${roof.roofType}`, sourceElementId: roof.id, kind, polygon: single, area: roofSlopeArea(single), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId })
      continue
    }
    const left = [
      { x: bounds.minX - roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation },
      { x: bounds.maxX + roof.rakeOverhang, y: bounds.minY - roof.eaveOverhang, z: roof.baseElevation },
      { x: bounds.maxX + roof.rakeOverhang, y: ridgeY, z: peakZ },
      { x: bounds.minX - roof.rakeOverhang, y: ridgeY, z: peakZ },
    ]
    const right = [
      { x: bounds.minX - roof.rakeOverhang, y: ridgeY, z: peakZ },
      { x: bounds.maxX + roof.rakeOverhang, y: ridgeY, z: peakZ },
      { x: bounds.maxX + roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: roof.baseElevation },
      { x: bounds.minX - roof.rakeOverhang, y: bounds.maxY + roof.eaveOverhang, z: roof.baseElevation },
    ]
    const westGable = [
      { x: bounds.minX, y: bounds.minY, z: roof.baseElevation },
      { x: bounds.minX, y: bounds.maxY, z: roof.baseElevation },
      { x: bounds.minX, y: ridgeY, z: peakZ },
    ]
    const eastGable = [
      { x: bounds.maxX, y: bounds.minY, z: roof.baseElevation },
      { x: bounds.maxX, y: ridgeY, z: peakZ },
      { x: bounds.maxX, y: bounds.maxY, z: roof.baseElevation },
    ]
    planes.push(
      { id: `${roof.id}-plane-left`, sourceElementId: roof.id, kind: roof.roofType === 'gambrel' ? 'gambrelUpper' : roof.roofType === 'mansard' ? 'mansardUpper' : 'left', polygon: left, area: roofSlopeArea(left), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
      { id: `${roof.id}-plane-right`, sourceElementId: roof.id, kind: roof.roofType === 'gambrel' ? 'gambrelUpper' : roof.roofType === 'mansard' ? 'mansardUpper' : 'right', polygon: right, area: roofSlopeArea(right), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
      { id: `${roof.id}-gable-west`, sourceElementId: roof.id, kind: 'gable', polygon: westGable, area: roofSlopeArea(westGable), materialId: 'osb-7-16', finishMaterialId: 'fiber-cement-siding' },
      { id: `${roof.id}-gable-east`, sourceElementId: roof.id, kind: 'gable', polygon: eastGable, area: roofSlopeArea(eastGable), materialId: 'osb-7-16', finishMaterialId: 'fiber-cement-siding' },
    )
    if (roof.roofType === 'hip') {
      const front = [
        { x: bounds.minX, y: bounds.minY, z: roof.baseElevation },
        { x: bounds.maxX, y: bounds.minY, z: roof.baseElevation },
        { x: bounds.maxX - width * 0.18, y: ridgeY, z: peakZ },
        { x: bounds.minX + width * 0.18, y: ridgeY, z: peakZ },
      ]
      const back = [
        { x: bounds.minX + width * 0.18, y: ridgeY, z: peakZ },
        { x: bounds.maxX - width * 0.18, y: ridgeY, z: peakZ },
        { x: bounds.maxX, y: bounds.maxY, z: roof.baseElevation },
        { x: bounds.minX, y: bounds.maxY, z: roof.baseElevation },
      ]
      planes.push(
        { id: `${roof.id}-hip-front`, sourceElementId: roof.id, kind: 'hip', polygon: front, area: roofSlopeArea(front), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
        { id: `${roof.id}-hip-back`, sourceElementId: roof.id, kind: 'hip', polygon: back, area: roofSlopeArea(back), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
      )
    }
    if (roof.roofType === 'crossGable' || roof.roofType === 'valley' || roof.roofType === 'dormer') {
      const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2
      const valleyPlane = [
        { x: centerX - width * 0.25, y: bounds.minY, z: roof.baseElevation },
        { x: centerX, y: ridgeY, z: peakZ },
        { x: centerX + width * 0.25, y: bounds.minY, z: roof.baseElevation },
      ]
      planes.push({ id: `${roof.id}-${roof.roofType}-valley-plane`, sourceElementId: roof.id, kind: roof.roofType === 'dormer' ? 'dormer' : 'valley', polygon: valleyPlane, area: roofSlopeArea(valleyPlane), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId })
    }
    if (roof.roofType === 'gambrel' || roof.roofType === 'mansard') {
      const lowerKind = roof.roofType === 'gambrel' ? 'gambrelLower' : 'mansardLower'
      const lowerLeft = [
        { x: bounds.minX, y: bounds.minY, z: roof.baseElevation },
        { x: bounds.maxX, y: bounds.minY, z: roof.baseElevation },
        { x: bounds.maxX, y: bounds.minY + width * 0.22, z: roof.baseElevation + width * 0.22 },
        { x: bounds.minX, y: bounds.minY + width * 0.22, z: roof.baseElevation + width * 0.22 },
      ]
      const lowerRight = [
        { x: bounds.minX, y: bounds.maxY - width * 0.22, z: roof.baseElevation + width * 0.22 },
        { x: bounds.maxX, y: bounds.maxY - width * 0.22, z: roof.baseElevation + width * 0.22 },
        { x: bounds.maxX, y: bounds.maxY, z: roof.baseElevation },
        { x: bounds.minX, y: bounds.maxY, z: roof.baseElevation },
      ]
      planes.push(
        { id: `${roof.id}-${lowerKind}-left`, sourceElementId: roof.id, kind: lowerKind, polygon: lowerLeft, area: roofSlopeArea(lowerLeft), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
        { id: `${roof.id}-${lowerKind}-right`, sourceElementId: roof.id, kind: lowerKind, polygon: lowerRight, area: roofSlopeArea(lowerRight), materialId: 'osb-7-16', finishMaterialId: roof.roofingMaterialId },
      )
    }
  }
  return planes
}

function deriveRoofTopologies(project: ProjectDocument, roofPlanes: RoofPlaneDerived[], framing: FramingMember[]): RoofTopologyDerived[] {
  return project.elements.filter((element): element is RoofElement => element.type === 'roof').map((roof) => {
    const roofFraming = framing.filter((member) => member.sourceElementId === roof.id && member.subsystem === 'roof')
    const toRun = (member: FramingMember): RoofTopologyDerived['rafters'][number] => ({
      id: `${member.id}-run`,
      sourceElementId: member.sourceElementId,
      kind: member.role.includes('valley') ? 'valley'
        : member.role.includes('jack') ? 'jackRafter'
          : member.role.includes('hip') ? 'hip'
            : member.role.includes('dormer') ? 'dormerRafter'
              : member.role.includes('porch') ? 'porchRafter'
                : member.role.includes('roof-over-deck') ? 'roofOverDeckRafter'
                  : member.visualRole === 'ridge' ? 'ridge'
                    : member.visualRole === 'purlin' ? 'purlin'
                      : member.visualRole === 'fascia' ? 'fascia'
                        : member.visualRole === 'rake' ? 'rake'
                          : 'commonRafter',
      start: member.start,
      end: member.end,
      roofPlaneIds: roofPlanes.filter((plane) => plane.sourceElementId === roof.id).map((plane) => plane.id),
      materialId: member.materialId,
    })
    const runs = roofFraming.map(toRun)
    return {
      id: `${roof.id}-topology`,
      sourceElementId: roof.id,
      roofType: roof.roofType,
      planeIds: roofPlanes.filter((plane) => plane.sourceElementId === roof.id).map((plane) => plane.id),
      ridges: runs.filter((run) => run.kind === 'ridge'),
      hips: runs.filter((run) => run.kind === 'hip'),
      valleys: runs.filter((run) => run.kind === 'valley'),
      rafters: runs.filter((run) => run.kind === 'commonRafter' || run.kind === 'dormerRafter' || run.kind === 'porchRafter' || run.kind === 'roofOverDeckRafter'),
      jacks: runs.filter((run) => run.kind === 'jackRafter'),
      purlins: runs.filter((run) => run.kind === 'purlin'),
      trim: runs.filter((run) => run.kind === 'fascia' || run.kind === 'rake'),
      warnings: [],
    }
  })
}

function generateTerrainContours(project: ProjectDocument): TerrainContourDerived[] {
  const boundary = project.site.boundary
  const minX = Math.min(...boundary.map((p) => p.x))
  const maxX = Math.max(...boundary.map((p) => p.x))
  const minY = Math.min(...boundary.map((p) => p.y))
  const maxY = Math.max(...boundary.map((p) => p.y))
  const mesh = generateTerrainMesh(project, 4)
  const elevations = mesh.vertices.map((point) => point.z)
  const minZ = Math.floor(Math.min(...elevations))
  const maxZ = Math.ceil(Math.max(...elevations))
  const contours: TerrainContourDerived[] = []

  if (project.site.terrain.contours.length > 0) {
    return project.site.terrain.contours.map((contour) => ({
      id: contour.id,
      elevation: contour.elevation,
      points: contour.points.map((point) => ({ ...point, z: contour.elevation })),
    }))
  }

  const interval = Math.max(0.5, Math.min(2, (maxZ - minZ) / 5 || 1))
  for (let elevation = minZ; elevation <= maxZ + 0.001; elevation += interval) {
    const points: Point3[] = []
    for (let x = minX; x <= maxX + 0.001; x += 2) {
      let bestY = minY
      let bestDelta = Number.POSITIVE_INFINITY
      for (let y = minY; y <= maxY + 0.001; y += 1) {
        const z = sampleTerrain(project.site.terrain, x, y)
        const delta = Math.abs(z - elevation)
        if (delta < bestDelta) {
          bestDelta = delta
          bestY = y
        }
      }
      if (bestDelta < interval * 0.9) points.push({ x, y: bestY, z: elevation })
    }
    if (points.length > 2) contours.push({ id: `terrain-contour-${elevation.toFixed(1)}`, elevation, points })
  }

  return contours
}

function collectJoinConditions(framing: FramingMember[], supportGrids: SupportGrid[]): DerivedModel['joinConditions'] {
  const fromMembers = framing.flatMap((member) => [member.startCondition, member.endCondition]).filter((item): item is NonNullable<FramingMember['startCondition']> => Boolean(item))
  const fromBearing = supportGrids.flatMap((grid) =>
    grid.postPoints.map((point) => ({
      id: `${point.id}-join`,
      sourceElementId: point.sourceElementId,
      kind: point.kind === 'ledger' ? 'ledger' as const : 'bearing' as const,
      at: point.position,
      note: point.note,
    })),
  )
  return [...fromMembers, ...fromBearing]
}

function collectUnresolvedIntersections(project: ProjectDocument, framing: FramingMember[], supportGrids: SupportGrid[]): DerivedModel['unresolvedIntersections'] {
  const unresolved: DerivedModel['unresolvedIntersections'] = []
  for (const grid of supportGrids) {
    for (const warning of grid.warnings) {
      unresolved.push({
        id: `${grid.id}-warning-${unresolved.length}`,
        sourceElementId: grid.sourceElementId,
        kind: 'unresolved',
        at: grid.beamLines[0]?.start ?? { x: 0, y: 0, z: 0 },
        note: warning,
      })
    }
  }
  for (const wall of project.elements.filter((element): element is WallElement => element.type === 'wall')) {
    const wallMembers = framing.filter((member) => member.sourceElementId === wall.id)
    if (distance2(wall.path[0], wall.path[1]) < 0.1) {
      unresolved.push({
        id: `${wall.id}-zero-length`,
        sourceElementId: wall.id,
        kind: 'unresolved',
        at: { ...wall.path[0], z: project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0 },
        note: 'Wall path is too short to derive trustworthy plates, studs, or openings.',
      })
      continue
    }
    if (!wallMembers.some((member) => member.role.includes('bottom plate')) || !wallMembers.some((member) => member.role.includes('top plate'))) {
      unresolved.push({
        id: `${wall.id}-missing-plates`,
        sourceElementId: wall.id,
        kind: 'unresolved',
        at: { ...wall.path[0], z: project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0 },
        note: 'Wall is missing top or bottom plate framing.',
      })
    }
    for (const member of wallMembers) {
      if (member.role.includes('corner stud pack')) continue
      if (!['stud', 'plate', 'header', 'sill'].includes(member.visualRole ?? '')) continue
      const startDistance = distancePointToSegment2D(member.start, wall.path[0], wall.path[1])
      const endDistance = distancePointToSegment2D(member.end, wall.path[0], wall.path[1])
      if (Math.max(startDistance, endDistance) > 0.12) {
        unresolved.push({
          id: `${member.id}-wall-centerline-drift`,
          memberId: member.id,
          sourceElementId: wall.id,
          kind: 'unresolved',
          at: member.start,
          note: `${member.role} has drifted away from the modeled wall path and should not be trusted visually.`,
        })
      }
    }
  }
  for (const floor of project.elements.filter((element): element is FloorElement => element.type === 'floor')) {
    const floorMembers = framing.filter((member) => member.sourceElementId === floor.id && member.subsystem === 'floor')
    for (const member of floorMembers) {
      const outside = [0.25, 0.5, 0.75].some((ratio) => !pointInPolygon({
        x: member.start.x + (member.end.x - member.start.x) * ratio,
        y: member.start.y + (member.end.y - member.start.y) * ratio,
      }, floor.polygon))
      if (outside) {
        unresolved.push({
          id: `${member.id}-outside-floor-footprint`,
          memberId: member.id,
          sourceElementId: floor.id,
          kind: 'unresolved',
          at: member.start,
          note: `${member.role} extends outside the modeled floor/deck footprint.`,
        })
      }
    }
  }
  return unresolved
}

function distancePointToSegment2D(point: Point2, start: Point2, end: Point2): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < 0.000001) return distance2(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return distance2(point, { x: start.x + dx * t, y: start.y + dy * t })
}

function detectDerivedWarnings(project: ProjectDocument, framing: FramingMember[], supportGrids: SupportGrid[], unresolvedIntersections: DerivedModel['unresolvedIntersections']): RuleResult[] {
  const results: RuleResult[] = []
  for (const floor of project.elements.filter((element): element is FloorElement => element.type === 'floor')) {
    const beams = framing.filter((member) => member.sourceElementId === floor.id && member.role.includes('beam'))
    if (beams.length === 0) {
      results.push({
        id: `derived-floor-beams-${floor.id}`,
        status: 'warning',
        severity: 'warning',
        elementId: floor.id,
        title: 'Floor beam layout missing',
        message: 'Raised floors should derive at least one supporting beam line before pier layout is trusted.',
        suggestion: 'Add beam spacing or reduce joist span before relying on the pier schedule.',
        highlightTarget: { elementId: floor.id, kind: 'element' },
        reference: {
          standard: 'Generic framing coordination',
          section: 'Raised floor support layout',
          url: 'https://awc.org/codes-and-standards/span-tables/',
        },
      })
    }
  }
  for (const grid of supportGrids) {
    for (const warning of grid.warnings) {
      results.push({
        id: `derived-support-grid-${grid.id}-${results.length}`,
        status: 'warning',
        severity: 'warning',
        elementId: grid.sourceElementId,
        title: 'Support grid needs review',
        message: warning,
        suggestion: 'Set the deck/floor support mode, ledger edge, beam layout, and post layout before trusting this support schedule.',
        highlightTarget: { elementId: grid.sourceElementId, kind: 'element' },
        reference: {
          standard: 'AWC DCA6 / Generic IRC deck and raised-floor planning',
          section: 'Deck support, ledger, beam, and post layout',
          url: 'https://awc.org/wp-content/uploads/2022/02/AWC-DCA62015-DeckGuide-1804.pdf',
        },
      })
    }
  }
  for (const item of unresolvedIntersections) {
    results.push({
      id: `derived-unresolved-${item.id}`,
      status: 'fail',
      severity: 'error',
      elementId: item.sourceElementId,
      title: 'Unresolved framing condition',
      message: item.note ?? 'A generated framing condition could not be resolved into a bearing, trim, or join.',
      suggestion: 'Adjust the element style, support grid, wall intersection, or roof attachment before relying on the model.',
      highlightTarget: { elementId: item.sourceElementId, kind: 'element' },
      reference: {
        standard: 'Generic framing coordination',
        section: 'Bearing and member joins',
        url: 'https://awc.org/codes-and-standards/span-tables/',
      },
    })
  }
  for (const pier of framing.filter((member) => member.subsystem === 'pier')) {
    const height = Math.max(0, pier.end.z - pier.start.z)
    const terrainZ = sampleTerrain(project.site.terrain, pier.start.x, pier.start.y)
    if (Math.abs(terrainZ - pier.start.z) > 0.25 || pier.end.z < pier.start.z) {
      results.push({
        id: `derived-pier-landing-${pier.id}`,
        status: 'fail',
        severity: 'error',
        elementId: pier.sourceElementId,
        title: 'Pier/post does not land on terrain',
        message: 'A derived post is not aligned with the sampled terrain or has an invalid top/bottom elevation.',
        suggestion: 'Regenerate the floor support layout or adjust floor elevation, beam spacing, and terrain points.',
        highlightTarget: { elementId: pier.sourceElementId, memberId: pier.id, kind: 'framingMember' },
        reference: {
          standard: 'Generic framing coordination',
          section: 'Post and pier bearing',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
    if (height > 8) {
      results.push({
        id: `derived-pier-height-${pier.id}`,
        status: 'requiresEngineer',
        severity: 'warning',
        elementId: pier.sourceElementId,
        title: 'Tall pier/post review',
        message: `A derived pier/post is ${height.toFixed(1)} ft tall, which should be reviewed for bracing and lateral stability.`,
        suggestion: 'Lower the floor, add intermediate bracing, change foundation strategy, or request engineered review.',
        highlightTarget: { elementId: pier.sourceElementId, memberId: pier.id, kind: 'framingMember' },
        reference: {
          standard: 'Generic IRC / engineered foundation review',
          section: 'Pier and post lateral stability',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
  }
  for (const roof of project.elements.filter((element): element is RoofElement => element.type === 'roof')) {
    const gableMembers = framing.filter((member) => member.sourceElementId === roof.id && member.role.includes('gable end stud'))
    if (!isOrthogonalPolygon(roof.footprint)) {
      results.push({
        id: `derived-roof-orthogonal-${roof.id}`,
        status: 'warning',
        severity: 'warning',
        elementId: roof.id,
        title: 'Skewed roof footprint review',
        message: 'The roof kernel now keeps non-orthogonal footprints, but skewed hip/valley cuts should be reviewed before purchase or permit use.',
        suggestion: 'Inspect generated roof planes, valleys, and rendered rafter axes in the diagnostic view.',
        highlightTarget: { elementId: roof.id, kind: 'element' },
        reference: {
          standard: 'Generic roof geometry',
          section: 'Skewed roof topology',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
    if (roof.roofType === 'gable' && gableMembers.length === 0) {
      results.push({
        id: `derived-gable-framing-${roof.id}`,
        status: 'fail',
        severity: 'error',
        elementId: roof.id,
        title: 'Gable-end framing missing',
        message: 'A gable roof needs infill studs or another supported end-wall strategy between top plate and roof slope.',
        suggestion: 'Regenerate roof framing or switch to an engineered roof/wall assembly.',
        highlightTarget: { elementId: roof.id, kind: 'element' },
        reference: {
          standard: 'Generic IRC roof/wall coordination',
          section: 'Gable end wall framing',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
    if (roof.footprint.length < 4 || polygonArea(roof.footprint) < 16) {
      results.push({
        id: `derived-roof-footprint-${roof.id}`,
        status: 'fail',
        severity: 'error',
        elementId: roof.id,
        title: 'Invalid roof footprint',
        message: 'Roof framing needs a closed footprint with enough area to derive roof planes and rafters.',
        suggestion: 'Redraw the roof footprint or link it to a valid floor/wall perimeter.',
        highlightTarget: { elementId: roof.id, kind: 'element' },
        reference: {
          standard: 'Generic roof geometry',
          section: 'Constructible roof footprint',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
  }
  for (const opening of project.elements.filter((element): element is OpeningElement => element.type === 'opening')) {
    const host = project.elements.some((element) => element.type === 'wall' && element.id === opening.hostWallId)
    if (!host) {
      results.push({
        id: `derived-orphan-opening-${opening.id}`,
        status: 'fail',
        severity: 'error',
        elementId: opening.id,
        title: 'Orphan opening',
        message: 'This door/window no longer has a valid host wall.',
        suggestion: 'Assign the opening to a wall or remove it.',
        highlightTarget: { elementId: opening.id, kind: 'element' },
        reference: {
          standard: 'Generic wall/opening coordination',
          section: 'Hosted openings',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })
    }
  }
  return results
}

export function deriveProject(project: ProjectDocument): DerivedModel {
  const framing: FramingMember[] = []
  const supportGrids: SupportGrid[] = []

  for (const element of project.elements) {
    if (element.type === 'floor') {
      const supportGrid = deriveFloorSupportGrid(project, element)
      supportGrids.push(supportGrid)
      framing.push(...generateFloorFraming(project, element, supportGrid), ...generatePiers(element, supportGrid))
    }
    if (element.type === 'wall') framing.push(...generateWallFraming(project, element))
    if (element.type === 'roof') framing.push(...generateRoofFraming(project, element))
    if (element.type === 'stair') framing.push(...generateStairFraming(element))
  }

  const framingRenderables = framing.map((item) => toRenderable(project, item))
  const pierBlocks = generatePierBlocks(framing)
  const bearingPoints = supportGrids.flatMap((grid) => grid.postPoints)
  const joinConditions = collectJoinConditions(framing, supportGrids)
  const unresolvedIntersections = collectUnresolvedIntersections(project, framing, supportGrids)
  const roofPlanes = generateRoofPlanes(project)
  const roofTopologies = deriveRoofTopologies(project, roofPlanes, framing)
  const wallSolids = deriveWallSolids(project)
  const envelopeSurfaces = deriveEnvelopeSurfaces(project)
  const layerTakeoffFragments = deriveLayerTakeoffFragments(project, envelopeSurfaces)
  const pierHeights: Record<string, number> = {}
  for (const element of project.elements) {
    if (element.type === 'pier') {
      pierHeights[element.id] = calculatePierHeight(project.site.terrain, element.topZ, element.x, element.y)
    }
  }
  for (const pier of framing.filter((item) => item.subsystem === 'pier')) {
    pierHeights[pier.id] = Math.max(0, pier.end.z - pier.start.z)
  }

  // build unified derived face list (walls, floors, roof planes)
  function centroid3(points: { x: number; y: number; z: number }[]) {
    const total = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 })
    return { x: total.x / Math.max(points.length, 1), y: total.y / Math.max(points.length, 1), z: total.z / Math.max(points.length, 1) }
  }
  function computeNormal(points: { x: number; y: number; z: number }[]) {
    if (points.length < 3) return { x: 0, y: 0, z: 1 }
    const a = points[0]
    const b = points[1]
    const c = points[2]
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    return { x: nx / len, y: ny / len, z: nz / len }
  }

  const derivedFaces: DerivedFace[] = []
  for (const s of wallSolids) {
    if (s.faces && s.faces.length > 0) derivedFaces.push(...s.faces)
  }
  for (const floor of project.elements.filter((e): e is FloorElement => e.type === 'floor')) {
    const topPoly = floor.polygon.map((p) => ({ x: p.x, y: p.y, z: floor.elevation ?? 0 }))
    derivedFaces.push({ id: `${floor.id}-face-top`, sourceElementId: floor.id, kind: 'floor-top', polygon: topPoly, normal: { x: 0, y: 0, z: 1 }, center: centroid3(topPoly) })
  }
  for (const plane of roofPlanes) {
    derivedFaces.push({ id: `${plane.id}-face-top`, sourceElementId: plane.sourceElementId, kind: 'roof-top', polygon: plane.polygon, normal: computeNormal(plane.polygon), center: centroid3(plane.polygon) })
  }

  return {
    terrainMesh: generateTerrainMesh(project),
    terrainContours: generateTerrainContours(project),
    framing,
    framingRenderables,
    pierBlocks,
    roofPlanes,
    roofTopologies,
    wallSolids,
    envelopeSurfaces,
    layerTakeoffFragments,
    supportGrids,
    bearingPoints,
    joinConditions,
    unresolvedIntersections,
    pierHeights,
    clashes: [...detectClashes(project, framing), ...detectDerivedWarnings(project, framing, supportGrids, unresolvedIntersections)],
    derivedFaces,
  }
}

function generateStairFraming(stair: StairElement): FramingMember[] {
  const steps = Math.max(1, Math.ceil(stair.totalRise / stair.riserHeight))
  const actualRiser = stair.totalRise / steps
  const run = steps * stair.treadDepth
  const xDir = stair.direction === 'x' ? 1 : 0
  const yDir = stair.direction === 'y' ? 1 : 0
  const crossX = stair.direction === 'x' ? 0 : 1
  const crossY = stair.direction === 'x' ? 1 : 0
  const stringerOffsets = [-stair.width / 2, 0, stair.width / 2]
  const members: FramingMember[] = []

  for (const offset of stringerOffsets) {
    const start = { x: stair.position.x + crossX * offset, y: stair.position.y + crossY * offset, z: 0 }
    const end = { x: start.x + xDir * run, y: start.y + yDir * run, z: stair.totalRise }
    members.push(member(`${stair.id}-stringer-${members.length}`, stair.id, 'floor', 'stair stringer', stair.materialId, start, end, stair.stringerSize, 'rafter', {
      start: { kind: 'seat', angleDegrees: 90, note: 'lower landing cut' },
      end: { kind: 'plumb', angleDegrees: 90, note: 'upper landing cut' },
    }))
  }

  for (let index = 0; index <= steps; index += 1) {
    const centerRun = index * stair.treadDepth
    const z = index * actualRiser
    const a = {
      x: stair.position.x + xDir * centerRun - crossX * stair.width / 2,
      y: stair.position.y + yDir * centerRun - crossY * stair.width / 2,
      z,
    }
    const b = {
      x: stair.position.x + xDir * centerRun + crossX * stair.width / 2,
      y: stair.position.y + yDir * centerRun + crossY * stair.width / 2,
      z,
    }
    members.push(member(`${stair.id}-tread-block-${index}`, stair.id, 'floor', 'stair tread support', stair.materialId, a, b, stair.stringerSize, 'blocking'))
  }

  return members
}

function detectClashes(project: ProjectDocument, framing: FramingMember[]): DerivedModel['clashes'] {
  const drainPipes = project.elements.filter((element): element is PipeElement => element.type === 'pipe' && element.pipeKind === 'drain')
  const beams = framing.filter((item) => item.role.includes('beam'))

  return drainPipes.flatMap((pipe) =>
    beams
      .filter((beam) => pipe.path.some((point: Point3) => Math.abs(point.z - beam.start.z) < 0.25 && point.x >= Math.min(beam.start.x, beam.end.x) && point.x <= Math.max(beam.start.x, beam.end.x)))
      .map((beam) => ({
        id: `clash-${pipe.id}-${beam.id}`,
        status: 'warning' as const,
        severity: 'warning' as const,
        elementId: pipe.id,
        title: 'MEP/structure clash candidate',
        message: `${pipe.name} runs close to ${beam.role}. Verify bored-hole limits or reroute before framing.`,
        suggestion: 'Route through approved joist holes or below the beam with required slope.',
        reference: {
          standard: 'Generic IRC coordination',
          section: 'MEP boring/notching coordination',
          url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
        },
      })),
  )
}
