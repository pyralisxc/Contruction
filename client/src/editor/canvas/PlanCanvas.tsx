import React from 'react'
import { distance2, polygonBounds } from '../../bim/geometry'
import { pointInPolygon } from '../../bim/framingGeometry'
import {
  BuildingElement,
  ElectricalDeviceElement,
  FloorElement,
  HouseAccessoryElement,
  OpeningElement,
  PipeElement,
  PlumbingFixtureElement,
  Point2,
  ProjectDocument,
  RoofElement,
  SpaceModel,
  StairElement,
  ViewMode,
  WallElement,
} from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { EditorDerivedData } from '../selectors'
import { EditorToolId, SelectionHandle, SnapTarget } from '../types'
import { planScale, screenSvgToPlan, snapPoint, toSvg, viewportTransform } from './canvasMath'

const viewBox = { width: 760, height: 520 }
const hitRadiusFeet = 1.25

export function PlanCanvas({
  project,
  data,
  selectedId,
  viewMode,
  onSelect,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  selectedId: string | null
  viewMode: ViewMode
  onSelect: (id: string | null) => void
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const activeTool = useBimProjectStore((state) => state.activeTool)
  const toolSession = useBimProjectStore((state) => state.toolSession)
  const dragState = useBimProjectStore((state) => state.dragState)
  const visibleLayers = useBimProjectStore((state) => state.visibleLayers)
  const planViewport = useBimProjectStore((state) => state.planViewport)
  const snapFeet = useBimProjectStore((state) => state.snapFeet)
  const setPlanViewport = useBimProjectStore((state) => state.setPlanViewport)
  const fitPlanToProject = useBimProjectStore((state) => state.fitPlanToProject)
  const beginToolSession = useBimProjectStore((state) => state.beginToolSession)
  const updateToolSession = useBimProjectStore((state) => state.updateToolSession)
  const commitToolSession = useBimProjectStore((state) => state.commitToolSession)
  const cancelToolSession = useBimProjectStore((state) => state.cancelToolSession)
  const setElementPreview = useBimProjectStore((state) => state.setElementPreview)
  const updateElement = useBimProjectStore((state) => state.updateElement)
  const extrudeFace = useBimProjectStore((state) => state.extrudeFace)
  const beginDrag = useBimProjectStore((state) => state.beginDrag)
  const updateDragPoint = useBimProjectStore((state) => state.updateDragPoint)
  const endDrag = useBimProjectStore((state) => state.endDrag)
  const moveElement = useBimProjectStore((state) => state.moveElement)
  const resizeElementFromHandle = useBimProjectStore((state) => state.resizeElementFromHandle)
  const createAttachedAdditionOnTarget = useBimProjectStore((state) => state.createAttachedAdditionOnTarget)
  const splitPolygonEdge = useBimProjectStore((state) => state.splitPolygonEdge)
  const deletePolygonVertex = useBimProjectStore((state) => state.deletePolygonVertex)
  const updatePathPoint = useBimProjectStore((state) => state.updatePathPoint)
  const addTerrainPoint = useBimProjectStore((state) => state.addTerrainPoint)
  const createOpeningAt = useBimProjectStore((state) => state.createOpeningAt)
  const createElectricalDeviceAt = useBimProjectStore((state) => state.createElectricalDeviceAt)
  const createPlumbingFixtureAt = useBimProjectStore((state) => state.createPlumbingFixtureAt)
  const removeElement = useBimProjectStore((state) => state.removeElement)
  const setActiveTool = useBimProjectStore((state) => state.setActiveTool)
  const [hoverPoint, setHoverPoint] = React.useState<Point2 | null>(null)
  const [hoverFaceId, setHoverFaceId] = React.useState<string | null>(null)
  const [snapTarget, setSnapTarget] = React.useState<SnapTarget | null>(null)
  const [orthoLock, setOrthoLock] = React.useState(true)
  const [typedLength, setTypedLength] = React.useState('')
  const [typedWidth, setTypedWidth] = React.useState('')
  const [typedDepth, setTypedDepth] = React.useState('')
  const [wallChain, setWallChain] = React.useState(false)
  const pushPullStartRef = React.useRef<any>(null)
  const [extrudeInput, setExtrudeInput] = React.useState('')
  const [extrudeInputFocused, setExtrudeInputFocused] = React.useState(false)

  const floors = project.elements.filter((element): element is FloorElement => element.type === 'floor')
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall')
  const openings = project.elements.filter((element): element is OpeningElement => element.type === 'opening')
  const roofs = project.elements.filter((element): element is RoofElement => element.type === 'roof')
  const stairs = project.elements.filter((element): element is StairElement => element.type === 'stair')
  const accessories = project.elements.filter((element): element is HouseAccessoryElement => element.type === 'houseAccessory')
  const electrical = project.elements.filter((element): element is ElectricalDeviceElement => element.type === 'electricalDevice')
  const fixtures = project.elements.filter((element): element is PlumbingFixtureElement => element.type === 'plumbingFixture')
  const pipes = project.elements.filter((element): element is PipeElement => element.type === 'pipe')
  const ducts = project.elements.filter((element) => element.type === 'duct')
  const selected = project.elements.find((element) => element.id === selectedId)
  const snapTargets = React.useMemo(() => collectSnapTargets(project), [project])
  const attachPreview = React.useMemo(
    () => buildAttachAdditionPreview(selected, activeTool, hoverPoint, typedDepth),
    [selected, activeTool, hoverPoint, typedDepth],
  )

  const applyDrawConstraints = React.useCallback((start: Point2, point: Point2): Point2 => {
    const dx = point.x - start.x
    const dy = point.y - start.y
    const length = Math.hypot(dx, dy)
    if (length < 0.001) return point
    const requestedLength = Number(typedLength)
    const requestedWidth = Number(typedWidth)
    const requestedDepth = Number(typedDepth)
    let next = point
    if (orthoLock && (activeTool === 'drawWall' || activeTool === 'drawFloor' || activeTool === 'drawRoof')) {
      next = Math.abs(dx) >= Math.abs(dy) ? { x: point.x, y: start.y } : { x: start.x, y: point.y }
    }
    if ((activeTool === 'drawFloor' || activeTool === 'drawRoof') && (requestedWidth > 0 || requestedDepth > 0)) {
      return {
        x: start.x + Math.sign(dx || 1) * (requestedWidth > 0 ? requestedWidth : Math.abs(point.x - start.x)),
        y: start.y + Math.sign(dy || 1) * (requestedDepth > 0 ? requestedDepth : Math.abs(point.y - start.y)),
      }
    }
    if (activeTool === 'drawWall' && requestedLength > 0) {
      const constrainedDx = next.x - start.x
      const constrainedDy = next.y - start.y
      const constrainedLength = Math.hypot(constrainedDx, constrainedDy) || 1
      return {
        x: start.x + (constrainedDx / constrainedLength) * requestedLength,
        y: start.y + (constrainedDy / constrainedLength) * requestedLength,
      }
    }
    return next
  }, [activeTool, orthoLock, typedDepth, typedLength, typedWidth])

  function findFaceAtPoint(point: Point2) {
    try {
      const faces = data.derived.derivedFaces || []
      for (const f of faces) {
        const poly2 = f.polygon.map((p) => ({ x: p.x, y: p.y }))
        if (pointInPolygon(point, poly2)) return f
      }
    } catch (e) {}
    return null
  }

  const eventToPlan = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement | SVGElement>): Point2 => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const svgPoint = {
        x: ((event.clientX - rect.left) / rect.width) * viewBox.width,
        y: ((event.clientY - rect.top) / rect.height) * viewBox.height,
      }
      const rawPoint = screenSvgToPlan(svgPoint, planViewport)
      const nearest = event.ctrlKey ? null : nearestSnapTarget(rawPoint, snapTargets, 0.65)
      setSnapTarget(nearest)
      return nearest?.point ?? snapPoint(rawPoint, event.shiftKey ? 0.25 : snapFeet)
    },
    [planViewport, snapFeet, snapTargets],
  )

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cancelToolSession()
      if (event.key === 'Enter') commitToolSession()
      if (event.key === 'Delete' && selectedId) removeElement(selectedId)
      if (event.key.toLowerCase() === 'o' && !isTypingInField(event)) setOrthoLock((value) => !value)
      if (event.key.toLowerCase() === 'c' && !isTypingInField(event)) setWallChain((value) => !value)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelToolSession, commitToolSession, removeElement, selectedId])

  function handleCanvasPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventToPlan(event)
    if (event.button === 1 || event.altKey) {
      beginDrag({ elementId: '__viewport__', handle: 'move', startPoint: point, lastPoint: point })
      return
    }
    if (activeTool === 'addTerrainPoint') {
      addTerrainPoint({ ...point, z: project.site.terrain.baseElevation })
      return
    }
    if (activeTool === 'placeElectricalDevice') {
      createElectricalDeviceAt(point)
      return
    }
    if (activeTool === 'placePlumbingFixture') {
      createPlumbingFixtureAt(point)
      return
    }
    if (activeTool === 'placeOpening') {
      const wall = findNearestWall(point, walls)
      if (wall) createOpeningAt(wall.id, point)
      return
    }
    if (activeTool === 'attachAddition') {
      const requestedDepth = Number(typedDepth)
      if (selected?.type === 'floor') {
        const edgeIndex = nearestPolygonEdgeIndex(point, selected.polygon, 1.35)
        if (edgeIndex !== null) {
          createAttachedAdditionOnTarget(selected.id, edgeIndex, requestedDepth > 0 ? requestedDepth : undefined)
          setActiveTool('select')
        }
        return
      }
      if (selected?.type === 'roof') {
        const edgeIndex = nearestPolygonEdgeIndex(point, selected.footprint, 1.35)
        if (edgeIndex !== null) {
          createAttachedAdditionOnTarget(selected.id, edgeIndex, requestedDepth > 0 ? requestedDepth : undefined)
          setActiveTool('select')
        }
        return
      }
      if (selected?.type === 'wall') {
        const wall = findNearestWall(point, walls)
        if (wall?.id === selected.id) {
          createAttachedAdditionOnTarget(selected.id, undefined, requestedDepth > 0 ? requestedDepth : undefined)
          setActiveTool('select')
        }
        return
      }
      onSelect(null)
      return
    }
    if (activeTool === 'pushPull') {
      // prefer selecting a derived face if present
      const faceHit = findFaceAtPoint(point)
      if (faceHit) {
        const element = project.elements.find((e) => e.id === faceHit.sourceElementId)
        if (element) {
          if (element.type === 'floor') {
            pushPullStartRef.current = { element, base: { elevation: element.elevation ?? 0 }, faceId: faceHit.id }
          } else if (element.type === 'wall') {
            pushPullStartRef.current = { element, base: { height: element.height ?? 9 }, faceId: faceHit.id }
          }
          setExtrudeInput('')
          setExtrudeInputFocused(false)
          beginDrag({ elementId: element.id, handle: 'pushpull', startPoint: point, lastPoint: point })
          onSelect(element.id)
          return
        }
      }
      // If clicking an existing face, begin an interactive push/pull drag
      const targetFloor = floors.find((f) => pointInPolygon(point, f.polygon))
      if (targetFloor) {
        pushPullStartRef.current = { element: targetFloor, base: { elevation: targetFloor.elevation ?? 0 }, faceId: `${targetFloor.id}-face-top` }
        setExtrudeInput('')
        setExtrudeInputFocused(false)
        beginDrag({ elementId: targetFloor.id, handle: 'pushpull', startPoint: point, lastPoint: point })
        onSelect(targetFloor.id)
        return
      }
      const targetWall = findNearestWall(point, walls)
      if (targetWall) {
        // choose the closest derived face if available
        let faceId = `${targetWall.id}-face-outside`
        try {
          const wallSolid = data.derived.wallSolids.find((s) => s.sourceElementId === targetWall.id)
          if (wallSolid && wallSolid.faces && wallSolid.faces.length > 0) {
            const px = point.x
            const py = point.y
            let best: { id: string; dist: number } | null = null
            for (const f of wallSolid.faces) {
              const c = f.center
              const d = Math.hypot(px - c.x, py - c.y)
              if (!best || d < best.dist) best = { id: f.id, dist: d }
            }
            if (best) faceId = best.id
          }
        } catch (e) {}
        pushPullStartRef.current = { element: targetWall, base: { height: targetWall.height ?? 9 }, faceId }
        setExtrudeInput('')
        setExtrudeInputFocused(false)
        beginDrag({ elementId: targetWall.id, handle: 'pushpull', startPoint: point, lastPoint: point })
        onSelect(targetWall.id)
        return
      }
      // fallback to rectangle-style push/pull (create floor)
      const constrained = toolSession?.start ? applyDrawConstraints(toolSession.start, point) : point
      if (!toolSession || toolSession.toolId !== 'pushPull') {
        beginToolSession({ toolId: 'pushPull', mode: useBimProjectStore.getState().mode, start: point, current: point, points: [point] })
      } else {
        updateToolSession({ current: constrained })
        commitToolSession()
      }
      return
    }
    if (activeTool === 'drawFloor' || activeTool === 'drawWall' || activeTool === 'drawRoof') {
      const constrained = toolSession?.start ? applyDrawConstraints(toolSession.start, point) : point
      if (!toolSession || toolSession.toolId !== activeTool) {
        beginToolSession({ toolId: activeTool, mode: useBimProjectStore.getState().mode, start: point, current: point, points: [point] })
      } else {
        updateToolSession({ current: constrained })
        commitToolSession()
        if (activeTool === 'drawWall' && wallChain) {
          window.setTimeout(() => {
            useBimProjectStore.getState().setActiveTool('drawWall')
            useBimProjectStore.getState().beginToolSession({ toolId: 'drawWall', mode: useBimProjectStore.getState().mode, start: constrained, current: constrained, points: [constrained] })
          }, 0)
        }
        if (!wallChain) setTypedLength('')
        if (activeTool === 'drawFloor' || activeTool === 'drawRoof') {
          setTypedWidth('')
          setTypedDepth('')
        }
      }
      return
    }
    if (activeTool === 'drawPipe' || activeTool === 'drawDuct') {
      if (!toolSession) {
        beginToolSession({ toolId: activeTool, mode: useBimProjectStore.getState().mode, start: point, current: point, points: [point], elementKind: activeTool === 'drawPipe' ? 'drain' : 'duct' })
      } else {
        updateToolSession({ points: [...toolSession.points, point], current: point })
      }
      return
    }
    onSelect(null)
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventToPlan(event)
    setHoverPoint(point)
    // update hovered face
    try {
      const faceHit = findFaceAtPoint(point)
      setHoverFaceId(faceHit ? faceHit.id : null)
    } catch (e) {
      setHoverFaceId(null)
    }
    if (dragState) {
      if (dragState.handle === 'pushpull') {
        // Interactive preview: vertical change based on pointer movement along Y axis
        const deltaY = point.y - dragState.startPoint.y
        const preview = pushPullStartRef.current
        if (preview && preview.element) {
          // If the user has typed an explicit value, prefer that instead of pointer drag
          if (extrudeInput !== '') {
            const n = Number(extrudeInput)
            if (Number.isFinite(n)) {
              if (preview.element.type === 'floor') setElementPreview(preview.element.id, { elevation: (preview.base?.elevation ?? 0) + n })
              if (preview.element.type === 'wall') setElementPreview(preview.element.id, { height: Math.max(0.5, (preview.base?.height ?? 9) + n) })
            }
            updateDragPoint(point)
            return
          }
          const element = preview.element
          if (element.type === 'floor') {
            const baseElevation = preview.base?.elevation ?? 0
            let raw = baseElevation - deltaY
            // Snapping modifiers: Shift = fine (0.1 ft), Ctrl/Meta = coarse (0.5 ft)
            let snapped = raw
            if (event.shiftKey) snapped = Math.round(raw * 10) / 10
            else if (event.ctrlKey || event.metaKey) snapped = Math.round(raw * 2) / 2
            const newElevation = Math.max(0, snapped)
            setElementPreview(dragState.elementId, { elevation: newElevation })
          } else if (element.type === 'wall') {
            const baseHeight = preview.base?.height ?? 9
            let raw = baseHeight - deltaY
            let snapped = raw
            if (event.shiftKey) snapped = Math.round(raw * 10) / 10
            else if (event.ctrlKey || event.metaKey) snapped = Math.round(raw * 2) / 2
            const newHeight = Math.max(0.5, snapped)
            setElementPreview(dragState.elementId, { height: newHeight })
          }
        }
        updateDragPoint(point)
        return
      }
      if (dragState.elementId === '__viewport__') {
        setPlanViewport({
          pan: {
            x: planViewport.pan.x + (point.x - dragState.lastPoint.x) * planScale * planViewport.zoom,
            y: planViewport.pan.y + (point.y - dragState.lastPoint.y) * planScale * planViewport.zoom,
          },
        })
        updateDragPoint(point)
        return
      }
      const delta = { x: point.x - dragState.lastPoint.x, y: point.y - dragState.lastPoint.y }
      if (dragState.handle === 'move') {
        moveElement(dragState.elementId, delta)
      } else if (dragState.handle.startsWith('path-')) {
        updatePathPoint(dragState.elementId, Number(dragState.handle.replace('path-', '')), { x: point.x, y: point.y })
      } else {
        resizeElementFromHandle(dragState.elementId, dragState.handle, point)
      }
      updateDragPoint(point)
      return
    }
    if (toolSession) {
      updateToolSession({ current: toolSession.start ? applyDrawConstraints(toolSession.start, point) : point })
    }
  }

  function startHandleDrag(event: React.PointerEvent<SVGElement>, elementId: string, handle: SelectionHandle) {
    event.stopPropagation()
    if (activeTool === 'attachAddition') {
      const requestedDepth = Number(typedDepth)
      if (handle.startsWith('floor-edge-')) {
        createAttachedAdditionOnTarget(elementId, Number(handle.replace('floor-edge-', '')), requestedDepth > 0 ? requestedDepth : undefined)
        setActiveTool('select')
      }
      if (handle.startsWith('roof-edge-')) {
        createAttachedAdditionOnTarget(elementId, Number(handle.replace('roof-edge-', '')), requestedDepth > 0 ? requestedDepth : undefined)
        setActiveTool('select')
      }
      return
    }
    if (activeTool === 'splitFootprint') {
      const point = eventToPlan(event)
      if (handle.startsWith('floor-edge-')) {
        splitPolygonEdge(elementId, Number(handle.replace('floor-edge-', '')), point)
        setActiveTool('select')
      }
      if (handle.startsWith('roof-edge-')) {
        splitPolygonEdge(elementId, Number(handle.replace('roof-edge-', '')), point)
        setActiveTool('select')
      }
      return
    }
    if (activeTool === 'deleteFootprintVertex') {
      if (handle.startsWith('floor-vertex-')) {
        deletePolygonVertex(elementId, Number(handle.replace('floor-vertex-', '')))
        setActiveTool('select')
      }
      if (handle.startsWith('roof-vertex-')) {
        deletePolygonVertex(elementId, Number(handle.replace('roof-vertex-', '')))
        setActiveTool('select')
      }
      return
    }
    const point = eventToPlan(event)
    onSelect(elementId)
    beginDrag({ elementId, handle, startPoint: point, lastPoint: point })
  }

  function handlePointerUp() {
    if (dragState) {
      if (dragState.handle === 'pushpull') {
        // Commit final preview state as a historic extrude op
        const el = project.elements.find((e) => e.id === dragState.elementId)
        const preview = pushPullStartRef.current
        if (el && preview) {
          if (el.type === 'floor') {
            const base = preview.base?.elevation ?? 0
            const distance = (el.elevation ?? 0) - base
            const face = preview.faceId || `${el.id}-face-top`
            extrudeFace(el.id, face, distance)
          } else if (el.type === 'wall') {
            const base = preview.base?.height ?? 9
            const distance = (el.height ?? 0) - base
            const face = preview.faceId || `${el.id}-face-outside`
            extrudeFace(el.id, face, distance)
          }
        }
        pushPullStartRef.current = null
      }
      endDrag()
      return
    }
  }

  function ExtrudeGizmo() {
    if (!selected) return null
    if (selected.type !== 'floor' && selected.type !== 'wall') return null
    const anchor = elementAnchor(selected)
    if (!anchor) return null
    const svg = toSvg(anchor)
    const offsetY = selected.type === 'floor' ? -34 : -34
    const handleY = svg.y + offsetY
    const preview = pushPullStartRef.current
    let distance = 0
    if (preview && preview.element && preview.element.id === selected.id) {
      const current = project.elements.find((e) => e.id === selected.id)
      if (current) {
        if (current.type === 'floor') distance = (current.elevation ?? 0) - (preview.base?.elevation ?? 0)
        if (current.type === 'wall') distance = (current.height ?? 0) - (preview.base?.height ?? 9)
      }
    }
    // Prefer explicit typed value when present
    const typedN = extrudeInput !== '' ? Number(extrudeInput) : NaN
    const displayDistance = Number.isFinite(typedN) ? typedN : distance
    const label = `${displayDistance >= 0 ? '+' : ''}${displayDistance.toFixed(2)} ft`
    return (
      <g className="extrude-gizmo" onPointerDown={(event: React.PointerEvent<SVGElement>) => {
        event.stopPropagation()
        const planPoint = eventToPlan(event)
        // determine faceId for selected element (prefer derived faces)
        let faceId = `${selected.id}-face-top`
        if (selected.type === 'wall') {
          faceId = `${selected.id}-face-outside`
          try {
            const wallSolid = data.derived.wallSolids.find((s) => s.sourceElementId === selected.id)
            if (wallSolid && wallSolid.faces && wallSolid.faces.length > 0) {
              // choose the face whose center is closest to the gizmo anchor
              const anchor = elementAnchor(selected) || { x: wallSolid.center.x, y: wallSolid.center.y }
              let best: { id: string; dist: number } | null = null
              for (const f of wallSolid.faces) {
                const d = Math.hypot(anchor.x - f.center.x, anchor.y - f.center.y)
                if (!best || d < best.dist) best = { id: f.id, dist: d }
              }
              if (best) faceId = best.id
            }
          } catch (e) {}
        }
        if (selected.type === 'floor') {
          pushPullStartRef.current = { element: selected, base: { elevation: selected.elevation ?? 0 }, faceId }
        } else if (selected.type === 'wall') {
          pushPullStartRef.current = { element: selected, base: { height: selected.height ?? 9 }, faceId }
        }
        setExtrudeInput('')
        setExtrudeInputFocused(false)
        beginDrag({ elementId: selected.id, handle: 'pushpull', startPoint: planPoint, lastPoint: planPoint })
        onSelect(selected.id)
      }}>
        <line x1={svg.x} y1={svg.y} x2={svg.x} y2={handleY} stroke="#2563eb" strokeWidth={2} strokeLinecap="round" />
        <polygon points={`${svg.x - 6},${handleY + 6} ${svg.x + 6},${handleY + 6} ${svg.x},${handleY - 4}`} fill="#2563eb" />
        <circle cx={svg.x} cy={handleY - 14} r={6} fill="#1d4ed8" stroke="#ffffff" strokeWidth={1} />
        <text x={svg.x + 10} y={handleY - 10} className="extrude-readout" style={{ fontSize: 12, fill: '#0f172a' }}>{label}</text>
        <text x={svg.x + 10} y={handleY + 20} className="extrude-hint" style={{ fontSize: 10, fill: '#475569' }}>Shift: fine snap · Ctrl: coarse snap</text>
        {dragState && dragState.handle === 'pushpull' && preview && (
          <foreignObject x={svg.x + 12} y={handleY - 38} width={160} height={36}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                autoFocus
                className="extrude-input"
                style={{ width: 120, padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)' }}
                value={extrudeInput}
                placeholder="ft"
                onFocus={() => setExtrudeInputFocused(true)}
                onBlur={() => setExtrudeInputFocused(false)}
                onChange={(e: any) => {
                  setExtrudeInput(e.target.value)
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) {
                    if (preview.element.type === 'floor') setElementPreview(preview.element.id, { elevation: (preview.base?.elevation ?? 0) + n })
                    if (preview.element.type === 'wall') setElementPreview(preview.element.id, { height: Math.max(0.5, (preview.base?.height ?? 9) + n) })
                  }
                }}
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter') {
                    const n = Number(extrudeInput)
                    if (Number.isFinite(n)) {
                      const face = (pushPullStartRef.current && pushPullStartRef.current.faceId) || `${selected.id}-face-top`
                      extrudeFace(selected.id, face, n)
                      pushPullStartRef.current = null
                      setExtrudeInput('')
                      setExtrudeInputFocused(false)
                      endDrag()
                    }
                    e.preventDefault()
                  }
                  if (e.key === 'Escape') {
                    // revert preview to base
                    const p = pushPullStartRef.current
                    if (p && p.element) {
                      if (p.element.type === 'floor') setElementPreview(p.element.id, { elevation: p.base?.elevation ?? 0 })
                      if (p.element.type === 'wall') setElementPreview(p.element.id, { height: p.base?.height ?? 9 })
                    }
                    pushPullStartRef.current = null
                    setExtrudeInput('')
                    setExtrudeInputFocused(false)
                    endDrag()
                    e.preventDefault()
                  }
                }}
              />
            </div>
          </foreignObject>
        )}
      </g>
    )
  }

  function HoveredFaceOverlay() {
    if (!hoverFaceId) return null
    const face = data.derived.derivedFaces?.find((f) => f.id === hoverFaceId)
    if (!face) return null
    const points = face.polygon.map((p) => `${toSvg({ x: p.x, y: p.y }).x},${toSvg({ x: p.x, y: p.y }).y}`).join(' ')
    const center = toSvg({ x: face.center.x, y: face.center.y })
    const normal = face.normal || { x: 0, y: 0, z: 1 }
    const end = toSvg({ x: face.center.x + normal.x * 0.6, y: face.center.y + normal.y * 0.6 })
    return (
      <g pointerEvents="none">
        <polygon points={points} fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth={2} />
        <line x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
        <circle cx={center.x} cy={center.y} r={4} fill="#6366f1" stroke="#ffffff" strokeWidth={1} />
      </g>
    )
  }

  return (
    <div className={`plan-wrap tool-${activeTool}`}>
      <div className="plan-head">
        <strong>2D plan</strong>
        <span>{activeTool === 'select' ? 'Select, drag handles, Alt-drag to pan' : toolLabel(activeTool, Boolean(toolSession))}</span>
        <div className="draw-options">
          <label className={!orthoLock ? 'active' : ''} title="Free-angle walls and skewed footprints">
            <input type="checkbox" checked={!orthoLock} onChange={(event) => setOrthoLock(!event.target.checked)} />
            Free angle
          </label>
          <label className={wallChain ? 'active' : ''}>
            <input type="checkbox" checked={wallChain} onChange={(event) => setWallChain(event.target.checked)} disabled={activeTool !== 'drawWall'} />
            Chain
          </label>
          <label>
            <span>Len</span>
            <input value={typedLength} inputMode="decimal" placeholder="ft" onChange={(event) => setTypedLength(event.target.value)} disabled={activeTool !== 'drawWall'} />
          </label>
          <label>
            <span>W</span>
            <input value={typedWidth} inputMode="decimal" placeholder="ft" onChange={(event) => setTypedWidth(event.target.value)} disabled={activeTool !== 'drawFloor' && activeTool !== 'drawRoof'} />
          </label>
          <label>
            <span>D</span>
            <input value={typedDepth} inputMode="decimal" placeholder="ft" onChange={(event) => setTypedDepth(event.target.value)} disabled={activeTool !== 'drawFloor' && activeTool !== 'drawRoof' && activeTool !== 'attachAddition'} />
          </label>
        </div>
        <div className="plan-zoom-controls">
          {hoverPoint && <span className="cursor-readout">X {hoverPoint.x.toFixed(1)} / Y {hoverPoint.y.toFixed(1)}</span>}
          {snapTarget && <span className="snap-readout">{snapTarget.label}</span>}
          <button onClick={() => setPlanViewport({ zoom: Math.max(0.55, planViewport.zoom - 0.15) })}>-</button>
          <span>{Math.round(planViewport.zoom * 100)}%</span>
          <button onClick={() => setPlanViewport({ zoom: Math.min(2.4, planViewport.zoom + 0.15) })}>+</button>
          <button onClick={fitPlanToProject}>Fit</button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="2D editable building plan"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={endDrag}
        onWheel={(event) => {
          event.preventDefault()
          const nextZoom = Math.max(0.55, Math.min(2.4, planViewport.zoom + (event.deltaY < 0 ? 0.1 : -0.1)))
          setPlanViewport({ zoom: nextZoom })
        }}
      >
        <defs>
          <pattern id="grid" width={planScale} height={planScale} patternUnits="userSpaceOnUse">
            <path d={`M ${planScale} 0 L 0 0 0 ${planScale}`} fill="none" stroke="#d6dde7" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="760" height="520" fill="#f8fafc" />
        <rect width="760" height="520" fill="url(#grid)" />
        <g transform={viewportTransform(planViewport)}>
          {visibleLayers.terrain && <TerrainLayer project={project} />}
          {project.spaces.map((space) => <SpaceShape key={space.id} space={space} />)}
          {visibleLayers.roof && roofs.map((roof) => <RoofShape key={roof.id} roof={roof} selectedId={selectedId} activeTool={activeTool} onSelect={onSelect} />)}
          {visibleLayers.floors && floors.map((floor) => <FloorShape key={floor.id} floor={floor} selectedId={selectedId} activeTool={activeTool} onSelect={onSelect} />)}
          {visibleLayers.floors && stairs.map((stair) => <StairShape key={stair.id} stair={stair} selectedId={selectedId} onSelect={onSelect} />)}
          {visibleLayers.floors && accessories.map((accessory) => <AccessoryShape key={accessory.id} accessory={accessory} selectedId={selectedId} onSelect={onSelect} />)}
          {visibleLayers.framing && (viewMode === 'framing' || selected?.type === 'floor') && <FramingPlanOverlay data={data} selectedId={selectedId} />}
          {visibleLayers.walls && walls.map((wall) => <WallShape key={wall.id} wall={wall} selectedId={selectedId} activeTool={activeTool} onSelect={onSelect} />)}
          {visibleLayers.openings && openings.map((opening) => renderOpening(opening, walls, selectedId, onSelect))}
          {(viewMode === 'mep' || viewMode === 'code' || visibleLayers.electrical) && visibleLayers.electrical && electrical.map((device) => <DeviceSymbol key={device.id} device={device} selectedId={selectedId} onSelect={onSelect} />)}
          {(viewMode === 'mep' || viewMode === 'code' || visibleLayers.plumbing) && visibleLayers.plumbing && fixtures.map((fixture) => <FixtureSymbol key={fixture.id} fixture={fixture} selectedId={selectedId} onSelect={onSelect} />)}
          {(viewMode === 'mep' || viewMode === 'code' || visibleLayers.plumbing) && visibleLayers.plumbing && pipes.map((pipe) => <PathRun key={pipe.id} element={pipe} selectedId={selectedId} onSelect={onSelect} />)}
          {(viewMode === 'mep' || viewMode === 'code' || visibleLayers.hvac) && visibleLayers.hvac && ducts.map((duct) => <PathRun key={duct.id} element={duct} selectedId={selectedId} onSelect={onSelect} />)}
          {visibleLayers.warnings && data.rules.filter((rule) => rule.status !== 'pass' && rule.elementId).map((rule) => <WarningHalo key={rule.id} element={project.elements.find((item) => item.id === rule.elementId)} />)}
          {visibleLayers.dimensions && <DimensionLayer project={project} selectedId={selectedId} />}
          {visibleLayers.dimensions && selected && <SelectedPlanCallout selected={selected} />}
          {hoverPoint && activeTool !== 'select' && <CursorMarker point={hoverPoint} snapTarget={snapTarget} />}
          {attachPreview && <AttachAdditionPreview preview={attachPreview} />}
          {toolSession && <ToolPreview session={toolSession} />}
          {toolSession && <ToolPreview session={toolSession} />}
          {hoverFaceId && <HoveredFaceOverlay />}
          {selected && <SelectionHandles selected={selected} walls={walls} startHandleDrag={startHandleDrag} />}
          {selected && activeTool === 'pushPull' && <ExtrudeGizmo />}
        </g>
      </svg>
    </div>
  )
}

