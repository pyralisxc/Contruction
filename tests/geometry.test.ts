import assert from 'node:assert/strict'
import { calculateAssemblyThickness } from '../client/src/bim/assembly'
import { deriveProject } from '../client/src/bim/geometry'
import { pointInPolygon } from '../client/src/bim/framingGeometry'
import { validateProject } from '../client/src/bim/rules'
import { createSampleProject } from '../client/src/bim/sampleProject'
import { calculatePierHeight, sampleTerrain } from '../client/src/bim/terrain'
import { generateTakeoff } from '../client/src/bim/takeoff'
import useBimProjectStore, { buildProjectWithFloorDrivenUpdates } from '../client/src/stores/bimProjectStore'

const project = createSampleProject()
const derived = deriveProject(project)
const floor = project.elements.find((element) => element.type === 'floor')

assert.ok(floor && floor.type === 'floor', 'sample project should include a floor')

const terrainZ = sampleTerrain(project.site.terrain, floor.polygon[0].x, floor.polygon[0].y)
assert.equal(Number.isFinite(terrainZ), true, 'terrain sampling should return a finite elevation')

const pierHeight = calculatePierHeight(project.site.terrain, floor.elevation - 0.8, floor.polygon[0].x, floor.polygon[0].y)
assert.equal(pierHeight >= 0, true, 'pier height should never be negative')

assert.equal(derived.framing.length > 100, true, 'sample project should derive a meaningful framing set')
assert.equal(derived.framingRenderables.length, derived.framing.length, 'every framing member should have a renderable')
assert.equal(derived.pierBlocks.length, derived.framing.filter((member) => member.subsystem === 'pier').length, 'every pier post should have one block')
assert.equal(derived.roofPlanes.length >= 2, true, 'gable roof should derive roof planes')
assert.equal(derived.roofPlanes.some((plane) => plane.kind === 'gable'), true, 'gable roof should derive gable end planes')
assert.equal(derived.terrainContours.length > 0, true, 'terrain should derive visible contour lines')
assert.equal(derived.envelopeSurfaces.length > 0, true, 'assemblies should derive envelope surfaces')
assert.equal(derived.layerTakeoffFragments.length > 0, true, 'assembly layers should derive independent takeoff fragments')
assert.equal(derived.layerTakeoffFragments.some((fragment) => fragment.materialId === 'house-wrap'), true, 'weather barrier should emit its own takeoff fragment')
assert.equal(derived.supportGrids.length > 0, true, 'floors/decks should derive explicit support grids')
assert.equal(derived.bearingPoints.some((point) => point.kind === 'post' && point.status === 'resolved'), true, 'support grids should derive resolved post bearing points')
assert.equal(derived.joinConditions.length > 0, true, 'derived members should expose joins and bearing conditions')
assert.equal(derived.unresolvedIntersections.length, 0, 'sample model should not contain unresolved framing intersections')

const gableStuds = derived.framing.filter((member) => member.role === 'gable end stud')
assert.equal(gableStuds.length > 0, true, 'gable roof should derive end-wall infill studs')

const headerCripples = derived.framing.filter((member) => member.role.includes('cripple'))
assert.equal(headerCripples.length > 0, true, 'wall openings should derive cripple studs above/below openings')

const floorBeams = derived.framing.filter((member) => member.sourceElementId === 'floor-1' && member.visualRole === 'beam')
assert.equal(floorBeams.length > 0, true, 'raised floor should derive beam support lines')
assert.equal(
  floorBeams.every((beam) => Math.abs(beam.start.x - beam.end.x) < 0.001),
  true,
  'floor beams should run perpendicular to x-spanning joists',
)
const floorBlocking = derived.framing.filter((member) => member.sourceElementId === 'floor-1' && member.visualRole === 'blocking')
assert.equal(floorBlocking.length > 20, true, 'floor blocking should be individual bay blocks, not one continuous line')
assert.equal(floorBlocking.every((block) => Math.abs(block.start.x - block.end.x) < 0.001), true, 'x-spanning floor blocking should run between joist bays at support rows')
assert.equal(floorBlocking.every((block) => Math.abs(block.start.z - floor.elevation) < 0.001 && Math.abs(block.end.z - floor.elevation) < 0.001), true, 'floor blocking should sit level with the joist framing plane')
assert.equal(floorBeams.every((beam) => (beam.bearingAt?.length ?? 0) > 0), true, 'floor beams should know their post/ledger bearing points')

