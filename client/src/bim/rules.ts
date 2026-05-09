import { DerivedModel, FloorElement, FramingMember, MemberOrientation, OpeningElement, Point3, ProjectDocument, RoofElement, RuleResult, StructuralMemberSpec, WallElement } from './types'
import { validateAssemblyStacks } from './assembly'
import { distance2, polygonBounds } from './geometry'
import { blockingRowsForSpan, lookupSpanLimit, purlinSpacingForRoof, rafterSlopeSpan, supportedJoistSpan } from './spanTables'

const ircReference = {
  standard: 'Generic IRC',
  section: 'Prescriptive residential construction',
  url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
}

const awcReference = {
  standard: 'IRC / AWC',
  section: 'Floor joist and rafter span tables',
  url: 'https://awc.org/codes-and-standards/span-tables/',
}

const necReference = {
  standard: 'IRC electrical provisions / NEC concepts',
  section: 'Dwelling receptacle, GFCI, and AFCI planning',
  url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
}

const plumbingReference = {
  standard: 'IRC plumbing provisions',
  section: 'Drainage slope and fixture planning',
  url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
}

export function validateProject(project: ProjectDocument, derived: DerivedModel): RuleResult[] {
  const results: RuleResult[] = []

  for (const element of project.elements) {
    if (element.type === 'floor') results.push(...validateFloor(element, derived))
    if (element.type === 'wall') results.push(...validateWall(project, element))
    if (element.type === 'opening') results.push(...validateOpening(project, element))
    if (element.type === 'roof') results.push(...validateRoof(project, element, derived))
    if (element.type === 'roof' && element.pitchRise < 2) {
      results.push({
        id: `roof-low-slope-${element.id}`,
        status: 'requiresAHJ',
        severity: 'warning',
        elementId: element.id,
        title: 'Low-slope roof review',
        message: 'Roof pitch below 2:12 usually requires roof-covering-specific detailing and local approval.',
        suggestion: 'Use a low-slope assembly with manufacturer-approved underlayment and flashing details.',
        highlightTarget: { elementId: element.id, kind: 'element' },
        reference: ircReference,
      })
    }
    if (element.type === 'pipe' && element.pipeKind === 'drain') {
      const slope = element.slope ?? 0
      results.push({
        id: `pipe-slope-${element.id}`,
        status: slope >= 0.25 ? 'pass' : 'fail',
        severity: slope >= 0.25 ? 'info' : 'error',
        elementId: element.id,
        title: 'Drain slope',
        message: slope >= 0.25 ? 'Drain slope is at or above 1/4 in per ft.' : 'Drain slope is below the common 1/4 in per ft planning minimum.',
        suggestion: slope >= 0.25 ? undefined : 'Increase slope or shorten the run while preserving venting.',
        highlightTarget: { elementId: element.id, kind: 'element' },
        reference: plumbingReference,
      })
    }
  }

  results.push(...validateElectrical(project), ...validateMemberOrientations(derived), ...validateMemberAxes(derived), ...validateLoadPath(project, derived), ...validateAssemblyStacks(project, derived.envelopeSurfaces), ...derived.clashes)
  return results
}

function validateMemberOrientations(derived: DerivedModel): RuleResult[] {
  const results: RuleResult[] = []
  for (const member of derived.framing) {
    if (!member.spec) continue
    const valid = isValidOrientation(member.spec.memberType, member.orientation ?? member.spec.orientation)
    if (!valid) {
      results.push({
        id: `member-orientation-${member.id}`,
        status: 'fail',
        severity: 'error',
        elementId: member.sourceElementId,
        title: 'Structural member orientation',
        message: `${member.role} is modeled ${member.orientation ?? member.spec.orientation}; ${member.spec.memberType}s must be oriented on the appropriate strong axis for the modeled role.`,
        suggestion: 'Regenerate the member as on-edge, sloped-on-edge, built-up, or vertical according to its structural role before trusting framing or takeoff.',
        highlightTarget: { elementId: member.sourceElementId, memberId: member.id, kind: 'framingMember' },
        reference: awcReference,
      })
    }
  }
  return results
}

