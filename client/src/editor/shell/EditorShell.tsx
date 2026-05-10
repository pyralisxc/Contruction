import React from 'react'
import { AppShell, AdaptivePanel } from './AppShell'
import { ModeRail } from './ModeRail'
import { StatusBar } from './StatusBar'
import { TopCommandBar } from './TopCommandBar'
import { ToolPanel } from '../tools/ToolPanel'
import { Inspector } from '../inspector/Inspector'
import { CanvasWorkspace } from '../canvas/CanvasWorkspace'
import useBimProjectStore, { buildProjectWithFloorDrivenUpdates, FloorDrivenUpdateSelection } from '../../stores/bimProjectStore'
import { FloorElement, ProjectDocument } from '../../bim/types'
import { buildEditorData } from '../selectors'
import { listStoredProjects, loadStoredProject, openBlueprintPackage, readProjectFile, saveProjectToStorage, saveTakeoffCsv, StoredProjectSummary } from '../projectIO'
import { createSampleProject } from '../../bim/sampleProject'

interface FloorUpdateReviewState extends FloorDrivenUpdateSelection {
  floorId: string | null
  open: boolean
}

function countElements(project: ProjectDocument, type: 'wall' | 'roof' | 'opening') {
  return project.elements.filter((element) => element.type === type).length
}