const wallNMembers = derived.framing.filter((member) => member.sourceElementId === 'wall-n')
const wallEMembers = derived.framing.filter((member) => member.sourceElementId === 'wall-e')
assert.equal(wallNMembers.some((member) => member.role === 'bottom plate'), true, 'walls should derive bottom plates')
assert.equal(wallNMembers.some((member) => member.role === 'top plate'), true, 'walls should derive top plates')
assert.equal(wallNMembers.some((member) => member.role === 'double top plate'), true, 'exterior bearing walls should derive double top plates')
assert.equal(wallNMembers.filter((member) => member.role.includes('corner stud pack')).length >= 6, true, 'three-stud corner style should derive physical corner packs at wall ends')
assert.equal(wallNMembers.some((member) => member.visualRole === 'plate' && member.orientation === 'flat'), true, 'wall plates should be modeled flat')

const northStud = wallNMembers.find((member) => member.visualRole === 'stud')
const eastStud = wallEMembers.find((member) => member.visualRole === 'stud')
assert.ok(northStud && eastStud, 'sample should derive studs on perpendicular walls')
assert.equal(Math.abs(northStud.depthAxis.x - eastStud.depthAxis.x) > 0.5 || Math.abs(northStud.depthAxis.y - eastStud.depthAxis.y) > 0.5, true, 'perpendicular wall studs should carry different wall-depth axes')

const slantedWallProject = createSampleProject()
slantedWallProject.elements = [
  ...slantedWallProject.elements,
  {
    id: 'wall-diagonal',
    type: 'wall',
    name: 'Slanted test wall',
    levelId: 'level-main',
    path: [{ x: 2, y: 2 }, { x: 17, y: 11 }],
    height: 9,
    assemblyId: 'wall-ext-2x6',
    bearing: true,
    exterior: false,
    studSize: '2x6',
    studSpacing: 16,
    joinPriority: 'butt',
  },
]
const slantedWallDerived = deriveProject(slantedWallProject)
const slantedPlate = slantedWallDerived.framing.find((member) => member.id === 'wall-diagonal-bottom-plate')
const slantedSolid = slantedWallDerived.wallSolids.find((solid) => solid.sourceElementId === 'wall-diagonal')
assert.ok(slantedPlate && slantedSolid, 'slanted walls should derive both framing and wall solids')
assert.equal(Math.abs((slantedPlate?.cutLength ?? 0) - Math.hypot(15, 9)) < 0.001, true, 'slanted wall plate length should follow the diagonal path')
assert.equal(Math.abs((slantedSolid?.length ?? 0) - Math.hypot(15, 9)) < 0.001, true, 'slanted wall solid length should follow the diagonal path')
assert.equal(
  Math.abs(slantedPlate?.lengthAxis.x ?? 0) > 0.5 && Math.abs(slantedPlate?.lengthAxis.y ?? 0) > 0.3,
  true,
  'slanted wall members should carry a non-axis-aligned local length axis',
)
assert.equal(
  slantedWallDerived.unresolvedIntersections.some((item) => item.sourceElementId === 'wall-diagonal'),
  false,
  'slanted wall framing should not be flagged as visually drifting away from its wall path',
)

const roofPurlins = derived.framing.filter((member) => member.sourceElementId === 'roof-1' && member.visualRole === 'purlin')
assert.equal(roofPurlins.length > 0, true, 'roof framing should derive purlin/nailer rows from the roof assembly')
assert.equal(roofPurlins.every((purlin) => purlin.start.x < 0 && purlin.end.x > 28), true, 'roof purlins/nailers should run through the rake overhang')
const ridge = derived.framing.find((member) => member.sourceElementId === 'roof-1' && member.visualRole === 'ridge')
const leftRafter = derived.framing.find((member) => member.sourceElementId === 'roof-1' && member.role === 'rafter' && member.start.y < 0)
const rightRafter = derived.framing.find((member) => member.sourceElementId === 'roof-1' && member.role === 'rafter' && member.start.y > 20)
assert.ok(ridge && leftRafter && rightRafter, 'gable roof should derive ridge and opposing common rafters')
assert.equal(leftRafter.end.y < ridge.start.y, true, 'left rafters should trim shy of ridge centerline instead of passing through it')
assert.equal(rightRafter.end.y > ridge.start.y, true, 'right rafters should trim shy of ridge centerline instead of passing through it')
assert.equal(derived.framing.every((member) => member.cutLength && member.stockLength && member.endCuts), true, 'every framing member should carry cut length, stock length, and end-cut metadata')
assert.equal(derived.framing.some((member) => member.visualRole === 'rafter' && member.endCuts?.start.kind === 'birdsmouth'), true, 'rafters should carry roof cut metadata for visual cut lines and estimating')
assert.equal(derived.roofTopologies.length > 0, true, 'roof derivation should expose topology records for diagnostics and takeoff mapping')