function isValidOrientation(memberType: StructuralMemberSpec['memberType'], orientation: MemberOrientation): boolean {
  if (memberType === 'joist' || memberType === 'purlin' || memberType === 'strut' || memberType === 'blocking' || memberType === 'rim' || memberType === 'plate' || memberType === 'tie') {
    return orientation === 'onEdge' || orientation === 'builtUp' || (memberType === 'plate' && orientation === 'flat')
  }
  if (memberType === 'rafter') return orientation === 'slopedOnEdge' || orientation === 'onEdge'
  if (memberType === 'beam' || memberType === 'header') return orientation === 'builtUp' || orientation === 'onEdge'
  if (memberType === 'stud' || memberType === 'post') return orientation === 'vertical' || orientation === 'slopedOnEdge'
  if (memberType === 'ridge') return orientation === 'onEdge' || orientation === 'builtUp'
  return orientation !== 'flat'
}

function validateMemberAxes(derived: DerivedModel): RuleResult[] {
  return derived.framing
    .filter((member) => !hasValidAxes(member))
    .map((member) => ({
      id: `member-axes-${member.id}`,
      status: 'fail' as const,
      severity: 'error' as const,
      elementId: member.sourceElementId,
      title: 'Framing member axes',
      message: `${member.role} has invalid local length/width/depth axes, so the 3D member cannot be trusted for visual coordination.`,
      suggestion: 'Regenerate the framing member with perpendicular normalized local axes.',
      highlightTarget: { elementId: member.sourceElementId, memberId: member.id, kind: 'framingMember' as const },
      reference: awcReference,
    }))
}

function hasValidAxes(member: FramingMember): boolean {
  const axes = [member.lengthAxis, member.widthAxis, member.depthAxis]
  if (axes.some((axis) => !axis || !Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z))) return false
  if (axes.some((axis) => Math.abs(vectorLength(axis) - 1) > 0.01)) return false
  return Math.abs(dot(member.lengthAxis, member.widthAxis)) < 0.02 &&
    Math.abs(dot(member.lengthAxis, member.depthAxis)) < 0.02 &&
    Math.abs(dot(member.widthAxis, member.depthAxis)) < 0.02
}

function vectorLength(axis: Point3): number {
  return Math.hypot(axis.x, axis.y, axis.z)
}

function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function validateFloor(floor: FloorElement, derived: DerivedModel): RuleResult[] {
  const bounds = polygonBounds(floor.polygon)
  const totalJoistRun = floor.joistDirection === 'x' ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY
  const span = supportedJoistSpan(totalJoistRun, floor.beamSpacing)
  const spanRow = lookupSpanLimit({ use: 'floorJoist', size: floor.joistSize, spacing: floor.joistSpacing })
  const maxSpan = spanRow?.maxSpan ?? (floor.joistSize === '2x10' ? 14 : 12)
  const spacingOk = [12, 16, 19.2, 24].includes(floor.joistSpacing)
  const blockingRows = countFloorBlockingRows(floor, derived)
  const requiredBlockingRows = blockingRowsForSpan(span)
  return [
    {
      id: `floor-span-${floor.id}`,
      status: span <= maxSpan ? 'pass' : 'requiresEngineer',
      severity: span <= maxSpan ? 'info' : 'warning',
      elementId: floor.id,
      title: 'Floor joist span',
      message: span <= maxSpan ? `${floor.joistSize} joists span ${span.toFixed(1)} ft between support lines, within the starter span-table limit.` : `${floor.joistSize} joists spanning ${span.toFixed(1)} ft between support lines exceed the starter ${maxSpan} ft limit.`,
      suggestion: span <= maxSpan ? undefined : 'Add a beam, reduce span, choose a larger/engineered joist, or request engineered review.',
      highlightTarget: { elementId: floor.id, kind: 'element' },
      reference: awcReference,
    },
    {
      id: `floor-spacing-${floor.id}`,
      status: spacingOk ? 'pass' : 'warning',
      severity: spacingOk ? 'info' : 'warning',
      elementId: floor.id,
      title: 'Joist spacing',
      message: spacingOk ? `${floor.joistSpacing}" OC is a recognized planning spacing.` : `${floor.joistSpacing}" OC is unusual for residential framing.`,
      suggestion: spacingOk ? undefined : 'Use 12, 16, 19.2, or 24 inches on center unless an engineered layout is provided.',
      highlightTarget: { elementId: floor.id, kind: 'element' },
      reference: awcReference,
    },
    {
      id: `floor-blocking-${floor.id}`,
      status: blockingRows >= requiredBlockingRows ? 'pass' : 'warning',
      severity: blockingRows >= requiredBlockingRows ? 'info' : 'warning',
      elementId: floor.id,
      title: 'Floor blocking rows',
      message: blockingRows >= requiredBlockingRows ? `${blockingRows} blocking row(s) derived for lateral restraint.` : `${requiredBlockingRows} blocking row(s) are expected for a ${span.toFixed(1)} ft joist span; ${blockingRows} found.`,
      suggestion: blockingRows >= requiredBlockingRows ? undefined : 'Regenerate floor framing or reduce joist span/support spacing.',
      highlightTarget: { elementId: floor.id, kind: 'element' },
      reference: awcReference,
    },
  ]
}

