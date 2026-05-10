import assert from 'node:assert/strict'
import useBimProjectStore from '../client/src/stores/bimProjectStore'
import { createSampleProject } from '../client/src/bim/sampleProject'

// Ensure baseline
const store = useBimProjectStore.getState()
store.loadProject(createSampleProject())

const floor = store.project.elements.find((e) => e.type === 'floor')
assert.ok(floor && floor.type === 'floor', 'sample project must include a floor')

// Apply an extrude operation and capture resulting project
store.extrudeFace(floor.id, 'top', 2)
const after = JSON.parse(JSON.stringify(store.project))

// Export operations, reset baseline, import and replay
const exported = store.exportOperations()
store.loadProject(createSampleProject())
store.importOperations(exported)

// After replay, project should match
assert.deepEqual(store.project, after, 'replayed project should match the project after the original extrude')

console.log('ops_replay test: OK')