const roofFamilies = ['gable', 'shed', 'leanTo', 'hip', 'crossGable', 'valley', 'dormer', 'porch', 'roofOverDeck', 'flat', 'lowSlope', 'gambrel', 'mansard'] as const
for (const roofType of roofFamilies) {
  const familyProject = createSampleProject()
  familyProject.elements = familyProject.elements.map((element) => element.type === 'roof' ? { ...element, roofType, attachment: undefined } : element)
  const familyDerived = deriveProject(familyProject)
  const familyRoofMembers = familyDerived.framing.filter((member) => member.sourceElementId === 'roof-1')
  const familyTopology = familyDerived.roofTopologies.find((topology) => topology.sourceElementId === 'roof-1')
  assert.equal(familyRoofMembers.some((member) => member.visualRole === 'rafter'), true, `${roofType} should derive physical rafters`)
  assert.equal(familyDerived.roofPlanes.some((plane) => plane.sourceElementId === 'roof-1' && plane.area > 0), true, `${roofType} should derive material roof planes`)
  assert.ok(familyTopology, `${roofType} should derive a topology record`)
  if (roofType === 'hip') assert.equal(familyTopology?.hips.length === 4 && familyTopology.jacks.length > 0, true, 'hip roof should derive hips and jack rafters')
  if (roofType === 'crossGable' || roofType === 'valley') assert.equal(familyTopology?.valleys.length > 0, true, `${roofType} should derive valley rafters`)
  if (roofType === 'dormer') assert.equal(familyRoofMembers.some((member) => member.role.includes('dormer')), true, 'dormer roof should derive dormer framing')
  if (roofType === 'porch') assert.equal(familyRoofMembers.some((member) => member.role.includes('porch')), true, 'porch roof should keep porch-specific framing role metadata')
  if (roofType === 'roofOverDeck') assert.equal(familyRoofMembers.some((member) => member.role.includes('roof-over-deck')), true, 'roof-over-deck should keep deck attachment role metadata')
  if (roofType === 'gambrel' || roofType === 'mansard') assert.equal(familyRoofMembers.some((member) => member.role.includes('lower steep rafter')), true, `${roofType} should derive lower-slope rafters`)
}

const wallNSurfaces = derived.envelopeSurfaces.filter((surface) => surface.sourceElementId === 'wall-n')
assert.equal(wallNSurfaces.some((surface) => surface.netArea < surface.grossArea), true, 'wall layer surfaces should deduct hosted openings where required')

const wallNSolid = derived.wallSolids.find((solid) => solid.sourceElementId === 'wall-n')
assert.ok(wallNSolid, 'sample should derive a wall solid for each valid wall')
assert.equal(
  Math.abs((wallNSolid?.thickness ?? 0) - calculateAssemblyThickness(project, project.assemblies['wall-ext-2x6'])) < 0.0001,
  true,
  'wall solid thickness should come from the wall assembly stack rather than a decorative default',
)
assert.equal(wallNSolid?.openingVoids.some((opening) => opening.openingId === 'window-1' && Math.abs(opening.sillHeight - 3) < 0.001 && Math.abs(opening.headHeight - 7) < 0.001), true, 'window opening voids should preserve sill/head heights inside the wall solid')
assert.equal(wallNSolid?.layerBands.length, project.assemblies['wall-ext-2x6'].layers.length, 'wall solid should carry a band record for every assembly layer')
assert.equal(
  Math.abs(faceSpacingAlongAxis(wallNSolid?.insideFace[0], wallNSolid?.outsideFace[0], wallNSolid?.thicknessAxis) - (wallNSolid?.thickness ?? 0)) < 0.02,
  true,
  'inside and outside wall faces should be spaced by the derived wall thickness',
)

const twoBySixStudRenderable = derived.framingRenderables.find((renderable) => renderable.size === '2x6' && renderable.visualRole === 'stud')
assert.ok(twoBySixStudRenderable, 'sample should render at least one 2x6 stud')
assert.equal(Math.abs(twoBySixStudRenderable.crossSection.width - 0.125) < 0.002, true, '2x6 stud should render at 1.5 in width')
assert.equal(Math.abs(twoBySixStudRenderable.crossSection.depth - 0.4583) < 0.002, true, '2x6 stud should render at 5.5 in depth')

const postRenderable = derived.framingRenderables.find((renderable) => renderable.size === '6x6')
assert.ok(postRenderable, 'sample should render at least one 6x6 post')
assert.equal(Math.abs(postRenderable.crossSection.width - 0.4583) < 0.002, true, '6x6 post should render at 5.5 in width')

