import { Assembly, ProjectDocument } from './types'

export type SpanUse = 'floorJoist' | 'roofRafter' | 'header'

export interface SpanLookupInput {
  use: SpanUse
  size: string
  spacing?: number
  loadCase?: 'starter40psf' | 'starterRoof20psf'
}

export interface SpanTableRow {
  use: SpanUse
  size: string
  spacing?: number
  maxSpan: number
  loadCase: SpanLookupInput['loadCase']
  note: string
}

export const starterSpanTable: SpanTableRow[] = [
  { use: 'floorJoist', size: '2x8', spacing: 12, maxSpan: 13, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x8', spacing: 16, maxSpan: 12, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x8', spacing: 24, maxSpan: 10, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x10', spacing: 12, maxSpan: 16, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x10', spacing: 16, maxSpan: 14, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x10', spacing: 19.2, maxSpan: 13, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'floorJoist', size: '2x10', spacing: 24, maxSpan: 12, loadCase: 'starter40psf', note: 'Starter planning row for typical residential floor loading.' },
  { use: 'roofRafter', size: '2x6', spacing: 16, maxSpan: 12, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'roofRafter', size: '2x6', spacing: 24, maxSpan: 10, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'roofRafter', size: '2x8', spacing: 16, maxSpan: 16, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'roofRafter', size: '2x8', spacing: 24, maxSpan: 14, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'roofRafter', size: '2x10', spacing: 16, maxSpan: 20, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'roofRafter', size: '2x10', spacing: 24, maxSpan: 18, loadCase: 'starterRoof20psf', note: 'Starter planning row for light roof loading.' },
  { use: 'header', size: '4x10', maxSpan: 6, loadCase: 'starter40psf', note: 'Starter placeholder for built-up header review.' },
]

export function lookupSpanLimit(input: SpanLookupInput): SpanTableRow | undefined {
  return starterSpanTable.find((row) =>
    row.use === input.use &&
    row.size === input.size &&
    (row.spacing === undefined || input.spacing === undefined || row.spacing === input.spacing) &&
    (input.loadCase === undefined || row.loadCase === input.loadCase),
  )
}

export function supportedJoistSpan(totalSpan: number, supportSpacing: number): number {
  if (supportSpacing <= 0) return totalSpan
  return Math.min(totalSpan, supportSpacing)
}

export function blockingRowsForSpan(span: number, maxUnblockedSpan = 8): number {
  if (span <= maxUnblockedSpan) return 0
  return Math.max(1, Math.floor(span / maxUnblockedSpan))
}

export function rafterSlopeSpan(run: number, rise: number): number {
  return Math.hypot(run, rise)
}

export function roofNeedsPurlins(project: ProjectDocument, assemblyId: string): boolean {
  const assembly: Assembly | undefined = project.assemblies[assemblyId]
  if (!assembly) return false
  const materialNames = assembly.layers.map((layer) => project.materials[layer.materialId]?.name.toLowerCase() ?? layer.materialId.toLowerCase())
  const hasContinuousSheathing = assembly.layers.some((layer) => layer.role === 'sheathing')
  const hasMetalRoofing = materialNames.some((name) => name.includes('metal'))
  return hasMetalRoofing && !hasContinuousSheathing
}

export function purlinSpacingForRoof(project: ProjectDocument, assemblyId: string): number {
  return roofNeedsPurlins(project, assemblyId) ? 2 : 4
}