function countFloorBlockingRows(floor: FloorElement, derived: DerivedModel): number {
  const values = derived.framing
    .filter((member) => member.sourceElementId === floor.id && member.visualRole === 'blocking')
    .map((member) => floor.joistDirection === 'x' ? member.start.x : member.start.y)
    .map((value) => Number(value.toFixed(2)))
  return new Set(values).size
}

function validateRoof(project: ProjectDocument, roof: RoofElement, derived: DerivedModel): RuleResult[] {
  const bounds = polygonBounds(roof.footprint)
  const run = (bounds.maxY - bounds.minY) / (roof.roofType === 'shed' || roof.roofType === 'flat' ? 1 : 2)
  const rise = run * (roof.pitchRise / roof.pitchRun)
  const rawSpan = rafterSlopeSpan(run, rise)
  const spanRow = lookupSpanLimit({ use: 'roofRafter', size: roof.rafterSize, spacing: roof.rafterSpacing })
  const maxSpan = spanRow?.maxSpan ?? (roof.rafterSize === '2x10' ? 18 : 14)
  const purlinCount = derived.framing.filter((member) => member.sourceElementId === roof.id && member.visualRole === 'purlin').length
  const purlinSpacing = purlinSpacingForRoof(project, roof.assemblyId)
  const purlinMode = roof.purlinMode ?? 'roofBattenNailer'
  const structuralStruts = derived.framing.filter((member) => member.sourceElementId === roof.id && member.role.includes('purlin strut')).length
  const span = purlinMode === 'structuralPurlinWithStruts' && structuralStruts > 0 ? Math.min(rawSpan, purlinSpacing) : rawSpan
  const expectedPurlins = roof.roofType === 'shed' || roof.roofType === 'flat'
    ? purlinMode === 'none' ? 0 : Math.max(0, Math.floor((bounds.maxY - bounds.minY) / purlinSpacing) - 1)
    : purlinMode === 'none' ? 0 : Math.max(0, Math.floor((bounds.maxY - bounds.minY) / 2 / purlinSpacing) - 1) * 2
  return [
    {
      id: `roof-rafter-span-${roof.id}`,
      status: span <= maxSpan ? 'pass' : 'requiresEngineer',
      severity: span <= maxSpan ? 'info' : 'warning',
      elementId: roof.id,
      title: 'Roof rafter span',
      message: span <= maxSpan ? `${roof.rafterSize} rafters have an effective span of ${span.toFixed(1)} ft along slope, within the starter roof span row.` : `${roof.rafterSize} rafters span ${span.toFixed(1)} ft along slope, above the starter ${maxSpan} ft roof span row.`,
      suggestion: span <= maxSpan ? undefined : 'Increase rafter size, reduce spacing, add purlin/strut support, or request engineered roof framing.',
      highlightTarget: { elementId: roof.id, kind: 'element' },
      reference: awcReference,
    },
    {
      id: `roof-purlin-layout-${roof.id}`,
      status: purlinMode !== 'structuralPurlinWithStruts' || structuralStruts > 0 ? purlinCount >= expectedPurlins ? 'pass' : 'warning' : 'fail',
      severity: purlinMode !== 'structuralPurlinWithStruts' || structuralStruts > 0 ? purlinCount >= expectedPurlins ? 'info' : 'warning' : 'error',
      elementId: roof.id,
      title: 'Roof purlin / nailer layout',
      message: purlinMode === 'structuralPurlinWithStruts' && structuralStruts === 0 ? 'Structural purlin mode is selected, but no struts to bearing were derived.' : purlinCount >= expectedPurlins ? `${purlinCount} purlin/batten rows derived from the roof assembly.` : `Expected about ${expectedPurlins} purlin/batten rows for the selected roof support spacing; ${purlinCount} found.`,
      suggestion: purlinMode === 'structuralPurlinWithStruts' && structuralStruts === 0 ? 'Add purlin struts to bearing walls or switch to batten/nailer mode.' : purlinCount >= expectedPurlins ? undefined : 'Regenerate roof framing or add purlin/batten rows based on the roofing assembly.',
      highlightTarget: { elementId: roof.id, kind: 'element' },
      reference: awcReference,
    },
  ]
}