for (const renderable of derived.framingRenderables) {
  const qLength = Math.hypot(...renderable.quaternion)
  assert.equal(Number.isFinite(renderable.length), true, `${renderable.id} should have a finite length`)
  assert.equal(renderable.length > 0, true, `${renderable.id} should have positive length`)
  assert.equal(Math.abs(qLength - 1) < 0.001, true, `${renderable.id} should have a normalized quaternion`)
  assert.equal(renderable.crossSection.width > 0 && renderable.crossSection.depth > 0, true, `${renderable.id} should have a cross section`)
  for (const axis of [renderable.lengthAxis, renderable.widthAxis, renderable.depthAxis]) {
    assert.equal(Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) < 0.01, true, `${renderable.id} should have normalized local axes`)
  }
  const dotLW = renderable.lengthAxis.x * renderable.widthAxis.x + renderable.lengthAxis.y * renderable.widthAxis.y + renderable.lengthAxis.z * renderable.widthAxis.z
  const dotLD = renderable.lengthAxis.x * renderable.depthAxis.x + renderable.lengthAxis.y * renderable.depthAxis.y + renderable.lengthAxis.z * renderable.depthAxis.z
  const dotWD = renderable.widthAxis.x * renderable.depthAxis.x + renderable.widthAxis.y * renderable.depthAxis.y + renderable.widthAxis.z * renderable.depthAxis.z
  assert.equal(Math.abs(dotLW) < 0.02 && Math.abs(dotLD) < 0.02 && Math.abs(dotWD) < 0.02, true, `${renderable.id} should have perpendicular local axes`)
  const threeWidth = { x: renderable.widthAxis.x, y: renderable.widthAxis.z, z: renderable.widthAxis.y }
  const threeLength = { x: renderable.lengthAxis.x, y: renderable.lengthAxis.z, z: renderable.lengthAxis.y }
  const threeDepth = { x: renderable.depthAxis.x, y: renderable.depthAxis.z, z: renderable.depthAxis.y }
  const threeCross = {
    x: threeWidth.y * threeLength.z - threeWidth.z * threeLength.y,
    y: threeWidth.z * threeLength.x - threeWidth.x * threeLength.z,
    z: threeWidth.x * threeLength.y - threeWidth.y * threeLength.x,
  }
  const handedness = threeCross.x * threeDepth.x + threeCross.y * threeDepth.y + threeCross.z * threeDepth.z
  assert.equal(Math.abs(handedness) > 0.98, true, `${renderable.id} should map to a non-reflected 3D basis after renderer handedness correction`)
}

const joist = derived.framing.find((member) => member.visualRole === 'joist')
const rafter = derived.framing.find((member) => member.visualRole === 'rafter' && member.role === 'rafter')
const stud = derived.framing.find((member) => member.visualRole === 'stud')
assert.equal(joist?.orientation, 'onEdge', 'joists should be modeled on edge')
assert.equal(rafter?.orientation, 'slopedOnEdge', 'rafters should be modeled sloped on edge')
assert.equal(stud?.orientation, 'vertical', 'studs should be modeled vertical')

const takeoff = generateTakeoff(project, derived)
const windowHeader = derived.framing.find((member) => member.id === 'window-1-header')
const windowHeaderTakeoff = takeoff.lines.find((line) => line.id === 'takeoff-window-1-header')
assert.ok(windowHeader && windowHeaderTakeoff, 'sample should include a built-up window header and takeoff line')
assert.equal(windowHeaderTakeoff.quantity, (windowHeader.stockLength ?? windowHeader.cutLength ?? 0) * (windowHeader.spec?.plyCount ?? 1), 'built-up header takeoff should include ply count')
assert.equal(windowHeaderTakeoff.designQuantity !== undefined && windowHeaderTakeoff.purchaseQuantity !== undefined, true, 'framing takeoff should separate design and purchase quantities')
assert.equal(takeoff.lines.every((line) => line.purchaseQuantity !== undefined && line.purchaseUnit !== undefined && line.sourceType !== undefined), true, 'every takeoff line should carry purchase-planning metadata')
assert.equal(takeoff.lines.some((line) => line.materialId === 'joist-hanger' && line.sourceType === 'connector'), true, 'BOM should include connector allowances from derived framing')
assert.equal(takeoff.lines.some((line) => line.materialId === 'roofing-nails' && line.sourceType === 'fastener'), true, 'BOM should include roofing fastener allowances from roof plane area')

const sampleRules = validateProject(project, derived)
assert.equal(sampleRules.some((rule) => rule.id.startsWith('floor-span-') && rule.status === 'pass'), true, 'supported floor joist span should pass starter span-table lookup')
assert.equal(sampleRules.some((rule) => rule.id.startsWith('roof-rafter-span-') && rule.status === 'pass'), true, 'sample roof rafters should pass starter span-table lookup')
assert.equal(sampleRules.some((rule) => rule.id.startsWith('loadpath-roof-') && rule.status === 'fail'), false, 'sample roof eaves should align with bearing walls')