function TerrainLayer({ project }: { project: ProjectDocument }) {
  return (
    <>
      <polyline
        points={project.site.boundary.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')}
        fill="rgba(202, 138, 4, 0.07)"
        stroke="#b45309"
        strokeWidth="1.5"
      />
      {project.site.terrain.points.map((point) => {
        const svg = toSvg(point)
        return (
          <g key={point.id}>
            <circle cx={svg.x} cy={svg.y} r="4" fill="#0f766e" />
            <text x={svg.x + 6} y={svg.y - 5}>
              {point.z.toFixed(1)} ft
            </text>
          </g>
        )
      })}
    </>
  )
}

function SpaceShape({ space }: { space: SpaceModel }) {
  const bounds = polygonBounds(space.polygon)
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  const svg = toSvg(center)
  return (
    <g className="space-shape">
      <polygon points={space.polygon.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')} />
      <text x={svg.x} y={svg.y}>{space.name}</text>
    </g>
  )
}

function FloorShape({ floor, selectedId, activeTool, onSelect }: { floor: FloorElement; selectedId: string | null; activeTool: EditorToolId; onSelect: (id: string) => void }) {
  return (
    <polygon
      points={floor.polygon.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')}
      fill={selectedId === floor.id ? 'rgba(37,99,235,.18)' : 'rgba(148,163,184,.22)'}
      stroke={selectedId === floor.id ? '#2563eb' : '#64748b'}
      strokeWidth="2"
      onPointerDown={(event) => {
        if (activeTool === 'attachAddition' && selectedId === floor.id) return
        event.stopPropagation()
        onSelect(floor.id)
      }}
    />
  )
}

function RoofShape({ roof, selectedId, activeTool, onSelect }: { roof: RoofElement; selectedId: string | null; activeTool: EditorToolId; onSelect: (id: string) => void }) {
  return (
    <polygon
      points={roof.footprint.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')}
      fill={selectedId === roof.id ? 'rgba(180,83,9,.14)' : 'rgba(251,191,36,.08)'}
      stroke={selectedId === roof.id ? '#b45309' : '#d97706'}
      strokeWidth="1.8"
      strokeDasharray="6 4"
      onPointerDown={(event) => {
        if (activeTool === 'attachAddition' && selectedId === roof.id) return
        event.stopPropagation()
        onSelect(roof.id)
      }}
    />
  )
}

function StairShape({ stair, selectedId, onSelect }: { stair: StairElement; selectedId: string | null; onSelect: (id: string) => void }) {
  const steps = Math.max(1, Math.ceil(stair.totalRise / stair.riserHeight))
  const run = steps * stair.treadDepth
  const end = stair.direction === 'x' ? { x: stair.position.x + run, y: stair.position.y } : { x: stair.position.x, y: stair.position.y + run }
  const start = toSvg(stair.position)
  const finish = toSvg(end)
  return (
    <g onPointerDown={(event) => {
      event.stopPropagation()
      onSelect(stair.id)
    }}>
      <line x1={start.x} y1={start.y} x2={finish.x} y2={finish.y} stroke={selectedId === stair.id ? '#2563eb' : '#7c2d12'} strokeWidth="7" strokeLinecap="square" />
      {Array.from({ length: steps + 1 }, (_, index) => {
        const ratio = index / steps
        const x = start.x + (finish.x - start.x) * ratio
        const y = start.y + (finish.y - start.y) * ratio
        return <circle key={index} cx={x} cy={y} r="2.5" fill="#fbbf24" />
      })}
    </g>
  )
}

function AccessoryShape({ accessory, selectedId, onSelect }: { accessory: HouseAccessoryElement; selectedId: string | null; onSelect: (id: string) => void }) {
  const svg = toSvg(accessory.position)
  const width = accessory.width * planScale
  const depth = accessory.depth * planScale
  const fill = accessory.accessoryKind === 'guardRail' ? 'rgba(15,118,110,.18)' : accessory.accessoryKind === 'column' ? '#7f5539' : 'rgba(148,163,184,.24)'
  const stroke = selectedId === accessory.id ? '#2563eb' : accessory.accessoryKind === 'guardRail' ? '#0f766e' : '#475569'
  return (
    <g onPointerDown={(event) => {
      event.stopPropagation()
      onSelect(accessory.id)
    }}>
      <rect x={svg.x - width / 2} y={svg.y - depth / 2} width={width} height={depth} fill={fill} stroke={stroke} strokeWidth="2" />
      <text x={svg.x + width / 2 + 4} y={svg.y + 4}>
        {accessory.accessoryKind}
      </text>
    </g>
  )
}

function WallShape({ wall, selectedId, activeTool, onSelect }: { wall: WallElement; selectedId: string | null; activeTool: EditorToolId; onSelect: (id: string) => void }) {
  const start = toSvg(wall.path[0])
  const end = toSvg(wall.path[1])
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={selectedId === wall.id ? '#dc2626' : wall.exterior ? '#111827' : '#475569'}
      strokeWidth={wall.exterior ? 7 : 4}
      strokeLinecap="square"
      onPointerDown={(event) => {
        if (activeTool === 'attachAddition' && selectedId === wall.id) return
        event.stopPropagation()
        onSelect(wall.id)
      }}
    />
  )
}

function renderOpening(opening: OpeningElement, walls: WallElement[], selectedId: string | null, onSelect: (id: string) => void) {
  const wall = walls.find((candidate) => candidate.id === opening.hostWallId)
  if (!wall) return null
  const center = pointOnWall(wall, opening.center)
  const svg = toSvg(center)
  const angle = Math.atan2(wall.path[1].y - wall.path[0].y, wall.path[1].x - wall.path[0].x) * (180 / Math.PI)
  return (
    <rect
      key={opening.id}
      x={svg.x - opening.width * planScale * 0.5}
      y={svg.y - 5}
      width={opening.width * planScale}
      height={10}
      transform={`rotate(${angle} ${svg.x} ${svg.y})`}
      fill={opening.openingKind === 'door' ? '#f59e0b' : '#38bdf8'}
      stroke={selectedId === opening.id ? '#dc2626' : '#0f172a'}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(opening.id)
      }}
    />
  )
}

function DeviceSymbol({ device, selectedId, onSelect }: { device: ElectricalDeviceElement; selectedId: string | null; onSelect: (id: string) => void }) {
  const svg = toSvg(device.position)
  return (
    <g
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(device.id)
      }}
    >
      <circle cx={svg.x} cy={svg.y} r="7" fill={selectedId === device.id ? '#fde68a' : '#eab308'} stroke="#854d0e" />
      <text x={svg.x + 10} y={svg.y + 4}>
        {device.deviceKind === 'gfciOutlet' ? 'GFCI' : device.deviceKind[0].toUpperCase()}
      </text>
    </g>
  )
}