function validateWall(project: ProjectDocument, wall: WallElement): RuleResult[] {
  const length = distance2(wall.path[0], wall.path[1])
  const assembly = project.assemblies[wall.assemblyId]
  const rValue = assembly?.layers.reduce((sum, layer) => sum + (layer.rValue ?? 0), 0) ?? 0
  return [
    {
      id: `wall-height-${wall.id}`,
      status: wall.height <= 10 ? 'pass' : 'requiresEngineer',
      severity: wall.height <= 10 ? 'info' : 'warning',
      elementId: wall.id,
      title: 'Wall height',
      message: wall.height <= 10 ? 'Wall height is within the starter prescriptive limit.' : `${wall.height} ft wall height should be reviewed for studs, bracing, and fireblocking.`,
      suggestion: wall.height <= 10 ? undefined : 'Reduce height or add engineered stud/bracing design.',
      highlightTarget: { elementId: wall.id, kind: 'element' },
      reference: ircReference,
    },
    {
      id: `wall-length-${wall.id}`,
      status: length >= 2 ? 'pass' : 'warning',
      severity: length >= 2 ? 'info' : 'warning',
      elementId: wall.id,
      title: 'Wall segment length',
      message: length >= 2 ? 'Wall segment is long enough for normal editing.' : 'Short wall segments often need explicit bracing and connection review.',
      suggestion: length >= 2 ? undefined : 'Confirm braced wall panel and connector requirements.',
      highlightTarget: { elementId: wall.id, kind: 'element' },
      reference: ircReference,
    },
    {
      id: `wall-energy-${wall.id}`,
      status: wall.exterior && rValue < 13 ? 'warning' : 'pass',
      severity: wall.exterior && rValue < 13 ? 'warning' : 'info',
      elementId: wall.id,
      title: 'Envelope R-value planning',
      message: wall.exterior && rValue < 13 ? 'Exterior wall assembly has low recorded insulation value.' : 'Wall assembly has recorded insulation for energy review.',
      suggestion: wall.exterior && rValue < 13 ? 'Choose an insulated assembly before energy compliance export.' : undefined,
      highlightTarget: { elementId: wall.id, kind: 'element' },
      reference: {
        standard: 'DOE REScheck / IECC concepts',
        section: 'Residential envelope UA/TC compliance',
        url: 'https://www.energycodes.gov/rescheck/',
      },
    },
  ]
}

