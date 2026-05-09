import assert from 'node:assert/strict'
import { deriveProject } from '../client/src/bim/geometry'
import { pointInPolygon } from '../client/src/bim/framingGeometry'
import { validateProject } from '../client/src/bim/rules'
import { createSampleProject } from '../client/src/bim/sampleProject'
import { calculatePierHeight, sampleTerrain } from '../client/src/bim/terrain'
import { generateTakeoff } from '../client/src/bim/takeoff'

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

const wallNSurfaces = derived.envelopeSurfaces.filter((surface) => surface.sourceElementId === 'wall-n')
assert.equal(wallNSurfaces.some((surface) => surface.netArea < surface.grossArea), true, 'wall layer surfaces should deduct hosted openings where required')

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

for (const block of derived.pierBlocks) {
  assert.equal(block.width > 0 && block.depth > 0 && block.height > 0, true, `${block.id} should have positive dimensions`)
  const terrainAtBlock = sampleTerrain(project.site.terrain, block.center.x, block.center.y)
  assert.equal(Math.abs(block.center.z + block.height / 2 - terrainAtBlock) < 0.25, true, `${block.id} should sit close to terrain`)
}

console.log(`Geometry golden test passed: ${derived.framing.length} members, ${derived.pierBlocks.length} pier blocks, ${derived.roofPlanes.length} roof planes.`)
