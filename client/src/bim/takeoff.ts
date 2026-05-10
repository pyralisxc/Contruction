import { DerivedModel, MaterialSpec, ProjectDocument, TakeoffLine, TakeoffSummary } from './types'

const unitCost: Record<string, number> = {
  'stud-2x6': 1.65,
  'stud-2x4': 1.15,
  'joist-2x8': 2.05,
  'joist-2x10': 2.45,
  'stringer-2x12': 3.35,
  'rafter-2x8': 2.1,
  'rim-2x10': 2.45,
  'beam-4x10': 8.75,
  'post-6x6-pt': 5.8,
  'subfloor-3-4': 1.75,
  'floor-underlayment': 0.38,
  'oak-flooring-3-4': 5.2,
  'osb-7-16': 0.82,
  'house-wrap': 0.22,
  'drywall-1-2': 0.64,
  'fiber-cement-siding': 2.15,
  'asphalt-shingle': 1.9,
  'batt-r21': 1.2,
  'batt-r30': 1.55,
  'concrete-pier-block': 14,
  'romex-12-2': 0.82,
  'pex-1-2': 0.48,
  'framing-nails-16d': 42,
  'joist-hanger': 2.35,
  'hurricane-tie': 1.45,
  'roofing-nails': 38,
}

export function generateTakeoff(project: ProjectDocument, derived: DerivedModel): TakeoffSummary {
  const lines: TakeoffLine[] = []

  for (const member of derived.framing) {
    const length = Math.max(0.1, Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y, member.end.z - member.start.z))
    const isPier = member.subsystem === 'pier'
    const boardCount = isPier || !member.stockLength ? 1 : Math.max(1, Math.ceil(length / member.stockLength))
    const purchaseLength = isPier ? length : boardCount * (member.stockLength ?? length)
    const plyCount = member.spec?.plyCount ?? 1
    const designQuantity = length * member.count * plyCount
    const purchaseQuantity = purchaseLength * member.count * plyCount
    lines.push(enrichLine(project, {
      id: `takeoff-${member.id}`,
      materialId: member.materialId,
      description: `${member.role}${member.size ? ` ${member.size}` : ''}${member.stockLength && !isPier ? ` cut ${length.toFixed(1)} ft from ${boardCount}x ${member.stockLength} ft stock` : ''}`,
      subsystem: 'framing',
      phase: isPier ? 'foundation' : 'roughFraming',
      location: member.sourceElementId,
      sourceElementId: member.sourceElementId,
      quantity: purchaseQuantity,
      unit: 'linearFt',
      wasteFactor: project.materials[member.materialId]?.wasteFactor ?? 0.1,
    }, {
      designQuantity,
      purchaseQuantity,
      purchaseUnit: isPier ? 'linearFt' : 'board',
      sourceType: 'framingMember',
      levelId: levelIdForSource(project, member.sourceElementId),
    }))
  }

  for (const block of derived.pierBlocks) {
    lines.push(enrichLine(project, {
      id: `takeoff-${block.id}`,
      materialId: block.materialId,
      description: 'Concrete pier block',
      subsystem: 'site',
      phase: 'foundation',
      location: block.sourceElementId,
      sourceElementId: block.sourceElementId,
      quantity: 1,
      unit: 'each',
      wasteFactor: project.materials[block.materialId]?.wasteFactor ?? 0.05,
    }, { sourceType: 'pierBlock', levelId: levelIdForSource(project, block.sourceElementId) }))
  }

  for (const fragment of derived.layerTakeoffFragments) {
    lines.push(enrichLine(project, {
      id: `takeoff-${fragment.id}`,
      materialId: fragment.materialId,
      description: fragment.description,
      subsystem: fragment.subsystem,
      phase: fragment.phase,
      location: fragment.location,
      sourceElementId: fragment.sourceElementId,
      quantity: fragment.quantity,
      unit: fragment.unit,
      wasteFactor: fragment.wasteFactor,
    }, {
      purchaseUnit: purchaseUnitFor(project.materials[fragment.materialId], fragment.description, fragment.unit),
      sourceType: 'assemblyLayer',
      levelId: levelIdForSource(project, fragment.sourceElementId),
      roofPlaneId: fragment.sourceElementId.startsWith('roof') ? derived.roofPlanes.find((plane) => plane.sourceElementId === fragment.sourceElementId)?.id : undefined,
    }))
  }

  for (const element of project.elements) {
    if (element.type === 'circuit') {
      lines.push(enrichLine(project, {
        id: `takeoff-wire-${element.id}`,
        materialId: 'romex-12-2',
        description: `${element.amperage}A circuit cable allowance`,
        subsystem: 'electrical',
        phase: 'roughMEP',
        location: element.name,
        sourceElementId: element.id,
        quantity: Math.max(50, element.deviceIds.length * 28),
        unit: 'linearFt',
        wasteFactor: project.materials['romex-12-2'].wasteFactor,
      }, { sourceType: 'mep', levelId: levelIdForSource(project, element.id) }))
    }

    if (element.type === 'pipe') {
      const quantity = element.path.slice(1).reduce((sum, point, index) => {
        const previous = element.path[index]
        return sum + Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z)
      }, 0)
      lines.push(enrichLine(project, {
        id: `takeoff-pipe-${element.id}`,
        materialId: element.materialId,
        description: `${element.pipeKind} pipe`,
        subsystem: 'plumbing',
        phase: 'roughMEP',
        location: element.name,
        sourceElementId: element.id,
        quantity,
        unit: 'linearFt',
        wasteFactor: project.materials[element.materialId]?.wasteFactor ?? 0.15,
      }, { sourceType: 'mep', levelId: element.levelId }))
    }

    if (element.type === 'houseAccessory' && element.materialId) {
      const linearQuantity = element.accessoryKind === 'guardRail'
        ? element.width
        : element.accessoryKind === 'column'
          ? element.height
          : Math.max(element.width * 2 + element.depth * 2, 1)
      lines.push(enrichLine(project, {
        id: `takeoff-accessory-${element.id}`,
        materialId: element.materialId,
        description: `${element.name} ${element.accessoryKind} allowance`,
        subsystem: 'framing',
        phase: 'roughFraming',
        location: element.name,
        sourceElementId: element.id,
        quantity: linearQuantity,
        unit: 'linearFt',
        wasteFactor: project.materials[element.materialId]?.wasteFactor ?? 0.12,
      }, { sourceType: 'accessory', levelId: element.levelId }))
    }
  }

  addFastenerAndConnectorAllowances(project, derived, lines)

  const filteredLines = lines.filter((line) => line.quantity > 0)
  const totalsBySubsystem = groupTotals(filteredLines, 'subsystem')
  const totalsByLocation = groupTotals(filteredLines, 'location')
  const estimatedCost = filteredLines.reduce((sum, line) => {
    const billedQuantity = line.purchaseQuantity ?? line.quantity
    return sum + billedQuantity * (unitCost[line.materialId] ?? 1)
  }, 0)

  return { lines: filteredLines, totalsBySubsystem, totalsByLocation, estimatedCost }
}

