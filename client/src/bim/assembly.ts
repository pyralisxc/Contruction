import {
  Assembly,
  AssemblyLayer,
  AssemblyLayerRole,
  AssemblyLayerSide,
  AssemblyTakeoffBehavior,
  BuildingElement,
  EnvelopeSurface,
  FloorElement,
  LayerTakeoffFragment,
  OpeningElement,
  Point2,
  Point3,
  ProjectDocument,
  RoofElement,
  RuleResult,
  TakeoffLine,
  WallElement,
} from './types'

export interface NormalizedAssemblyLayer extends AssemblyLayer {
  index: number
  side: AssemblyLayerSide
  takeoff: AssemblyTakeoffBehavior
}

export interface NormalizedAssembly extends Omit<Assembly, 'layers'> {
  layers: NormalizedAssemblyLayer[]
  thickness: number
}

const assemblyReference = {
  standard: 'Contractor Hub assembly model',
  section: 'Assembly stack completeness and layer takeoff',
  url: 'https://www.iccsafe.org/products-and-services/i-codes/2018-i-codes/irc/',
}

export function normalizeAssembly(project: ProjectDocument, assemblyId: string): NormalizedAssembly | undefined {
  const assembly = project.assemblies[assemblyId]
  if (!assembly) return undefined
  const layers = assembly.layers.map((layer, index) => ({
    ...layer,
    index,
    side: layer.side ?? inferLayerSide(assembly.kind, layer.role, index, assembly.layers),
    takeoff: layer.takeoff ?? inferTakeoffBehavior(layer.role),
  }))
  return { ...assembly, layers, thickness: calculateAssemblyThickness(project, { ...assembly, layers }) }
}

export function inferLayerSide(kind: Assembly['kind'], role: AssemblyLayerRole, index: number, layers: AssemblyLayer[]): AssemblyLayerSide {
  if (kind === 'wall') {
    const structureIndex = layers.findIndex((layer) => layer.role === 'structure')
    if (role === 'structure' || role === 'insulation' || role === 'service') return 'core'
    if (role === 'sheathing' || role === 'weatherBarrier' || role === 'siding') return 'exterior'
    if (structureIndex >= 0 && index > structureIndex) return 'exterior'
    return 'interior'
  }
  if (kind === 'roof') {
    if (role === 'roofing' || role === 'underlayment' || role === 'sheathing') return 'top'
    if (role === 'finish' || role === 'paint') return 'bottom'
    return 'core'
  }
  if (kind === 'floor') {
    if (role === 'flooring' || role === 'underlayment' || role === 'subfloor') return 'top'
    if (role === 'finish' || role === 'paint') return 'bottom'
    return 'core'
  }
  return 'field'
}

export function inferTakeoffBehavior(role: AssemblyLayerRole): AssemblyTakeoffBehavior {
  if (role === 'structure' || role === 'service' || role === 'paint') return { emitsTakeoff: false }
  return {
    emitsTakeoff: true,
    deductOpenings: ['finish', 'sheathing', 'weatherBarrier', 'siding', 'insulation'].includes(role),
    coverage: role === 'insulation' ? 'cavity' : 'area',
    purchaseUnit: role === 'weatherBarrier' || role === 'underlayment' ? 'roll' : role === 'roofing' ? 'bundle' : role === 'sheathing' || role === 'subfloor' ? 'sheet' : undefined,
  }
}

export function calculateAssemblyThickness(project: ProjectDocument, assembly: Assembly): number {
  return assembly.layers.reduce((sum, layer) => {
    const materialThickness = layer.thickness ? layer.thickness / 12 : 0
    const profileThickness = project.materials[layer.materialId]?.profile?.actualDepth ?? 0
    const contributes = ['finish', 'paint', 'sheathing', 'weatherBarrier', 'siding', 'roofing', 'underlayment', 'subfloor', 'flooring', 'structure'].includes(layer.role)
    return sum + (contributes ? Math.max(materialThickness, profileThickness) : 0)
  }, 0)
}

export function deriveEnvelopeSurfaces(project: ProjectDocument): EnvelopeSurface[] {
  const surfaces: EnvelopeSurface[] = []
  for (const element of project.elements) {
    if (element.type === 'wall') surfaces.push(...wallEnvelopeSurfaces(project, element))
    if (element.type === 'floor') surfaces.push(...floorEnvelopeSurfaces(project, element))
    if (element.type === 'roof') surfaces.push(...roofEnvelopeSurfaces(project, element))
  }
  return surfaces
}