const invalidDerived = {
  ...derived,
  framing: derived.framing.map((member) =>
    member.id === rafter?.id ? { ...member, orientation: 'flat' as const, spec: member.spec ? { ...member.spec, orientation: 'flat' as const } : member.spec } : member,
  ),
}
assert.equal(
  validateProject(project, invalidDerived).some((rule) => rule.id.startsWith('member-orientation-') && rule.status === 'fail'),
  true,
  'rules should fail a flat structural rafter orientation',
)

const badRoofProject = createSampleProject()
badRoofProject.elements = badRoofProject.elements.map((element) =>
  element.type === 'roof'
    ? { ...element, footprint: element.footprint.map((point) => ({ x: point.x, y: point.y + 5 })) }
    : element,
)
const badRoofDerived = deriveProject(badRoofProject)
assert.equal(
  validateProject(badRoofProject, badRoofDerived).some((rule) => rule.id.startsWith('loadpath-roof-') && rule.status === 'fail'),
  true,
  'roof shifted off bearing walls should fail load-path validation',
)

const zeroWallProject = createSampleProject()
zeroWallProject.elements = [
  {
    id: 'zero-wall',
    type: 'wall',
    name: 'Zero length wall',
    levelId: 'level-main',
    path: [{ x: 4, y: 4 }, { x: 4, y: 4 }],
    height: 9,
    assemblyId: 'wall-ext-2x6',
    bearing: true,
    exterior: true,
    studSize: '2x6',
    studSpacing: 16,
    joinPriority: 'miter',
  },
]
const zeroWallDerived = deriveProject(zeroWallProject)
assert.equal(zeroWallDerived.framing.length, 0, 'zero-length wall should not derive invalid framing members')
assert.equal(
  validateProject(zeroWallProject, zeroWallDerived).some((rule) => rule.id.includes('zero-wall-zero-length') && rule.status === 'fail'),
  true,
  'zero-length wall should surface as an unresolved framing failure',
)

const stairProject = createSampleProject()
stairProject.elements = [
  ...stairProject.elements,
  {
    id: 'stair-test',
    type: 'stair',
    name: 'Test access stairs',
    levelId: 'level-main',
    position: { x: 12, y: 22 },
    direction: 'y',
    width: 4,
    totalRise: 3,
    treadDepth: 0.92,
    riserHeight: 0.58,
    stringerSize: '2x12',
    materialId: 'stringer-2x12',
  },
]
const stairDerived = deriveProject(stairProject)
assert.equal(stairDerived.framing.some((member) => member.sourceElementId === 'stair-test' && member.role === 'stair stringer'), true, 'stair elements should derive stringer framing')

const deckProject = createSampleProject()
deckProject.elements = [
  ...deckProject.elements,
  {
    id: 'deck-test',
    type: 'floor',
    name: 'Ledger test deck',
    levelId: 'level-main',
    polygon: [
      { x: 0, y: 20 },
      { x: 12, y: 20 },
      { x: 12, y: 30 },
      { x: 0, y: 30 },
    ],
    elevation: 3,
    assemblyId: 'floor-2x10',
    joistDirection: 'y',
    joistSize: '2x8',
    joistSpacing: 16,
    beamSpacing: 8,
    pierSpacing: 6,
    framingMode: 'deck',
    deckMode: 'ledger',
    ledgerEdge: 'north',
    blockingPolicy: 'supportAndMidspan',
    beamLayout: 'edgeAndInterior',
    postLayout: 'underBeams',
  },
]
const deckDerived = deriveProject(deckProject)
const deckGrid = deckDerived.supportGrids.find((grid) => grid.sourceElementId === 'deck-test')
assert.ok(deckGrid, 'ledger deck should derive a support grid')
assert.equal(deckGrid.postPoints.some((point) => point.kind === 'ledger'), true, 'ledger deck should mark ledger bearing separately from post footings')
assert.equal(deckDerived.framing.some((member) => member.sourceElementId === 'deck-test' && member.role.includes('ledger')), true, 'ledger deck should derive a ledger board / band attachment member')

const purlinModeProject = createSampleProject()
purlinModeProject.elements = purlinModeProject.elements.map((element) => element.type === 'roof' ? { ...element, purlinMode: 'structuralPurlinWithStruts' as const } : element)
const purlinModeDerived = deriveProject(purlinModeProject)
assert.equal(purlinModeDerived.framing.some((member) => member.role.includes('purlin strut')), true, 'structural purlin mode should derive struts down to bearing')

const accessoryProject = createSampleProject()
accessoryProject.elements = [
  ...accessoryProject.elements,
  {
    id: 'guard-test',
    type: 'houseAccessory',
    name: 'Test guard rail',
    levelId: 'level-main',
    accessoryKind: 'guardRail',
    position: { x: 4, y: 21, z: 3 },
    width: 12,
    depth: 0.25,
    height: 3.5,
    materialId: 'stud-2x4',
  },
]
const accessoryDerived = deriveProject(accessoryProject)
assert.equal(accessoryDerived.unresolvedIntersections.length, 0, 'non-structural accessories should not create unresolved framing joins')