function validateOpening(project: ProjectDocument, opening: OpeningElement): RuleResult[] {
  const wall = project.elements.find((element): element is WallElement => element.type === 'wall' && element.id === opening.hostWallId)
  const wallLength = wall ? distance2(wall.path[0], wall.path[1]) : 0
  return [
    {
      id: `opening-fit-${opening.id}`,
      status: wall && opening.center - opening.width / 2 >= 0 && opening.center + opening.width / 2 <= wallLength ? 'pass' : 'fail',
      severity: wall && opening.center - opening.width / 2 >= 0 && opening.center + opening.width / 2 <= wallLength ? 'info' : 'error',
      elementId: opening.id,
      title: 'Opening fits host wall',
      message: wall ? 'Opening position is checked against the host wall.' : 'Opening host wall was not found.',
      suggestion: wall ? 'Keep rough opening inside the wall segment.' : 'Assign this opening to an existing wall.',
      highlightTarget: { elementId: opening.id, kind: 'element' },
      reference: ircReference,
    },
    {
      id: `opening-header-${opening.id}`,
      status: opening.width <= 5 || opening.headerSize !== '2x8' ? 'pass' : 'warning',
      severity: opening.width <= 5 || opening.headerSize !== '2x8' ? 'info' : 'warning',
      elementId: opening.id,
      title: 'Header planning',
      message: opening.width <= 5 ? 'Opening width is within the starter header rule range.' : 'Wide openings need header sizing by span/load table.',
      suggestion: opening.width <= 5 ? undefined : 'Use a table-based header selection or engineered header.',
      highlightTarget: { elementId: opening.id, kind: 'element' },
      reference: ircReference,
    },
  ]
}

function validateLoadPath(project: ProjectDocument, derived: DerivedModel): RuleResult[] {
  const results: RuleResult[] = []
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall')
  const floors = project.elements.filter((element): element is FloorElement => element.type === 'floor')
  const roofs = project.elements.filter((element): element is RoofElement => element.type === 'roof')

  for (const roof of roofs) {
    const bounds = polygonBounds(roof.footprint)
    const eaveEdges: [string, { a: { x: number; y: number }; b: { x: number; y: number } }][] = [
      ['low eave wall', { a: { x: bounds.minX, y: bounds.minY }, b: { x: bounds.maxX, y: bounds.minY } }],
      ['high eave wall', { a: { x: bounds.minX, y: bounds.maxY }, b: { x: bounds.maxX, y: bounds.maxY } }],
    ]
    for (const [label, edge] of eaveEdges) {
      const supported = walls.some((wall) => wall.bearing && lineOverlaps(edge.a, edge.b, wall.path[0], wall.path[1], 0.75))
      if (!supported) {
        results.push({
          id: `loadpath-roof-${roof.id}-${label.replace(/\s+/g, '-')}`,
          status: 'fail',
          severity: 'error',
          elementId: roof.id,
          title: 'Roof bearing wall missing',
          message: `The ${label} of ${roof.name} does not align with a modeled bearing wall, so the roof load path is incomplete.`,
          suggestion: 'Add or align a bearing wall under this eave, or mark the roof as engineered with beams/posts.',
          highlightTarget: { elementId: roof.id, kind: 'element' },
          reference: ircReference,
        })
      }
    }
  }

  for (const wall of walls.filter((item) => item.bearing)) {
    const supportedByFloor = floors.some((floor) => pointInsideBounds(wall.path[0], polygonBounds(floor.polygon), 0.25) && pointInsideBounds(wall.path[1], polygonBounds(floor.polygon), 0.25))
    const supportedByBeam = derived.framing.some((member) => member.visualRole === 'beam' && lineOverlaps(wall.path[0], wall.path[1], member.start, member.end, 1))
    if (!supportedByFloor && !supportedByBeam) {
      results.push({
        id: `loadpath-wall-${wall.id}`,
        status: 'fail',
        severity: 'error',
        elementId: wall.id,
        title: 'Bearing wall support missing',
        message: `${wall.name} is marked bearing but is not fully over a modeled floor platform or beam line.`,
        suggestion: 'Move the wall onto the floor platform, add a beam/foundation support, or mark it non-bearing if appropriate.',
        highlightTarget: { elementId: wall.id, kind: 'element' },
        reference: ircReference,
      })
    }
  }

  return results
}

