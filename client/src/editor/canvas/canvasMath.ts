import { Point2 } from '../../bim/types'
import { PlanViewportState } from '../types'

export const planScale = 14
export const planOrigin = { x: 90, y: 82 }

export function toSvg(point: Point2) {
  return { x: planOrigin.x + point.x * planScale, y: planOrigin.y + point.y * planScale }
}

export function fromSvg(point: Point2): Point2 {
  return { x: (point.x - planOrigin.x) / planScale, y: (point.y - planOrigin.y) / planScale }
}

export function viewportTransform(viewport: PlanViewportState): string {
  return `translate(${viewport.pan.x} ${viewport.pan.y}) scale(${viewport.zoom})`
}

export function screenSvgToPlan(point: Point2, viewport: PlanViewportState): Point2 {
  const unscaled = {
    x: (point.x - viewport.pan.x) / viewport.zoom,
    y: (point.y - viewport.pan.y) / viewport.zoom,
  }
  return fromSvg(unscaled)
}

export function snapPoint(point: Point2, snapFeet: number): Point2 {
  if (!snapFeet) return point
  return {
    x: Math.round(point.x / snapFeet) * snapFeet,
    y: Math.round(point.y / snapFeet) * snapFeet,
  }
}