const lShapeProject = createSampleProject()
lShapeProject.elements = [
  {
    id: 'l-floor',
    type: 'floor',
    name: 'L-shaped addition floor',
    levelId: 'level-main',
    polygon: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 8 },
      { x: 10, y: 8 },
      { x: 10, y: 16 },
      { x: 0, y: 16 },
    ],
    elevation: 3,
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
  },
]
const lShapeDerived = deriveProject(lShapeProject)
const lShapeMembers = lShapeDerived.framing.filter((member) => member.sourceElementId === 'l-floor' && member.subsystem !== 'pier')
for (const member of lShapeMembers) {
  for (const ratio of [0.25, 0.5, 0.75]) {
    const point = {
      x: member.start.x + (member.end.x - member.start.x) * ratio,
      y: member.start.y + (member.end.y - member.start.y) * ratio,
    }
    assert.equal(pointInPolygon(point, lShapeProject.elements[0].type === 'floor' ? lShapeProject.elements[0].polygon : []), true, `${member.id} should stay inside the L-shaped floor footprint`)
  }
}
assert.equal(
  lShapeDerived.framing.some((member) => member.sourceElementId === 'l-floor' && member.start.x < 10 && member.end.x > 10 && member.start.y > 8),
  false,
  'L-shaped floor should not derive members crossing the missing upper-right corner',
)

const attachedBayProject = createSampleProject()
attachedBayProject.elements = [
  {
    id: 'bay-floor',
    type: 'floor',
    name: 'Bay addition floor',
    levelId: 'level-main',
    polygon: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 4 },
      { x: 26, y: 4 },
      { x: 26, y: 12 },
      { x: 20, y: 12 },
      { x: 20, y: 16 },
      { x: 0, y: 16 },
    ],
    elevation: 3,
    assemblyId: 'floor-2x10',
    joistDirection: 'y',
    joistSize: '2x10',
    joistSpacing: 16,
    beamSpacing: 8,
    pierSpacing: 6,
    framingMode: 'raisedFloor',
    deckMode: 'none',
    blockingPolicy: 'supportAndMidspan',
    beamLayout: 'edgeAndInterior',
    postLayout: 'underBeams',
  },
]
const attachedBayDerived = deriveProject(attachedBayProject)
const attachedBayMembers = attachedBayDerived.framing.filter((member) => member.sourceElementId === 'bay-floor' && member.subsystem !== 'pier')
for (const member of attachedBayMembers) {
  for (const ratio of [0.2, 0.5, 0.8]) {
    const point = {
      x: member.start.x + (member.end.x - member.start.x) * ratio,
      y: member.start.y + (member.end.y - member.start.y) * ratio,
    }
    assert.equal(pointInPolygon(point, attachedBayProject.elements[0].type === 'floor' ? attachedBayProject.elements[0].polygon : []), true, `${member.id} should stay inside the attached-bay footprint`)
  }
}
assert.equal(
  attachedBayMembers.some((member) => member.start.x < 20 && member.end.x > 20 && member.start.y < 4),
  false,
  'attached bay framing should not bridge across areas that are outside the footprint before the bump-out starts',
)

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().selectElement('floor-1')
useBimProjectStore.getState().createAttachedAdditionOnTarget('floor-1', 0, 8)
const targetedFloor = useBimProjectStore.getState().project.elements.find((element) => element.id === 'floor-1')
assert.ok(targetedFloor && targetedFloor.type === 'floor', 'targeted floor addition should keep the floor selected in-place')
assert.equal(targetedFloor.polygon.length, 8, 'targeted floor edge addition should insert a four-point bay')
assert.equal(Math.min(...targetedFloor.polygon.map((point) => point.y)), -8, 'targeted floor edge addition should grow outward from the requested edge')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().selectElement('wall-e')
useBimProjectStore.getState().createAttachedAdditionOnTarget('wall-e', undefined, 6)
const wallAdditionFloors = useBimProjectStore.getState().project.elements.filter((element) => element.type === 'floor')
assert.equal(wallAdditionFloors.length, 2, 'targeted wall addition should create a new floor footprint')
const createdWallAddition = wallAdditionFloors.find((element) => element.id !== 'floor-1')
assert.ok(createdWallAddition, 'wall-targeted addition should add a second floor element')
assert.equal(Math.max(...createdWallAddition.polygon.map((point) => point.x)) > 28, true, 'wall-targeted addition should extend outward beyond the host wall line')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().splitPolygonEdge('floor-1', 0, { x: 7, y: 0.2 })
const splitFloor = useBimProjectStore.getState().project.elements.find((element) => element.id === 'floor-1')
assert.ok(splitFloor && splitFloor.type === 'floor', 'split edge should keep the floor element available')
assert.equal(splitFloor.polygon.length, 5, 'splitting one footprint edge should add one vertex')
assert.equal(splitFloor.polygon[1].x > 0 && splitFloor.polygon[1].x < 28, true, 'split edge point should be inserted along the targeted segment')