function FixtureSymbol({ fixture, selectedId, onSelect }: { fixture: PlumbingFixtureElement; selectedId: string | null; onSelect: (id: string) => void }) {
  const svg = toSvg(fixture.position)
  return (
    <g
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(fixture.id)
      }}
    >
      <rect x={svg.x - 7} y={svg.y - 7} width="14" height="14" rx="3" fill={selectedId === fixture.id ? '#bae6fd' : '#0ea5e9'} stroke="#075985" />
      <text x={svg.x + 10} y={svg.y + 4}>
        {fixture.fixtureKind}
      </text>
    </g>
  )
}

function PathRun({ element, selectedId, onSelect }: { element: PipeElement | { id: string; type: 'duct'; path: { x: number; y: number; z: number }[]; ductKind: string }; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <polyline
      points={element.path.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')}
      fill="none"
      stroke={element.type === 'duct' ? '#7c3aed' : element.pipeKind === 'drain' ? '#16a34a' : '#0284c7'}
      strokeWidth={selectedId === element.id ? 6 : element.type === 'duct' ? 5 : 3}
      strokeDasharray={element.type === 'duct' || (element.type === 'pipe' && element.pipeKind === 'vent') ? '5 4' : undefined}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(element.id)
      }}
    />
  )
}

function FramingPlanOverlay({ data, selectedId }: { data: EditorDerivedData; selectedId: string | null }) {
  const visibleLayers = useBimProjectStore((state) => state.visibleLayers)
  return (
    <g opacity="0.45">
      {data.derived.framing
        .filter((member) => {
          if (member.subsystem === 'floor' && !visibleLayers.floorFraming) return false
          if (member.subsystem === 'wall' && !visibleLayers.wallFraming) return false
          if (member.subsystem === 'roof' && !visibleLayers.roofFraming) return false
          if (member.subsystem === 'pier' && !visibleLayers.foundation) return false
          return !selectedId || member.sourceElementId === selectedId || member.subsystem === 'pier'
        })
        .map((member) => (
          <line
            key={member.id}
            x1={toSvg(member.start).x}
            y1={toSvg(member.start).y}
            x2={toSvg(member.end).x}
            y2={toSvg(member.end).y}
            stroke={member.subsystem === 'pier' ? '#7f5539' : member.subsystem === 'roof' ? '#92400e' : '#8b5a2b'}
            strokeWidth={member.subsystem === 'pier' ? 3 : 1.4}
          />
        ))}
    </g>
  )
}