export function deriveLayerTakeoffFragments(project: ProjectDocument, surfaces: EnvelopeSurface[]): LayerTakeoffFragment[] {
  return surfaces.flatMap((surface) => {
    const assembly = normalizeAssembly(project, surface.assemblyId)
    const layer = assembly?.layers[surface.layerIndex]
    const material = project.materials[surface.materialId]
    if (!layer?.takeoff.emitsTakeoff || !material) return []
    return [{
      id: `layer-takeoff-${surface.id}`,
      sourceElementId: surface.sourceElementId,
      assemblyId: surface.assemblyId,
      layerIndex: surface.layerIndex,
      materialId: surface.materialId,
      description: `${material.name} (${surface.layerRole})`,
      subsystem: subsystemForLayer(surface.layerRole),
      phase: surface.phase,
      location: surface.location,
      quantity: Math.max(0, surface.netArea),
      unit: material.unit === 'linearFt' || material.unit === 'each' ? 'sqFt' : material.unit,
      wasteFactor: layer.takeoff.wasteFactorOverride ?? material.wasteFactor,
      supplierKey: `${surface.materialId}:${surface.layerRole}`,
    }]
  })
}

export function validateAssemblyStacks(project: ProjectDocument, surfaces: EnvelopeSurface[]): RuleResult[] {
  const results: RuleResult[] = []
  const surfaceKeys = new Set(surfaces.map((surface) => `${surface.sourceElementId}:${surface.layerIndex}`))
  for (const element of project.elements) {
    if (!('assemblyId' in element)) continue
    const assembly = normalizeAssembly(project, element.assemblyId)
    if (!assembly) continue
    results.push(...validateAssemblyCompleteness(element, assembly))
    for (const [index, layer] of assembly.layers.entries()) {
      const material = project.materials[layer.materialId]
      if (!material) {
        results.push(assemblyRule(element, `assembly-material-${element.id}-${index}`, 'fail', 'error', 'Missing assembly material', `Layer ${index + 1} references a material that does not exist.`, 'Choose a valid material for this assembly layer.'))
      }
      if (layer.takeoff.emitsTakeoff && !surfaceKeys.has(`${element.id}:${index}`) && layer.role !== 'structure' && layer.role !== 'service') {
        results.push(assemblyRule(element, `assembly-takeoff-${element.id}-${index}`, 'warning', 'warning', 'Layer takeoff surface missing', `${layer.role} layer does not currently emit a surface quantity.`, 'Confirm the layer coverage rule or mark it as non-takeoff.'))
      }
      if (layer.takeoff.emitsTakeoff && material && ['finish', 'sheathing', 'siding', 'roofing', 'underlayment', 'subfloor', 'flooring'].includes(layer.role) && material.unit === 'linearFt') {
        results.push(assemblyRule(element, `assembly-unit-${element.id}-${index}`, 'warning', 'warning', 'Layer unit mismatch', `${material.name} is measured as linear feet but the layer coverage is area-based.`, 'Use an area-based material or define a conversion rule.'))
      }
    }
  }
  return results
}

function validateAssemblyCompleteness(element: BuildingElement, assembly: NormalizedAssembly): RuleResult[] {
  const roles = new Set(assembly.layers.map((layer) => layer.role))
  const results: RuleResult[] = []
  if (element.type === 'wall' && element.exterior) {
    for (const [role, title] of [
      ['finish', 'Exterior wall interior finish missing'],
      ['structure', 'Exterior wall structure missing'],
      ['insulation', 'Exterior wall insulation missing'],
      ['sheathing', 'Exterior wall sheathing missing'],
      ['weatherBarrier', 'Exterior wall weather barrier missing'],
      ['siding', 'Exterior wall exterior finish missing'],
    ] as [AssemblyLayerRole, string][]) {
      if (!roles.has(role)) results.push(assemblyRule(element, `assembly-missing-${role}-${element.id}`, 'warning', 'warning', title, `${assembly.name} does not include a ${role} layer.`, 'Choose a complete exterior wall assembly or mark this condition intentionally incomplete.'))
    }
  }
  if (element.type === 'roof') {
    if (!roles.has('structure')) results.push(assemblyRule(element, `assembly-missing-structure-${element.id}`, 'fail', 'error', 'Roof structure missing', `${assembly.name} does not include a structure layer.`, 'Add rafters/trusses or another roof structure layer.'))
    if (!roles.has('sheathing') && !roles.has('underlayment')) results.push(assemblyRule(element, `assembly-missing-decking-${element.id}`, 'warning', 'warning', 'Roof sheathing/decking missing', `${assembly.name} does not include sheathing, decking, or underlayment.`, 'Add a roof sheathing/decking or approved purlin system layer.'))
    if (!roles.has('roofing')) results.push(assemblyRule(element, `assembly-missing-roofing-${element.id}`, 'warning', 'warning', 'Roof covering missing', `${assembly.name} does not include a roofing layer.`, 'Add shingles, metal roofing, membrane, or another roof covering.'))
  }
  if (element.type === 'floor') {
    if (!roles.has('structure')) results.push(assemblyRule(element, `assembly-missing-floor-structure-${element.id}`, 'fail', 'error', 'Floor structure missing', `${assembly.name} does not include a structure layer.`, 'Add joists, slab, or another structural floor system.'))
    if (!roles.has('subfloor')) results.push(assemblyRule(element, `assembly-missing-subfloor-${element.id}`, 'warning', 'warning', 'Subfloor missing', `${assembly.name} does not include a subfloor layer.`, 'Add subfloor sheathing before finish flooring.'))
  }
  return results
}

