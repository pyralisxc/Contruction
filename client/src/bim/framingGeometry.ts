import { Point2 } from './types'

const epsilon = 0.001

export interface Segment2 {
  start: Point2
  end: Point2
}

export interface LineInterval {
  start: number
  end: number
}

export function isOrthogonalPolygon(points: Point2[], tolerance = 0.001): boolean {
  if (points.length < 4) return false
  return points.every((point, index) => {
    const next = points[(index + 1) % points.length]
    return Math.abs(point.x - next.x) <= tolerance || Math.abs(point.y - next.y) <= tolerance
  })
}

export function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  if (pointOnPolygonBoundary(point, polygon)) return true
  let inside = false
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const intersects = ((current.y > point.y) !== (previous.y > point.y)) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    if (intersects) inside = !inside
  }
  return inside
}

export function pointOnPolygonBoundary(point: Point2, polygon: Point2[], tolerance = 0.001): boolean {
  return polygon.some((start, index) => pointOnSegment(point, start, polygon[(index + 1) % polygon.length], tolerance))
}

export function pointOnSegment(point: Point2, start: Point2, end: Point2, tolerance = 0.001): boolean {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < tolerance * tolerance) return Math.hypot(point.x - start.x, point.y - start.y) <= tolerance
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  if (t < -tolerance || t > 1 + tolerance) return false
  const projected = { x: start.x + dx * t, y: start.y + dy * t }
  return Math.hypot(projected.x - point.x, projected.y - point.y) <= tolerance
}

export function polygonPerimeterSegments(polygon: Point2[]): Segment2[] {
  return polygon
    .map((start, index) => ({ start, end: polygon[(index + 1) % polygon.length] }))
    .filter((segment) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > epsilon)
}

export function lineIntervalsInPolygon(polygon: Point2[], axis: 'x' | 'y', lineCoordinate: number): LineInterval[] {
  if (polygon.length < 3) return []
  const bounds = boundsFor(polygon)
  const coordinate = clampLineCoordinate(lineCoordinate, axis === 'x' ? bounds.minY : bounds.minX, axis === 'x' ? bounds.maxY : bounds.maxX)
  const intersections: number[] = []

  for (const start of polygon.keys()) {
    const a = polygon[start]
    const b = polygon[(start + 1) % polygon.length]
    if (axis === 'x') {
      if ((a.y > coordinate) !== (b.y > coordinate)) {
        intersections.push(a.x + ((coordinate - a.y) * (b.x - a.x)) / (b.y - a.y))
      }
    } else if ((a.x > coordinate) !== (b.x > coordinate)) {
      intersections.push(a.y + ((coordinate - a.x) * (b.y - a.y)) / (b.x - a.x))
    }
  }

  intersections.sort((a, b) => a - b)
  const intervals: LineInterval[] = []
  for (let index = 0; index < intersections.length - 1; index += 2) {
    const start = intersections[index]
    const end = intersections[index + 1]
    if (end - start > epsilon) intervals.push({ start, end })
  }
  return intervals
}

export function intervalContains(intervals: LineInterval[], start: number, end: number, tolerance = 0.02): boolean {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  return intervals.some((interval) => min >= interval.start - tolerance && max <= interval.end + tolerance)
}

function clampLineCoordinate(value: number, min: number, max: number): number {
  if (value <= min) return min + epsilon
  if (value >= max) return max - epsilon
  return value
}

function boundsFor(points: Point2[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}