useBimProjectStore.getState().deletePolygonVertex('floor-1', 1)
const deletedVertexFloor = useBimProjectStore.getState().project.elements.find((element) => element.id === 'floor-1')
assert.ok(deletedVertexFloor && deletedVertexFloor.type === 'floor', 'deleting a vertex should keep the floor element available')
assert.equal(deletedVertexFloor.polygon.length, 4, 'deleting a nonessential vertex should reduce the footprint vertex count')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().updateElement('floor-1', {
  polygon: [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 16, y: 0 },
    { x: 28, y: 0 },
    { x: 28, y: 20 },
    { x: 0, y: 20 },
  ],
})
useBimProjectStore.getState().cleanPolygonFootprint('floor-1')
const cleanedFloor = useBimProjectStore.getState().project.elements.find((element) => element.id === 'floor-1')
assert.ok(cleanedFloor && cleanedFloor.type === 'floor', 'cleanup should keep the floor element available')
assert.equal(cleanedFloor.polygon.length, 4, 'cleanup should remove redundant collinear footprint points')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().deletePolygonVertex('roof-1', 0)
useBimProjectStore.getState().deletePolygonVertex('roof-1', 0)
const trimmedRoof = useBimProjectStore.getState().project.elements.find((element) => element.id === 'roof-1')
assert.ok(trimmedRoof && trimmedRoof.type === 'roof', 'roof delete should keep the roof element available')
assert.equal(trimmedRoof.footprint.length, 3, 'roof delete should stop at a minimum triangle footprint')
useBimProjectStore.getState().deletePolygonVertex('roof-1', 0)
const minimumRoof = useBimProjectStore.getState().project.elements.find((element) => element.id === 'roof-1')
assert.ok(minimumRoof && minimumRoof.type === 'roof', 'minimum roof should still exist after attempted extra deletion')
assert.equal(minimumRoof.footprint.length, 3, 'roof footprint should not delete below three vertices')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().splitPolygonEdge('floor-1', 0, { x: 7, y: 0 })
useBimProjectStore.getState().syncExteriorWallsToFloorOutline('floor-1')
const syncedWallsAfterSplit = useBimProjectStore.getState().project.elements.filter((element) => element.type === 'wall' && element.exterior)
assert.equal(syncedWallsAfterSplit.length, 5, 'syncing walls after a split edge should create one wall segment per floor edge')
assert.equal(
  syncedWallsAfterSplit.some((wall) => wall.path.some((point) => Math.abs(point.x - 7) < 0.001 && Math.abs(point.y) < 0.001)),
  true,
  'synced walls should include the inserted split point in the exterior wall loop',
)

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().createAttachedAdditionOnTarget('floor-1', 0, 8)
useBimProjectStore.getState().syncExteriorWallsToFloorOutline('floor-1')
const syncedProjectAfterBay = useBimProjectStore.getState().project
const syncedBayWalls = syncedProjectAfterBay.elements.filter((element) => element.type === 'wall' && element.exterior)
const syncedBayOpenings = syncedProjectAfterBay.elements.filter((element) => element.type === 'opening')
assert.equal(syncedBayWalls.length, 8, 'syncing walls after an attached bay should rebuild the full exterior loop')
assert.equal(syncedBayOpenings.length, 3, 'syncing walls should preserve hosted openings when they still map to the new outline')
assert.equal(
  syncedBayOpenings.every((opening) => syncedBayWalls.some((wall) => wall.id === opening.hostWallId)),
  true,
  'every preserved opening should be remapped to an existing rebuilt wall',
)

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().splitPolygonEdge('floor-1', 0, { x: 7, y: 0 })
useBimProjectStore.getState().syncRoofToFloorOutline('floor-1')
const syncedRoofAfterSplit = useBimProjectStore.getState().project.elements.find((element) => element.id === 'roof-1')
assert.ok(syncedRoofAfterSplit && syncedRoofAfterSplit.type === 'roof', 'sync roof should preserve or create a roof element')
assert.equal(syncedRoofAfterSplit.footprint.length, 5, 'roof sync should follow the edited floor vertex count')
assert.equal(syncedRoofAfterSplit.pitchRise, 6, 'roof sync should preserve existing roof pitch settings')