export function EditorShell() {
  const project = useBimProjectStore((state) => state.project)
  const selectedId = useBimProjectStore((state) => state.selectedId)
  const activeLevelId = useBimProjectStore((state) => state.activeLevelId)
  const selectElement = useBimProjectStore((state) => state.selectElement)
  const commitProject = useBimProjectStore((state) => state.commitProject)
  const loadProject = useBimProjectStore((state) => state.loadProject)
  const snapFeet = useBimProjectStore((state) => state.snapFeet)
  const [railCollapsed, setRailCollapsed] = React.useState(false)
  const [activePanel, setActivePanel] = React.useState<AdaptivePanel>(null)
  const [featureNotice, setFeatureNotice] = React.useState<string | null>(null)
  const [savedProjects, setSavedProjects] = React.useState<StoredProjectSummary[]>([])
  const [saveStatus, setSaveStatus] = React.useState('Ready')
  const [review, setReview] = React.useState<FloorUpdateReviewState>({
    floorId: null,
    open: false,
    preserveOpenings: true,
    syncRoof: true,
    syncWalls: true,
  })

  const previewProject = React.useMemo(() => {
    if (!review.open || !review.floorId) return null
    if (!review.syncWalls && !review.syncRoof) return null
    return buildProjectWithFloorDrivenUpdates(project, review.floorId, activeLevelId, review)
  }, [activeLevelId, project, review])

  const effectiveProject = previewProject ?? project
  const data = React.useMemo(() => buildEditorData(effectiveProject, selectedId), [effectiveProject, selectedId])
  const liveProjectData = React.useMemo(() => previewProject ? buildEditorData(project, selectedId) : data, [data, previewProject, project, selectedId])
  const selectedFloor = React.useMemo(
    () => (review.floorId ? project.elements.find((element): element is FloorElement => element.type === 'floor' && element.id === review.floorId) ?? null : null),
    [project, review.floorId],
  )
  const previewMetrics = React.useMemo(() => {
    if (!previewProject) return null
    return {
      walls: countElements(previewProject, 'wall') - countElements(project, 'wall'),
      roofs: countElements(previewProject, 'roof') - countElements(project, 'roof'),
      openings: countElements(previewProject, 'opening') - countElements(project, 'opening'),
      members: data.derived.framing.length - liveProjectData.derived.framing.length,
    }
  }, [data.derived.framing.length, liveProjectData.derived.framing.length, previewProject, project])

  const closeReview = React.useCallback(() => {
    setReview((current) => ({ ...current, floorId: null, open: false }))
  }, [])

  const openReview = React.useCallback((floorId: string) => {
    selectElement(floorId)
    setActivePanel(null)
    setReview({
      floorId,
      open: true,
      preserveOpenings: true,
      syncRoof: true,
      syncWalls: true,
    })
  }, [selectElement])

  const applyReview = React.useCallback(() => {
    if (!previewProject || !review.floorId) return
    commitProject(previewProject)
    selectElement(review.floorId)
    closeReview()
  }, [closeReview, commitProject, previewProject, review.floorId, selectElement])

  const showFeatureStub = React.useCallback((label: string) => {
    setFeatureNotice(`${label} is to be developed.`)
    window.setTimeout(() => setFeatureNotice(null), 2400)
  }, [])

  const refreshSavedProjects = React.useCallback(() => {
    listStoredProjects()
      .then((projects) => setSavedProjects(projects))
      .catch(() => setSavedProjects([]))
  }, [])

  React.useEffect(() => {
    refreshSavedProjects()
  }, [refreshSavedProjects])

  const handleSaveProject = React.useCallback(async () => {
    setSaveStatus('Saving...')
    try {
      await saveProjectToStorage(project)
      setSaveStatus(`Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
      refreshSavedProjects()
    } catch (error) {
      setSaveStatus('Save failed')
      window.alert(error instanceof Error ? error.message : 'Could not save project')
    }
  }, [project, refreshSavedProjects])

  const handleStoredProjectLoad = React.useCallback((projectId: string) => {
    loadStoredProject(projectId)
      .then((storedProject) => {
        loadProject(storedProject)
        setSaveStatus('Loaded')
        refreshSavedProjects()
      })
      .catch((error: Error) => window.alert(error.message))
  }, [loadProject, refreshSavedProjects])

  const handleNewProjectTab = React.useCallback(() => {
    const next = createSampleProject()
    loadProject({
      ...next,
      name: `New Project ${savedProjects.length + 1}`,
      updatedAt: new Date().toISOString(),
    })
    selectElement(null)
    setSaveStatus('New unsaved project')
  }, [loadProject, savedProjects.length, selectElement])

  React.useEffect(() => {
    if (!review.open || !review.floorId) return
    const floorExists = project.elements.some((element) => element.type === 'floor' && element.id === review.floorId)
    if (!floorExists) closeReview()
  }, [closeReview, project.elements, review.floorId, review.open])

  React.useEffect(() => {
    if (!review.open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeReview()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeReview, review.open])

  const handleLoad = React.useCallback(
    (file: File) => {
      readProjectFile(file)
        .then(loadProject)
        .catch((error: Error) => window.alert(error.message))
    },
    [loadProject],
  )

  return (
    <AppShell activePanel={activePanel} notice={featureNotice} railCollapsed={railCollapsed} onPanelChange={setActivePanel}>
      <TopCommandBar
        project={project}
        onSave={handleSaveProject}
        onLoad={handleLoad}
        onLoadStoredProject={handleStoredProjectLoad}
        onExportCsv={() => saveTakeoffCsv(project, liveProjectData.takeoff)}
        onBlueprint={() => openBlueprintPackage(project, liveProjectData.takeoff)}
        onFeatureStub={showFeatureStub}
        savedProjects={savedProjects}
        saveStatus={saveStatus}
      />
      <div className="workspace">
        <ModeRail collapsed={railCollapsed} onFeatureStub={showFeatureStub} onToggleCollapse={() => setRailCollapsed((v) => !v)} />
        <ToolPanel project={effectiveProject} data={data} onSelectViolation={(id) => id && selectElement(id)} onReviewFloorUpdates={openReview} />
        <CanvasWorkspace project={effectiveProject} data={data} onNewProject={handleNewProjectTab} onSelect={(id) => {
          selectElement(id)
          if (id) setActivePanel('inspector')
        }} />
        <Inspector project={effectiveProject} data={data} onReviewFloorUpdates={openReview} />
      </div>
      {review.open && selectedFloor && (
        <div className="review-overlay" role="presentation">
          <section className="review-dialog" aria-modal="true" role="dialog" aria-labelledby="footprint-review-title">
            <div className="review-dialog__header">
              <div>
                <h2 id="footprint-review-title">Review footprint updates</h2>
                <p>Toggle updates and watch the plan and 3D views behind this panel preview the changes before we apply them.</p>
              </div>
              <button className="secondary review-dialog__close" onClick={closeReview} aria-label="Close footprint review">
                Close
              </button>
            </div>
            <div className="review-dialog__body">
              <div className="review-dialog__section">
                <strong>{selectedFloor.name}</strong>
                <span>{selectedFloor.polygon.length} footprint points</span>
              </div>
              <label className="review-checkbox">
                <input
                  checked={review.syncWalls}
                  type="checkbox"
                  onChange={(event) => setReview((current) => ({ ...current, syncWalls: event.target.checked }))}
                />
                <span>
                  <strong>Update exterior walls</strong>
                  <small>Rebuild the outside wall loop from the edited floor outline.</small>
                </span>
              </label>
              <label className="review-checkbox">
                <input
                  checked={review.syncRoof}
                  type="checkbox"
                  onChange={(event) => setReview((current) => ({ ...current, syncRoof: event.target.checked }))}
                />
                <span>
                  <strong>Sync roof footprint</strong>
                  <small>Carry the edited floor outline up to the roof footprint while keeping roof settings.</small>
                </span>
              </label>
              <label className={`review-checkbox ${review.syncWalls ? '' : 'is-disabled'}`}>
                <input
                  checked={review.preserveOpenings}
                  disabled={!review.syncWalls}
                  type="checkbox"
                  onChange={(event) => setReview((current) => ({ ...current, preserveOpenings: event.target.checked }))}
                />
                <span>
                  <strong>Preserve and remap openings</strong>
                  <small>Carry doors and windows onto the nearest rebuilt exterior wall when the geometry still fits.</small>
                </span>
              </label>
              <div className="review-dialog__section review-metrics">
                <div>
                  <span>Wall delta</span>
                  <strong>{previewMetrics ? `${previewMetrics.walls >= 0 ? '+' : ''}${previewMetrics.walls}` : '0'}</strong>
                </div>
                <div>
                  <span>Roof delta</span>
                  <strong>{previewMetrics ? `${previewMetrics.roofs >= 0 ? '+' : ''}${previewMetrics.roofs}` : '0'}</strong>
                </div>
                <div>
                  <span>Opening delta</span>
                  <strong>{previewMetrics ? `${previewMetrics.openings >= 0 ? '+' : ''}${previewMetrics.openings}` : '0'}</strong>
                </div>
                <div>
                  <span>Framing delta</span>
                  <strong>{previewMetrics ? `${previewMetrics.members >= 0 ? '+' : ''}${previewMetrics.members}` : '0'}</strong>
                </div>
              </div>
            </div>
            <div className="review-dialog__footer">
              <span className="review-hint">
                {previewProject ? 'Preview is live in the viewers.' : 'Select at least one update to generate a preview.'}
              </span>
              <div className="review-actions">
                <button className="secondary" onClick={closeReview}>Cancel</button>
                <button onClick={applyReview} disabled={!previewProject || (!review.syncWalls && !review.syncRoof)}>
                  Apply updates
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      <StatusBar project={effectiveProject} selectedId={selectedId} rules={data.rules} estimate={data.takeoff.estimatedCost} snapFeet={snapFeet} />
    </AppShell>
  )
}
