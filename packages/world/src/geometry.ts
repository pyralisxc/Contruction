import type { Geometry, Vec3 } from './types'

export function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

export function polylineLength(points: Vec3[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distance3(points[index - 1], points[index])
  }
  return total
}

export function polygonAreaXY(points: Vec3[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return Math.abs(area / 2)
}

export interface GeometryBoundsXY {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function geometryPoints(geometry: Geometry): Vec3[] {
  if (geometry.type === 'box') {
    const { position, size } = geometry
    return [
      position,
      { x: position.x + size.x, y: position.y, z: position.z },
      { x: position.x + size.x, y: position.y + size.y, z: position.z },
      { x: position.x, y: position.y + size.y, z: position.z },
    ]
  }
  return geometry.points
}

export function geometryBoundsXY(geometry: Geometry): GeometryBoundsXY {
  const points = geometryPoints(geometry)
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

export function geometryAnchor(geometry: Geometry): Vec3 {
  if (geometry.type === 'box') return geometry.position
  return geometry.points[0] ?? { x: 0, y: 0, z: 0 }
}