function groupTotals(lines: TakeoffLine[], key: 'subsystem' | 'location'): Record<string, number> {
  return lines.reduce<Record<string, number>>((totals, line) => {
    totals[line[key]] = (totals[line[key]] ?? 0) + (line.purchaseQuantity ?? line.quantity)
    return totals
  }, {})
}

function enrichLine(project: ProjectDocument, line: TakeoffLine, metadata: Partial<TakeoffLine> = {}): TakeoffLine {
  const designQuantity = metadata.designQuantity ?? line.designQuantity ?? line.quantity
  const wasteFactor = line.wasteFactor
  const wasteQuantity = metadata.wasteQuantity ?? Math.max(0, designQuantity * wasteFactor)
  const purchaseUnit: NonNullable<TakeoffLine['purchaseUnit']> = metadata.purchaseUnit ?? purchaseUnitFor(project.materials[line.materialId], line.description, line.unit) ?? line.unit
  const purchaseQuantity = metadata.purchaseQuantity ?? convertPurchaseQuantity(designQuantity + wasteQuantity, line.unit, purchaseUnit)
  return {
    ...line,
    ...metadata,
    designQuantity,
    wasteQuantity,
    purchaseQuantity,
    purchaseUnit,
    phaseGroup: metadata.phaseGroup ?? 'element',
  }
}