function wallEnvelopeSurfaces(project: ProjectDocument, wall: WallElement): EnvelopeSurface[] {
  const assembly = normalizeAssembly(project, wall.assemblyId)
  if (!assembly) return []
  const length = distance2(wall.path[0], wall.path[1])
  const baseZ = project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0
  const polygon = [
    { ...wall.path[0], z: baseZ },
    { ...wall.path[1], z: baseZ },
    { ...wall.path[1], z: baseZ + wall.height },
    { ...wall.path[0], z: baseZ + wall.height },
  ]
  const grossArea = length * wall.height
  const openings = project.elements.filter((element): element is OpeningElement => element.type === 'opening' && element.hostWallId === wall.id)
  const openingArea = openings.reduce((sum, opening) => sum + opening.width * opening.height, 0)
  return assembly.layers.flatMap((layer, index) => {
    if (!layer.takeoff.emitsTakeoff || layer.role === 'structure' || layer.role === 'service') return []
    const deduct = layer.takeoff.deductOpenings ? openingArea : 0
    return [surface(wall.id, wall.assemblyId, index, layer, polygon, grossArea, deduct, wall.name, phaseForLayer(layer.role))]
  })
}

function floorEnvelopeSurfaces(project: ProjectDocument, floor: FloorElement): EnvelopeSurface[] {
  const assembly = normalizeAssembly(project, floor.assemblyId)
  if (!assembly) return []
  const polygon = floor.polygon.map((point) => ({ ...point, z: floor.elevation }))
  const area = polygonArea(floor.polygon)
  return assembly.layers.flatMap((layer, index) => {
    if (!layer.takeoff.emitsTakeoff || layer.role === 'structure' || layer.role === 'service') return []
    return [surface(floor.id, floor.assemblyId, index, layer, polygon, area, 0, floor.name, phaseForLayer(layer.role))]
  })
}

function roofEnvelopeSurfaces(project: ProjectDocument, roof: RoofElement): EnvelopeSurface[] {
  const assembly = normalizeAssembly(project, roof.assemblyId)
  if (!assembly) return []
  const bounds = boundsFor(roof.footprint)
  const run = (bounds.maxY - bounds.minY) / 2
  const rise = run * (roof.pitchRise / roof.pitchRun)
  const slopeFactor = Math.hypot(run, rise) / Math.max(run, 0.1)
  const area = polygonArea(roof.footprint) * slopeFactor
  const polygon = roof.footprint.map((point) => ({ ...point, z: roof.baseElevation }))
  return assembly.layers.flatMap((layer, index) => {
    if (!layer.takeoff.emitsTakeoff || layer.role === 'structure' || layer.role === 'service') return []
    return [surface(roof.id, roof.assemblyId, index, layer, polygon, area, 0, roof.name, phaseForLayer(layer.role))]
  })
}

function surface(sourceElementId: string, assemblyId: string, layerIndex: number, layer: NormalizedAssemblyLayer, polygon: Point3[], grossArea: number, openingArea: number, location: string, phase: TakeoffLine['phase']): EnvelopeSurface {
  return {
    id: `surface-${sourceElementId}-${layerIndex}-${layer.role}`,
    sourceElementId,
    assemblyId,
    layerIndex,
    layerRole: layer.role,
    materialId: layer.materialId,
    side: layer.side,
    polygon,
    grossArea,
    openingArea,
    netArea: Math.max(0, grossArea - openingArea),
    thickness: layer.thickness,
    location,
    phase,
  }
}

function assemblyRule(element: BuildingElement, id: string, status: RuleResult['status'], severity: RuleResult['severity'], title: string, message: string, suggestion: string): RuleResult {
  return {
    id,
    status,
    severity,
    elementId: element.id,
    title,
    message,
    suggestion,
    highlightTarget: { elementId: element.id, kind: 'element' },
    reference: assemblyReference,
  }
}

function subsystemForLayer(role: AssemblyLayerRole): TakeoffLine['subsystem'] {
  if (role === 'roofing' || role === 'underlayment') return 'roofing'
  if (role === 'siding' || role === 'weatherBarrier') return 'siding'
  if (role === 'flooring') return 'flooring'
  if (role === 'finish' || role === 'paint' || role === 'insulation') return 'finishes'
  return 'framing'
}

function phaseForLayer(role: AssemblyLayerRole): TakeoffLine['phase'] {
  if (role === 'siding' || role === 'roofing' || role === 'underlayment' || role === 'weatherBarrier') return 'dryIn'
  if (role === 'flooring' || role === 'finish' || role === 'paint') return 'finishes'
  return 'roughFraming'
}

function distance2(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function polygonArea(points: Point2[]): number {
  if (points.length < 3) return 0
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2)
}

function boundsFor(points: Point2[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}