function DimensionLayer({ project, selectedId }: { project: ProjectDocument; selectedId: string | null }) {
  const selected = project.elements.find((element) => element.id === selectedId)
  if (!selected) return null
  if (selected.type === 'wall') {
    const dx = selected.path[1].x - selected.path[0].x
    const dy = selected.path[1].y - selected.path[0].y
    const length = Math.max(distance2(selected.path[0], selected.path[1]), 0.001)
    const normal = { x: (-dy / length) * 1.25, y: (dx / length) * 1.25 }
    const start = { x: selected.path[0].x + normal.x, y: selected.path[0].y + normal.y }
    const end = { x: selected.path[1].x + normal.x, y: selected.path[1].y + normal.y }
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return (
      <>
        <DimensionLine start={start} end={end} label={`${length.toFixed(1)} ft`} />
        <DimensionExtension from={selected.path[0]} to={start} />
        <DimensionExtension from={selected.path[1]} to={end} />
        <AngleTag point={{ x: (selected.path[0].x + selected.path[1].x) / 2, y: (selected.path[0].y + selected.path[1].y) / 2 }} angle={angle} />
      </>
    )
  }
  if (selected.type === 'floor' || selected.type === 'roof') {
    const bounds = polygonBounds(selected.type === 'floor' ? selected.polygon : selected.footprint)
    const topStart = { x: bounds.minX, y: bounds.minY - 1.35 }
    const topEnd = { x: bounds.maxX, y: bounds.minY - 1.35 }
    const rightStart = { x: bounds.maxX + 1.35, y: bounds.minY }
    const rightEnd = { x: bounds.maxX + 1.35, y: bounds.maxY }
    return (
      <>
        <DimensionLine start={topStart} end={topEnd} label={`${(bounds.maxX - bounds.minX).toFixed(1)} ft`} />
        <DimensionLine start={rightStart} end={rightEnd} label={`${(bounds.maxY - bounds.minY).toFixed(1)} ft`} />
        <DimensionExtension from={{ x: bounds.minX, y: bounds.minY }} to={topStart} />
        <DimensionExtension from={{ x: bounds.maxX, y: bounds.minY }} to={topEnd} />
        <DimensionExtension from={{ x: bounds.maxX, y: bounds.minY }} to={rightStart} />
        <DimensionExtension from={{ x: bounds.maxX, y: bounds.maxY }} to={rightEnd} />
      </>
    )
  }
  return null
}

