import { DerivedModel, ProjectDocument, TakeoffLine, TakeoffSummary } from './types'

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
}

export function generateTakeoff(project: ProjectDocument, derived: DerivedModel): TakeoffSummary {
  const lines: TakeoffLine[] = []

  for (const member of derived.framing) {
    const length = Math.max(0.1, Math.hypot(member.end.x - member.start.x, member.end.y - member.start.y, member.end.z - member.start.z))
    const isPier = member.subsystem === 'pier'
    const boardCount = isPier || !member.stockLength ? 1 : Math.max(1, Math.ceil(length / member.stockLength))
    const purchaseLength = isPier ? length : boardCount * (member.stockLength ?? length)
    const plyCount = member.spec?.plyCount ?? 1
    lines.push({
      id: `takeoff-${member.id}`,
      materialId: member.materialId,
      description: `${member.role}${member.size ? ` ${member.size}` : ''}${member.stockLength && !isPier ? ` cut ${length.toFixed(1)} ft from ${boardCount}x ${member.stockLength} ft stock` : ''}`,
      subsystem: 'framing',
      phase: isPier ? 'foundation' : 'roughFraming',
      location: member.sourceElementId,
      sourceElementId: member.sourceElementId,
      quantity: purchaseLength * member.count * plyCount,
      unit: 'linearFt',
      wasteFactor: project.materials[member.materialId]?.wasteFactor ?? 0.1,
    })
  }

  for (const block of derived.pierBlocks) {
    lines.push({
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
    })
  }

  for (const fragment of derived.layerTakeoffFragments) {
    lines.push({
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
    })
  }

  for (const element of project.elements) {
    if (element.type === 'circuit') {
      lines.push({
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
      })
    }

    if (element.type === 'pipe') {
      const quantity = element.path.slice(1).reduce((sum, point, index) => {
        const previous = element.path[index]
        return sum + Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z)
      }, 0)
      lines.push({
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
      })
    }

    if (element.type === 'houseAccessory' && element.materialId) {
      const linearQuantity = element.accessoryKind === 'guardRail'
        ? element.width
        : element.accessoryKind === 'column'
          ? element.height
          : Math.max(element.width * 2 + element.depth * 2, 1)
      lines.push({
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
      })
    }
  }

  const filteredLines = lines.filter((line) => line.quantity > 0)
  const totalsBySubsystem = groupTotals(filteredLines, 'subsystem')
  const totalsByLocation = groupTotals(filteredLines, 'location')
  const estimatedCost = filteredLines.reduce((sum, line) => {
    const wasteQuantity = line.quantity * (1 + line.wasteFactor)
    return sum + wasteQuantity * (unitCost[line.materialId] ?? 1)
  }, 0)

  return { lines: filteredLines, totalsBySubsystem, totalsByLocation, estimatedCost }
}

function groupTotals(lines: TakeoffLine[], key: 'subsystem' | 'location'): Record<string, number> {
  return lines.reduce<Record<string, number>>((totals, line) => {
    totals[line[key]] = (totals[line[key]] ?? 0) + line.quantity * (1 + line.wasteFactor)
    return totals
  }, {})
}
