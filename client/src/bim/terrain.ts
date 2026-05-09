import { Point2, Point3, ProjectDocument, TerrainMesh, TerrainModel } from './types'

export function sampleTerrain(terrain: TerrainModel, x: number, y: number): number {
  if (terrain.type === 'flat') return terrain.baseElevation

  if (terrain.type === 'slopedPlane') {
    const plane = terrain.plane ?? { origin: { x: 0, y: 0 }, slopeX: 0, slopeY: 0 }
    return terrain.baseElevation + (x - plane.origin.x) * plane.slopeX + (y - plane.origin.y) * plane.slopeY
  }

  if (terrain.points.length === 0) return terrain.baseElevation

  let weightedElevation = 0
  let weightTotal = 0
  for (const point of terrain.points) {
    const distance = Math.hypot(point.x - x, point.y - y)
    if (distance < 0.001) return point.z
    const weight = 1 / Math.max(distance * distance, 0.001)
    weightedElevation += point.z * weight
    weightTotal += weight
  }

  return weightTotal === 0 ? terrain.baseElevation : weightedElevation / weightTotal
}

export function projectToTerrain(terrain: TerrainModel, point: Point2): Point3 {
  return { ...point, z: sampleTerrain(terrain, point.x, point.y) }
}

export function calculatePierHeight(terrain: TerrainModel, topZ: number, x: number, y: number): number {
  return Math.max(0, topZ - sampleTerrain(terrain, x, y))
}

export function generateTerrainMesh(project: ProjectDocument, step = 4): TerrainMesh {
  const boundary = project.site.boundary
  const minX = Math.min(...boundary.map((p) => p.x))
  const maxX = Math.max(...boundary.map((p) => p.x))
  const minY = Math.min(...boundary.map((p) => p.y))
  const maxY = Math.max(...boundary.map((p) => p.y))
  const vertices: Point3[] = []
  const columns = Math.max(2, Math.floor((maxX - minX) / step) + 1)
  const rows = Math.max(2, Math.floor((maxY - minY) / step) + 1)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = minX + (column / (columns - 1)) * (maxX - minX)
      const y = minY + (row / (rows - 1)) * (maxY - minY)
      vertices.push({ x, y, z: sampleTerrain(project.site.terrain, x, y) })
    }
  }

  const triangles: [number, number, number][] = []
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      triangles.push([a, c, b], [b, c, d])
    }
  }

  return { vertices, triangles }
}