function DimensionLine({ start, end, label }: { start: Point2; end: Point2; label: string }) {
  const a = toSvg(start)
  const b = toSvg(end)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.max(Math.hypot(dx, dy), 1)
  const nx = (-dy / length) * 5
  const ny = (dx / length) * 5
  return (
    <g className="dimension-group">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line x1={a.x - nx} y1={a.y - ny} x2={a.x + nx} y2={a.y + ny} />
      <line x1={b.x - nx} y1={b.y - ny} x2={b.x + nx} y2={b.y + ny} />
      <text className="dimension-label" x={mid.x + nx * 0.4} y={mid.y + ny * 0.4 - 3}>
        {label}
      </text>
    </g>
  )
}

function DimensionExtension({ from, to }: { from: Point2; to: Point2 }) {
  const a = toSvg(from)
  const b = toSvg(to)
  return <line className="dimension-extension" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
}

function AngleTag({ point, angle }: { point: Point2; angle: number }) {
  const svg = toSvg(point)
  return (
    <text className="dimension-label angle-tag" x={svg.x + 10} y={svg.y + 18}>
      {`${Math.round(angle)} deg`}
    </text>
  )
}

function SelectedPlanCallout({ selected }: { selected: BuildingElement }) {
  const anchor = elementAnchor(selected)
  if (!anchor) return null
  const svg = toSvg(anchor)
  const details = selectedSummary(selected)
  return (
    <g className="plan-callout" transform={`translate(${svg.x + 18} ${svg.y - 28})`}>
      <rect width="142" height="46" rx="4" />
      <text x="8" y="15">{selected.name}</text>
      <text x="8" y="31">{details}</text>
    </g>
  )
}

