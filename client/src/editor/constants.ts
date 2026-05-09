import { EditorMode, ViewMode } from '../bim/types'

export const modeMeta: Record<EditorMode, { label: string; icon: string; description: string }> = {
  site: { label: 'Site', icon: 'SI', description: 'Boundary, terrain, elevations, and site controls.' },
  structure: { label: 'Build', icon: 'BL', description: 'Floors, decks, walls, openings, roofs, stairs, posts, and rails.' },
  openings: { label: 'Openings', icon: 'OP', description: 'Doors, windows, rough openings, and header planning.' },
  roof: { label: 'Roof', icon: 'RF', description: 'Roof footprint, pitch, overhangs, and roof framing.' },
  electrical: { label: 'Systems', icon: 'SY', description: 'Electrical, plumbing, HVAC, fixtures, routes, and coordination.' },
  plumbing: { label: 'Plumbing', icon: 'PL', description: 'Fixtures, supply, drain, vent, and slope planning.' },
  hvac: { label: 'HVAC', icon: 'HV', description: 'Mini-splits, ducts, ventilation, and clearances.' },
  materials: { label: 'Materials', icon: 'MA', description: 'Takeoff, locations, supplier matches, and cost.' },
  code: { label: 'Code', icon: 'CO', description: 'Rule review, violations, references, and suggested fixes.' },
  blueprints: { label: 'Blueprints', icon: 'BP', description: 'Sheets, schedules, exports, and permit package preview.' },
}

export const viewMeta: Record<ViewMode, { label: string }> = {
  architectural: { label: 'Architectural' },
  framing: { label: 'Rough Framing' },
  mep: { label: 'MEP' },
  code: { label: 'Code Review' },
  blueprint: { label: 'Sheets' },
  takeoff: { label: 'Takeoff' },
}
