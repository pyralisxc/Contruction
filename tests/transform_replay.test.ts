import assert from 'node:assert/strict'
import useBimProjectStore from '../client/src/stores/bimProjectStore'
import { createSampleProject } from '../client/src/bim/sampleProject'

const store = useBimProjectStore.getState()

function resetBaseline() {
  store.loadProject(createSampleProject())
  try { store.clearOperations() } catch (e) {}
}

function polygonCentroid(points: { x: number; y: number }[]) {
  const total = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: total.x / points.length, y: total.y / points.length }
}

function rotatePoint(pt: { x: number; y: number }, cx: number, cy: number, rad: number) {
  const dx = pt.x - cx
  const dy = pt.y - cy
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: cx + cos * dx - sin * dy, y: cy + sin * dx + cos * dy }
}

// Test 1: Translate floor polygon
resetBaseline()
const floor = store.project.elements.find((e) => e.type === 'floor')
assert.ok(floor && floor.type === 'floor', 'sample project must include a floor')
const translated = floor.polygon.map((pt: any) => ({ x: pt.x + 2, y: pt.y }))
store.updateElement(floor.id, { polygon: translated })
const afterTranslate = JSON.parse(JSON.stringify(store.project))
const exportedTranslate = store.exportOperations()
store.loadProject(createSampleProject())
store.importOperations(exportedTranslate)
assert.deepEqual(store.project, afterTranslate, 'replayed translate should match')
console.log('transform translate replay: OK')

// Test 2: Rotate floor polygon around centroid
resetBaseline()
const floor2 = store.project.elements.find((e) => e.type === 'floor')
assert.ok(floor2 && floor2.type === 'floor')
const center = polygonCentroid(floor2.polygon)
const rad = Math.PI / 2 // 90 degrees
const rotated = floor2.polygon.map((pt: any) => rotatePoint(pt, center.x, center.y, rad))
store.updateElement(floor2.id, { polygon: rotated })
const afterRotate = JSON.parse(JSON.stringify(store.project))
const exportedRotate = store.exportOperations()
store.loadProject(createSampleProject())
store.importOperations(exportedRotate)
assert.deepEqual(store.project, afterRotate, 'replayed rotate should match')
console.log('transform rotate replay: OK')

// Test 3: Scale floor polygon about centroid
resetBaseline()
const floor3 = store.project.elements.find((e) => e.type === 'floor')
assert.ok(floor3 && floor3.type === 'floor')
const center3 = polygonCentroid(floor3.polygon)
const factor = 1.2
const scaled = floor3.polygon.map((pt: any) => ({ x: center3.x + (pt.x - center3.x) * factor, y: center3.y + (pt.y - center3.y) * factor }))
store.updateElement(floor3.id, { polygon: scaled })
const afterScale = JSON.parse(JSON.stringify(store.project))
const exportedScale = store.exportOperations()
store.loadProject(createSampleProject())
store.importOperations(exportedScale)
assert.deepEqual(store.project, afterScale, 'replayed scale should match')
console.log('transform scale replay: OK')

console.log('transform_replay test: OK')