function selectedSummary(selected: BuildingElement): string {
  if (selected.type === 'wall') return `Wall ${distance2(selected.path[0], selected.path[1]).toFixed(1)} ft`
  if (selected.type === 'floor') {
    const bounds = polygonBounds(selected.polygon)
    return `Floor ${(bounds.maxX - bounds.minX).toFixed(1)} x ${(bounds.maxY - bounds.minY).toFixed(1)} ft`
  }
  if (selected.type === 'roof') {
    const bounds = polygonBounds(selected.footprint)
    return `Roof ${(bounds.maxX - bounds.minX).toFixed(1)} x ${(bounds.maxY - bounds.minY).toFixed(1)} ft`
  }
  if (selected.type === 'opening') return `${selected.openingKind} ${selected.width.toFixed(1)} x ${selected.height.toFixed(1)} ft`
  if (selected.type === 'stair') return `Stair ${selected.totalRise.toFixed(1)} ft rise`
  if (selected.type === 'houseAccessory') return `${selected.accessoryKind} ${selected.width.toFixed(1)} ft`
  return selected.type
}

function ToolPreview({ session }: { session: NonNullable<ReturnType<typeof useBimProjectStore.getState>['toolSession']> }) {
  const start = session.start ?? session.points[0]
  const current = session.current ?? start
  if (!start || !current) return null
  if (session.toolId === 'drawWall') {
    return <line className="tool-preview" x1={toSvg(start).x} y1={toSvg(start).y} x2={toSvg(current).x} y2={toSvg(current).y} />
  }
  if (session.toolId === 'drawFloor' || session.toolId === 'drawRoof') {
    const points = [
      start,
      { x: current.x, y: start.y },
      current,
      { x: start.x, y: current.y },
    ]
    return <polygon className="tool-preview-fill" points={points.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')} />
  }
  if (session.toolId === 'drawPipe' || session.toolId === 'drawDuct') {
    const points = [...session.points, current]
    return <polyline className="tool-preview" points={points.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')} />
  }
  return null
}

function CursorMarker({ point, snapTarget }: { point: Point2; snapTarget: SnapTarget | null }) {
  const svg = toSvg(point)
  return (
    <g className={snapTarget ? 'cursor-marker cursor-marker-snap' : 'cursor-marker'}>
      <line x1={svg.x - 7} y1={svg.y} x2={svg.x + 7} y2={svg.y} />
      <line x1={svg.x} y1={svg.y - 7} x2={svg.x} y2={svg.y + 7} />
      <circle cx={svg.x} cy={svg.y} r="3" />
    </g>
  )
}

function AttachAdditionPreview({
  preview,
}: {
  preview: {
    polygon: Point2[]
    edge: [Point2, Point2]
    labelPoint: Point2
    depth: number
  }
}) {
  const edgeStart = toSvg(preview.edge[0])
  const edgeEnd = toSvg(preview.edge[1])
  const label = toSvg(preview.labelPoint)
  return (
    <g className="attach-preview">
      <polygon className="attach-preview-fill" points={preview.polygon.map((point) => `${toSvg(point).x},${toSvg(point).y}`).join(' ')} />
      <line className="attach-preview-edge" x1={edgeStart.x} y1={edgeStart.y} x2={edgeEnd.x} y2={edgeEnd.y} />
      <text className="attach-preview-label" x={label.x + 8} y={label.y - 8}>
        +{preview.depth.toFixed(1)} ft
      </text>
    </g>
  )
}

function SelectionHandles({
  selected,
  walls,
  startHandleDrag,
}: {
  selected: ProjectDocument['elements'][number]
  walls: WallElement[]
  startHandleDrag: (event: React.PointerEvent<SVGElement>, elementId: string, handle: SelectionHandle) => void
}) {
  if (selected.type === 'floor') return <PolygonHandles id={selected.id} points={selected.polygon} prefix="floor" startHandleDrag={startHandleDrag} />
  if (selected.type === 'roof') return <PolygonHandles id={selected.id} points={selected.footprint} prefix="roof" startHandleDrag={startHandleDrag} />
  if (selected.type === 'wall') {
    return (
      <>
        <Handle point={selected.path[0]} onPointerDown={(event) => startHandleDrag(event, selected.id, 'wall-start')} />
        <Handle point={selected.path[1]} onPointerDown={(event) => startHandleDrag(event, selected.id, 'wall-end')} />
        <Handle point={{ x: (selected.path[0].x + selected.path[1].x) / 2, y: (selected.path[0].y + selected.path[1].y) / 2 }} kind="move" onPointerDown={(event) => startHandleDrag(event, selected.id, 'move')} />
      </>
    )
  }
  if (selected.type === 'opening') {
    const wall = walls.find((candidate) => candidate.id === selected.hostWallId)
    if (!wall) return null
    const center = pointOnWall(wall, selected.center)
    const left = pointOnWall(wall, selected.center - selected.width / 2)
    const right = pointOnWall(wall, selected.center + selected.width / 2)
    return (
      <>
        <Handle point={left} onPointerDown={(event) => startHandleDrag(event, selected.id, 'opening-left')} />
        <Handle point={center} kind="move" onPointerDown={(event) => startHandleDrag(event, selected.id, 'opening-center')} />
        <Handle point={right} onPointerDown={(event) => startHandleDrag(event, selected.id, 'opening-right')} />
      </>
    )
  }
  if (selected.type === 'electricalDevice' || selected.type === 'plumbingFixture') return <Handle point={selected.position} kind="move" onPointerDown={(event) => startHandleDrag(event, selected.id, 'move')} />
  if (selected.type === 'houseAccessory') return <Handle point={selected.position} kind="move" onPointerDown={(event) => startHandleDrag(event, selected.id, 'move')} />
  if (selected.type === 'pipe' || selected.type === 'duct') {
    return (
      <>
        {selected.path.map((point, index) => (
          <Handle key={`${selected.id}-${index}`} point={point} onPointerDown={(event) => startHandleDrag(event, selected.id, `path-${index}`)} />
        ))}
      </>
    )
  }
  return null
}

function PolygonHandles({
  id,
  points,
  prefix,
  startHandleDrag,
}: {
  id: string
  points: Point2[]
  prefix: 'floor' | 'roof'
  startHandleDrag: (event: React.PointerEvent<SVGElement>, elementId: string, handle: SelectionHandle) => void
}) {
  const bounds = polygonBounds(points)
  const edges = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    return {
      handle: `${prefix}-edge-${index}` as SelectionHandle,
      point: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
    }
  })
  return (
    <>
      {edges.map((edge) => (
        <Handle key={edge.handle} point={edge.point} kind="edge" onPointerDown={(event) => startHandleDrag(event, id, edge.handle)} />
      ))}
      {points.map((point, index) => (
        <Handle
          key={`${prefix}-vertex-${index}`}
          point={point}
          onPointerDown={(event) => startHandleDrag(event, id, `${prefix}-vertex-${index}`)}
        />
      ))}
      <Handle point={{ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }} kind="move" onPointerDown={(event) => startHandleDrag(event, id, 'move')} />
    </>
  )
}