function purchaseUnitFor(material: MaterialSpec | undefined, description: string, unit: MaterialSpec['unit']): TakeoffLine['purchaseUnit'] {
  if (material?.category === 'lumber') return 'board'
  if (material?.category === 'sheetGood' || description.toLowerCase().includes('drywall')) return 'sheet'
  if (material?.category === 'roofing') return 'bundle'
  if (material?.category === 'fastener') return 'box'
  if (material?.category === 'connector') return 'each'
  if (description.toLowerCase().includes('wrap') || description.toLowerCase().includes('underlayment')) return 'roll'
  return unit
}

function convertPurchaseQuantity(quantity: number, unit: MaterialSpec['unit'], purchaseUnit: NonNullable<TakeoffLine['purchaseUnit']>): number {
  if (unit === 'sqFt' && purchaseUnit === 'sheet') return Math.ceil(quantity / 32)
  if (unit === 'sqFt' && purchaseUnit === 'bundle') return Math.ceil(quantity / 33.3)
  if (unit === 'sqFt' && purchaseUnit === 'roll') return Math.ceil(quantity / 900)
  if (purchaseUnit === 'box') return Math.max(1, Math.ceil(quantity))
  return quantity
}

function levelIdForSource(project: ProjectDocument, sourceElementId: string): string | undefined {
  return project.elements.find((element) => element.id === sourceElementId)?.levelId
}

function addFastenerAndConnectorAllowances(project: ProjectDocument, derived: DerivedModel, lines: TakeoffLine[]): void {
  const nails = project.materials['framing-nails-16d']
  const hangers = project.materials['joist-hanger']
  const ties = project.materials['hurricane-tie']
  const roofingNails = project.materials['roofing-nails']
  const joists = derived.framing.filter((member) => member.visualRole === 'joist')
  const rafters = derived.framing.filter((member) => member.visualRole === 'rafter')
  const roofArea = derived.roofPlanes.reduce((sum, plane) => sum + plane.area, 0)
  if (nails) {
    lines.push(enrichLine(project, {
      id: 'takeoff-framing-nails-16d',
      materialId: nails.id,
      description: '16d framing nail allowance by derived framing member count',
      subsystem: 'framing',
      phase: 'roughFraming',
      location: 'Project',
      sourceElementId: project.id,
      quantity: Math.max(1, Math.ceil(derived.framing.length / 90)),
      unit: 'box',
      wasteFactor: nails.wasteFactor,
    }, { sourceType: 'fastener', phaseGroup: 'project' }))
  }
  if (hangers && joists.length > 0) {
    lines.push(enrichLine(project, {
      id: 'takeoff-joist-hangers',
      materialId: hangers.id,
      description: 'Joist hanger allowance at joist ends',
      subsystem: 'framing',
      phase: 'roughFraming',
      location: 'Project',
      sourceElementId: project.id,
      quantity: joists.length * 2,
      unit: 'each',
      wasteFactor: hangers.wasteFactor,
    }, { sourceType: 'connector', phaseGroup: 'project' }))
  }
  if (ties && rafters.length > 0) {
    lines.push(enrichLine(project, {
      id: 'takeoff-hurricane-ties',
      materialId: ties.id,
      description: 'Hurricane tie allowance at rafter bearing',
      subsystem: 'framing',
      phase: 'roughFraming',
      location: 'Project',
      sourceElementId: project.id,
      quantity: rafters.length,
      unit: 'each',
      wasteFactor: ties.wasteFactor,
    }, { sourceType: 'connector', phaseGroup: 'project' }))
  }
  if (roofingNails && roofArea > 0) {
    lines.push(enrichLine(project, {
      id: 'takeoff-roofing-nails',
      materialId: roofingNails.id,
      description: 'Roofing nail allowance by roof plane area',
      subsystem: 'roofing',
      phase: 'dryIn',
      location: 'Project',
      sourceElementId: project.id,
      quantity: Math.ceil(roofArea / 100),
      unit: 'box',
      wasteFactor: roofingNails.wasteFactor,
    }, { sourceType: 'fastener', phaseGroup: 'project' }))
  }
}