function lineOverlaps(a1: { x: number; y: number }, a2: { x: number; y: number }, b1: { x: number; y: number }, b2: { x: number; y: number }, tolerance: number): boolean {
  const aLength = distance2(a1, a2)
  const bLength = distance2(b1, b2)
  if (aLength < 0.001 || bLength < 0.001) return false
  const parallel = Math.abs(((a2.x - a1.x) / aLength) * ((b2.x - b1.x) / bLength) + ((a2.y - a1.y) / aLength) * ((b2.y - b1.y) / bLength))
  if (parallel < 0.96) return false
  const b1Distance = pointToLineDistance(b1, a1, a2)
  const b2Distance = pointToLineDistance(b2, a1, a2)
  if (Math.min(b1Distance, b2Distance) > tolerance) return false
  const axis = Math.abs(a2.x - a1.x) >= Math.abs(a2.y - a1.y) ? 'x' : 'y'
  const aMin = Math.min(a1[axis], a2[axis])
  const aMax = Math.max(a1[axis], a2[axis])
  const bMin = Math.min(b1[axis], b2[axis])
  const bMax = Math.max(b1[axis], b2[axis])
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + tolerance
}

function pointToLineDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const length = distance2(a, b)
  if (length < 0.001) return distance2(point, a)
  return Math.abs((b.y - a.y) * point.x - (b.x - a.x) * point.y + b.x * a.y - b.y * a.x) / length
}

function pointInsideBounds(point: { x: number; y: number }, bounds: ReturnType<typeof polygonBounds>, tolerance: number): boolean {
  return point.x >= bounds.minX - tolerance && point.x <= bounds.maxX + tolerance && point.y >= bounds.minY - tolerance && point.y <= bounds.maxY + tolerance
}

function validateElectrical(project: ProjectDocument): RuleResult[] {
  const circuits = project.elements.filter((element) => element.type === 'circuit')
  const devices = project.elements.filter((element) => element.type === 'electricalDevice')
  const results: RuleResult[] = []

  for (const circuit of circuits) {
    const connectedLoads = devices
      .filter((device) => circuit.deviceIds.includes(device.id))
      .reduce((sum, device) => sum + (device.loadWatts ?? 0), 0)
    const capacity = circuit.amperage * circuit.voltage * 0.8
    results.push({
      id: `circuit-load-${circuit.id}`,
      status: connectedLoads <= capacity ? 'pass' : 'fail',
      severity: connectedLoads <= capacity ? 'info' : 'error',
      elementId: circuit.id,
      title: 'Circuit load planning',
      message: `${connectedLoads.toFixed(0)} W planned on ${capacity.toFixed(0)} W continuous planning capacity.`,
      suggestion: connectedLoads <= capacity ? undefined : 'Split loads across additional circuits or increase circuit capacity where allowed.',
      highlightTarget: { elementId: circuit.id, kind: 'element' },
      reference: necReference,
    })

    if (circuit.breakerType !== 'afci' && circuit.breakerType !== 'dualFunction') {
      results.push({
        id: `circuit-afci-${circuit.id}`,
        status: 'warning',
        severity: 'warning',
        elementId: circuit.id,
        title: 'AFCI planning flag',
        message: 'Most dwelling living-area circuits require AFCI protection in modern adopted codes.',
        suggestion: 'Use AFCI or dual-function protection unless the selected jurisdiction creates an exception.',
        highlightTarget: { elementId: circuit.id, kind: 'element' },
        reference: necReference,
      })
    }
  }

  return results
}