function Handle({ point, kind = 'resize', onPointerDown }: { point: Point2; kind?: 'resize' | 'move' | 'edge'; onPointerDown: (event: React.PointerEvent<SVGCircleElement>) => void }) {
  const svg = toSvg(point)
  return <circle className={`selection-handle handle-${kind}`} cx={svg.x} cy={svg.y} r={kind === 'move' ? 6 : kind === 'edge' ? 4.5 : 5} onPointerDown={onPointerDown} />
}

function WarningHalo({ element }: { element?: ProjectDocument['elements'][number] }) {
  if (!element) return null
  const point = elementAnchor(element)
  if (!point) return null
  const svg = toSvg(point)
  return <circle className="warning-halo" cx={svg.x} cy={svg.y} r="14" />
}

function elementAnchor(element: ProjectDocument['elements'][number]): Point2 | null {
  if (element.type === 'floor') {
    const bounds = polygonBounds(element.polygon)
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  }
  if (element.type === 'roof') {
    const bounds = polygonBounds(element.footprint)
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  }
  if (element.type === 'wall') return { x: (element.path[0].x + element.path[1].x) / 2, y: (element.path[0].y + element.path[1].y) / 2 }
  if (element.type === 'stair') return element.position
  if (element.type === 'houseAccessory') return element.position
  if (element.type === 'electricalDevice' || element.type === 'plumbingFixture') return element.position
  if (element.type === 'pipe' || element.type === 'duct') return element.path[0] ?? null
  return null
}

function pointOnWall(wall: WallElement, center: number): Point2 {
  const length = distance2(wall.path[0], wall.path[1])
  const ratio = length === 0 ? 0 : center / length
  return {
    x: wall.path[0].x + (wall.path[1].x - wall.path[0].x) * ratio,
    y: wall.path[0].y + (wall.path[1].y - wall.path[0].y) * ratio,
  }
}

function findNearestWall(point: Point2, walls: WallElement[]) {
  let best: { wall: WallElement; distance: number } | null = null
  for (const wall of walls) {
    const distance = distanceToWall(point, wall)
    if (!best || distance < best.distance) best = { wall, distance }
  }
  return best && best.distance <= hitRadiusFeet ? best.wall : null
}

function buildAttachAdditionPreview(
  selected: ProjectDocument['elements'][number] | undefined,
  activeTool: EditorToolId,
  hoverPoint: Point2 | null,
  typedDepth: string,
): {
  polygon: Point2[]
  edge: [Point2, Point2]
  labelPoint: Point2
  depth: number
} | null {
  if (activeTool !== 'attachAddition' || !selected || !hoverPoint) return null
  const requestedDepth = Number(typedDepth)
  if (selected.type === 'floor') {
    const edgeIndex = nearestPolygonEdgeIndex(hoverPoint, selected.polygon, 1.35)
    if (edgeIndex === null) return null
    const depth = previewAttachDepth(selected.polygon, edgeIndex, requestedDepth, 0.45, 6, 12)
    return polygonAttachPreview(selected.polygon, edgeIndex, depth)
  }
  if (selected.type === 'roof') {
    const edgeIndex = nearestPolygonEdgeIndex(hoverPoint, selected.footprint, 1.35)
    if (edgeIndex === null) return null
    const depth = previewAttachDepth(selected.footprint, edgeIndex, requestedDepth, 0.35, 4, 10)
    return polygonAttachPreview(selected.footprint, edgeIndex, depth)
  }
  if (selected.type === 'wall' && pointToSegmentDistance(hoverPoint, selected.path[0], selected.path[1]) <= 1.35) {
    const depth = Number.isFinite(requestedDepth) && requestedDepth > 0 ? requestedDepth : 8
    return wallAttachPreview(selected, depth)
  }
  return null
}

function polygonAttachPreview(
  points: Point2[],
  edgeIndex: number,
  depth: number,
): {
  polygon: Point2[]
  edge: [Point2, Point2]
  labelPoint: Point2
  depth: number
} {
  const edge = [points[edgeIndex], points[(edgeIndex + 1) % points.length]] as [Point2, Point2]
  return {
    polygon: addAttachedBayPreview(points, edgeIndex, depth),
    edge,
    labelPoint: previewLabelPoint(points, edgeIndex, depth),
    depth,
  }
}