useBimProjectStore.getState().loadProject(createSampleProject())
useBimProjectStore.getState().createAttachedAdditionOnTarget('floor-1', 0, 8)
useBimProjectStore.getState().syncRoofToFloorOutline('floor-1')
const syncedRoofAfterBay = useBimProjectStore.getState().project.elements.find((element) => element.id === 'roof-1')
assert.ok(syncedRoofAfterBay && syncedRoofAfterBay.type === 'roof', 'roof sync after bay should keep a roof element on the level')
assert.equal(syncedRoofAfterBay.footprint.length, 8, 'roof sync should follow attached-bay floor footprints')
assert.equal(syncedRoofAfterBay.rafterSpacing, 24, 'roof sync should preserve existing roof framing metadata')

const reviewedUpdateProject = createSampleProject()
const reviewedUpdateFloor = reviewedUpdateProject.elements.find((element) => element.id === 'floor-1')
assert.ok(reviewedUpdateFloor && reviewedUpdateFloor.type === 'floor', 'sample project should expose the reviewed floor update target')
reviewedUpdateFloor.polygon = [
  { x: 0, y: -8 },
  { x: 28, y: -8 },
  { x: 28, y: 20 },
  { x: 0, y: 20 },
]
const reviewedPreview = buildProjectWithFloorDrivenUpdates(reviewedUpdateProject, 'floor-1', 'level-main', {
  syncWalls: true,
  syncRoof: true,
  preserveOpenings: false,
})
assert.ok(reviewedPreview, 'floor-driven update builder should create a preview project')
assert.equal(reviewedPreview?.elements.filter((element) => element.type === 'wall' && element.exterior).length, 4, 'reviewed update should rebuild the exterior wall loop from the floor polygon')
assert.equal(reviewedPreview?.elements.filter((element) => element.type === 'opening').length, 0, 'reviewed update should drop hosted openings when preserveOpenings is disabled')
const reviewedRoof = reviewedPreview?.elements.find((element) => element.id === 'roof-1')
assert.ok(reviewedRoof && reviewedRoof.type === 'roof', 'reviewed update should preserve the level roof identity')
assert.equal(reviewedRoof?.footprint[0].y, -8, 'reviewed update roof preview should follow the edited floor outline')

useBimProjectStore.getState().resetProject()

const unsupportedWallOnLShapeProject = createSampleProject()
unsupportedWallOnLShapeProject.elements = [
  ...(lShapeProject.elements as typeof unsupportedWallOnLShapeProject.elements),
  {
    id: 'unsupported-wall-in-notch',
    type: 'wall',
    name: 'Bearing wall in missing floor notch',
    levelId: 'level-main',
    path: [{ x: 12, y: 12 }, { x: 18, y: 12 }],
    height: 9,
    assemblyId: 'wall-ext-2x6',
    bearing: true,
    exterior: false,
    studSize: '2x6',
    studSpacing: 16,
    joinPriority: 'miter',
  },
]
const unsupportedWallDerived = deriveProject(unsupportedWallOnLShapeProject)
assert.equal(
  validateProject(unsupportedWallOnLShapeProject, unsupportedWallDerived).some((rule) => rule.id === 'loadpath-wall-unsupported-wall-in-notch' && rule.status === 'fail'),
  true,
  'bearing walls inside a floor bounding box but outside the real polygon should fail load-path validation',
)

const doorSolid = derived.wallSolids.find((solid) => solid.sourceElementId === 'wall-s')
assert.equal(
  doorSolid?.openingVoids.some((opening) => opening.openingId === 'door-1' && Math.abs(opening.sillHeight) < 0.001 && Math.abs(opening.headHeight - 6.8) < 0.001),
  true,
  'door voids should cut from the floor line to the modeled door head height',
)

for (const block of derived.pierBlocks) {
  assert.equal(block.width > 0 && block.depth > 0 && block.height > 0, true, `${block.id} should have positive dimensions`)
  const terrainAtBlock = sampleTerrain(project.site.terrain, block.center.x, block.center.y)
  assert.equal(Math.abs(block.center.z + block.height / 2 - terrainAtBlock) < 0.25, true, `${block.id} should sit close to terrain`)
}

console.log(`Geometry golden test passed: ${derived.framing.length} members, ${derived.pierBlocks.length} pier blocks, ${derived.roofPlanes.length} roof planes.`)

function faceSpacingAlongAxis(
  inside: { x: number; y: number; z: number } | undefined,
  outside: { x: number; y: number; z: number } | undefined,
  axis: { x: number; y: number; z: number } | undefined,
): number {
  if (!inside || !outside || !axis) return 0
  const delta = {
    x: outside.x - inside.x,
    y: outside.y - inside.y,
    z: outside.z - inside.z,
  }
  return delta.x * axis.x + delta.y * axis.y + delta.z * axis.z
}