function wallAttachPreview(
  wall: WallElement,
  depth: number,
): {
  polygon: Point2[]
  edge: [Point2, Point2]
  labelPoint: Point2
  depth: number
} {
  const edge = [wall.path[0], wall.path[1]] as [Point2, Point2]
  const dx = edge[1].x - edge[0].x
  const dy = edge[1].y - edge[0].y
  const length = Math.hypot(dx, dy) || 1
  const normal = { x: dy / length, y: -dx / length }
  const centroid = edgeMidpointPreview(edge[0], edge[1])
  return {
    polygon: [
      edge[0],
      edge[1],
      { x: edge[1].x + normal.x * depth, y: edge[1].y + normal.y * depth },
      { x: edge[0].x + normal.x * depth, y: edge[0].y + normal.y * depth },
    ],
    edge,
    labelPoint: { x: centroid.x + normal.x * depth, y: centroid.y + normal.y * depth },
    depth,
  }
}

function previewAttachDepth(points: Point2[], edgeIndex: number, requestedDepth: number, multiplier: number, minDepth: number, maxDepth: number) {
  if (Number.isFinite(requestedDepth) && requestedDepth > 0) return requestedDepth
  const start = points[edgeIndex]
  const end = points[(edgeIndex + 1) % points.length]
  return Math.max(minDepth, Math.min(maxDepth, Math.hypot(end.x - start.x, end.y - start.y) * multiplier))
}

function addAttachedBayPreview(points: Point2[], edgeIndex: number, depth: number): Point2[] {
  if (points.length < 3) return points
  const startIndex = ((edgeIndex % points.length) + points.length) % points.length
  const endIndex = (startIndex + 1) % points.length
  const start = points[startIndex]
  const end = points[endIndex]
  const edgeLength = Math.hypot(end.x - start.x, end.y - start.y)
  if (edgeLength < 1) return points
  const insetRatio = edgeLength < 8 ? 0.2 : 0.25
  const startInset = {
    x: start.x + (end.x - start.x) * insetRatio,
    y: start.y + (end.y - start.y) * insetRatio,
  }
  const endInset = {
    x: start.x + (end.x - start.x) * (1 - insetRatio),
    y: start.y + (end.y - start.y) * (1 - insetRatio),
  }
  const normal = outwardNormalPreview(points, startIndex)
  const pushedStart = {
    x: startInset.x + normal.x * depth,
    y: startInset.y + normal.y * depth,
  }
  const pushedEnd = {
    x: endInset.x + normal.x * depth,
    y: endInset.y + normal.y * depth,
  }
  return [
    ...points.slice(0, startIndex + 1),
    startInset,
    pushedStart,
    pushedEnd,
    endInset,
    ...points.slice(endIndex),
  ]
}

function previewLabelPoint(points: Point2[], edgeIndex: number, depth: number): Point2 {
  const start = points[edgeIndex]
  const end = points[(edgeIndex + 1) % points.length]
  const midpoint = edgeMidpointPreview(start, end)
  const normal = outwardNormalPreview(points, edgeIndex)
  return {
    x: midpoint.x + normal.x * (depth * 0.6),
    y: midpoint.y + normal.y * (depth * 0.6),
  }
}

function edgeMidpointPreview(start: Point2, end: Point2): Point2 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function polygonCentroidPreview(points: Point2[]): Point2 {
  const total = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 })
  return {
    x: total.x / Math.max(points.length, 1),
    y: total.y / Math.max(points.length, 1),
  }
}

function outwardNormalPreview(points: Point2[], edgeIndex: number): Point2 {
  const start = points[edgeIndex]
  const end = points[(edgeIndex + 1) % points.length]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const candidateA = { x: dy / length, y: -dx / length }
  const candidateB = { x: -dy / length, y: dx / length }
  const midpoint = edgeMidpointPreview(start, end)
  const toMidpoint = {
    x: midpoint.x - polygonCentroidPreview(points).x,
    y: midpoint.y - polygonCentroidPreview(points).y,
  }
  const dotA = candidateA.x * toMidpoint.x + candidateA.y * toMidpoint.y
  const dotB = candidateB.x * toMidpoint.x + candidateB.y * toMidpoint.y
  return dotA >= dotB ? candidateA : candidateB
}

function nearestPolygonEdgeIndex(point: Point2, polygon: Point2[], maxDistance: number): number | null {
  let best: { edgeIndex: number; distance: number } | null = null
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const distance = pointToSegmentDistance(point, start, end)
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { edgeIndex: index, distance }
    }
  }
  return best?.edgeIndex ?? null
}

function collectSnapTargets(project: ProjectDocument): SnapTarget[] {
  const targets: SnapTarget[] = []
  for (const element of project.elements) {
    if (element.type === 'floor') {
      for (const [index, point] of element.polygon.entries()) targets.push({ id: `${element.id}-corner-${index}`, kind: 'corner', point, label: 'Floor corner' })
    }
    if (element.type === 'roof') {
      for (const [index, point] of element.footprint.entries()) targets.push({ id: `${element.id}-roof-${index}`, kind: 'corner', point, label: 'Roof corner' })
    }
    if (element.type === 'wall') {
      targets.push(
        { id: `${element.id}-start`, kind: 'endpoint', point: element.path[0], label: 'Wall endpoint' },
        { id: `${element.id}-end`, kind: 'endpoint', point: element.path[1], label: 'Wall endpoint' },
        { id: `${element.id}-mid`, kind: 'wall', point: { x: (element.path[0].x + element.path[1].x) / 2, y: (element.path[0].y + element.path[1].y) / 2 }, label: 'Wall midpoint' },
      )
    }
    if (element.type === 'opening') {
      const wall = project.elements.find((candidate): candidate is WallElement => candidate.type === 'wall' && candidate.id === element.hostWallId)
      if (wall) targets.push({ id: `${element.id}-center`, kind: 'opening', point: pointOnWall(wall, element.center), label: 'Opening center' })
    }
    if (element.type === 'pipe' || element.type === 'duct') {
      for (const [index, point] of element.path.entries()) targets.push({ id: `${element.id}-path-${index}`, kind: 'pathPoint', point, label: `${element.type} point` })
    }
  }
  for (const point of project.site.terrain.points) {
    targets.push({ id: point.id, kind: 'corner', point, label: 'Terrain point' })
  }
  return targets
}

function nearestSnapTarget(point: Point2, targets: SnapTarget[], maxDistance: number): SnapTarget | null {
  let best: { target: SnapTarget; distance: number } | null = null
  for (const target of targets) {
    const distance = distance2(point, target.point)
    if (distance <= maxDistance && (!best || distance < best.distance)) best = { target, distance }
  }
  return best?.target ?? null
}

function isTypingInField(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return Boolean(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function distanceToWall(point: Point2, wall: WallElement) {
  const start = wall.path[0]
  const end = wall.path[1]
  return pointToSegmentDistance(point, start, end)
}

function pointToSegmentDistance(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance2(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return distance2(point, { x: start.x + t * dx, y: start.y + t * dy })
}

function toolLabel(toolId: string, inProgress = false) {
  const labels: Record<string, string> = {
    drawFloor: inProgress ? 'Click opposite corner, Enter to commit, Esc to cancel' : 'Click first corner to start a raised floor',
    drawWall: inProgress ? 'Click wall endpoint, Enter to commit, Esc to cancel' : 'Click wall start point',
    placeOpening: 'Click near a wall to place an opening',
    drawRoof: inProgress ? 'Click opposite corner, Enter to commit, Esc to cancel' : 'Click first corner to start a roof footprint',
    attachAddition: 'Select a floor, roof, or wall, then click the exact edge to grow the addition from',
    splitFootprint: 'Select a floor or roof, then click an edge handle to insert a new corner there',
    deleteFootprintVertex: 'Select a floor or roof, then click a vertex handle to remove that corner',
    addTerrainPoint: 'Click to add a terrain height point',
    placeElectricalDevice: 'Click to place an electrical device',
    placePlumbingFixture: 'Click to place a plumbing fixture',
    drawPipe: 'Click points, Enter to finish pipe',
    drawDuct: 'Click points, Enter to finish duct',
  }
  return labels[toolId] ?? 'Select or drag handles'
}
