import React from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, Line, OrbitControls, Text, Html } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, DoubleSide, ExtrudeGeometry, Matrix4, Quaternion, Shape, ShapeGeometry, Vector3, Raycaster, Plane, Vector2 } from 'three'
import { polygonBounds } from '../../bim/geometry'
import { FloorElement, FramingRenderable, HouseAccessoryElement, ProjectDocument, RoofPlaneDerived, TerrainContourDerived, TerrainMesh, ViewMode, WallSolidDerived, DerivedFace } from '../../bim/types'
import { EditorDerivedData } from '../selectors'
import { ViewportPanelMode } from '../types'
import useBimProjectStore from '../../stores/bimProjectStore'

export function FramingViewport({
  project,
  data,
  viewMode,
  selectedId,
  onSelect,
  panelMode,
}: {
  project: ProjectDocument
  data: EditorDerivedData
  viewMode: ViewMode
  selectedId: string | null
  onSelect: (id: string) => void
  panelMode: ViewportPanelMode
}) {
  const [webglAvailable, setWebglAvailable] = React.useState(true)
  const visibleLayers = useBimProjectStore((state) => state.visibleLayers)
  const modelDisplayMode = useBimProjectStore((state) => state.modelDisplayMode)
  const extrudeFace = useBimProjectStore((state) => state.extrudeFace)
  const moveElement = useBimProjectStore((state) => state.moveElement)
  const floors = project.elements.filter((element): element is FloorElement => element.type === 'floor')
  const accessories = project.elements.filter((element): element is HouseAccessoryElement => element.type === 'houseAccessory')
  const [reducedMotion, setReducedMotion] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReducedMotion(Boolean(mq.matches))
    handler()
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  // Keyboard nudges for selected element (arrow keys)
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      let step = 0.25
      if (e.shiftKey) step = 0.05
      if (e.ctrlKey || e.metaKey) step = 1.0
      const delta = { x: 0, y: 0, z: 0 }
      if (e.key === 'ArrowLeft') delta.x = -step
      if (e.key === 'ArrowRight') delta.x = step
      if (e.key === 'ArrowUp') delta.y = step
      if (e.key === 'ArrowDown') delta.y = -step
      try { moveElement(selectedId, delta) } catch (err) { /* ignore */ }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, moveElement])

  function FaceGizmos({ faces }: { faces: DerivedFace[] }) {
    const { camera, gl } = useThree()
    const setElementPreview = useBimProjectStore((s) => s.setElementPreview)
    const extrudeFaceStore = useBimProjectStore((s) => s.extrudeFace)
    const moveElement = useBimProjectStore((s) => s.moveElement)
    const projectRef = React.useRef(project)
    React.useEffect(() => { projectRef.current = project }, [project])
    const dragRef = React.useRef<any>(null)
    const ray = React.useMemo(() => new Raycaster(), [])
    const [activeDrag, setActiveDrag] = React.useState<{ elementId: string; faceId: string; distance: number } | null>(null)
    const [hoveredFaceId, setHoveredFaceId] = React.useState<string | null>(null)
    const [typedValue, setTypedValue] = React.useState('')
    const typedValueRef = React.useRef<string>('')
    React.useEffect(() => { typedValueRef.current = typedValue }, [typedValue])

    React.useEffect(() => {
      return () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [])

    function toNDC(clientX: number, clientY: number) {
      const rect = gl.domElement.getBoundingClientRect()
      return new Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    }

    function closestParamsBetweenLineAndRay(p: Vector3, u: Vector3, q: Vector3, v: Vector3) {
      // returns s such that point on line p + s*u is closest to ray q + t*v
      const w0 = p.clone().sub(q)
      const a = u.dot(u)
      const b = u.dot(v)
      const c = v.dot(v)
      const d = u.dot(w0)
      const e = v.dot(w0)
      const denom = a * c - b * b
      if (Math.abs(denom) < 1e-6) return 0
      const s = (b * e - c * d) / denom
      return s
    }

    function applyTranslationPreview(el: any, deltaProj: { x: number; y: number; z?: number }) {
      if (!el) return
      if (el.type === 'floor') return { polygon: el.polygon.map((pt: any) => ({ x: pt.x + deltaProj.x, y: pt.y + deltaProj.y })) }
      if (el.type === 'roof') return { footprint: el.footprint.map((pt: any) => ({ x: pt.x + deltaProj.x, y: pt.y + deltaProj.y })) }
      if (el.type === 'wall') return { path: [ { x: el.path[0].x + deltaProj.x, y: el.path[0].y + deltaProj.y }, { x: el.path[1].x + deltaProj.x, y: el.path[1].y + deltaProj.y } ] }
      if (el.type === 'stair') return { position: { x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y } }
      if (el.type === 'houseAccessory') return { position: { ...el.position, x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y, z: el.position.z + (deltaProj.z ?? 0) } }
      if (el.type === 'electricalDevice' || el.type === 'plumbingFixture') return { position: { ...el.position, x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y, z: el.position.z + (deltaProj.z ?? 0) } }
      if (el.type === 'pipe' || el.type === 'duct') return { path: el.path.map((point: any) => ({ ...point, x: point.x + deltaProj.x, y: point.y + deltaProj.y, z: point.z + (deltaProj.z ?? 0) })) }
      if (el.type === 'beam') return { start: { x: el.start.x + deltaProj.x, y: el.start.y + deltaProj.y }, end: { x: el.end.x + deltaProj.x, y: el.end.y + deltaProj.y } }
      if (el.type === 'pier') return { x: el.x + deltaProj.x, y: el.y + deltaProj.y }
      return null
    }

    function onMove(ev: PointerEvent) {
      if (!dragRef.current) return
      const typed = typedValueRef.current
      // Axis-constrained drag
      if (dragRef.current.axis) {
        if (typed !== '') {
          const n = Number(typed)
          if (Number.isFinite(n)) {
            const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
            const deltaProj = { x: dragRef.current.axisProject.x * n, y: dragRef.current.axisProject.y * n, z: dragRef.current.axisProject.z * (n || 0) }
            const updates = applyTranslationPreview(el, deltaProj)
            if (updates) setElementPreview(el.id, updates as any)
            setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: n })
            return
          }
        }
        const ndc = toNDC(ev.clientX, ev.clientY)
        ray.setFromCamera(ndc, camera)
        const p = dragRef.current.faceCenter
        const u = dragRef.current.axis
        const q = ray.ray.origin
        const v = ray.ray.direction
        const s = closestParamsBetweenLineAndRay(p, u, q, v)
        const delta = s - dragRef.current.axisStart
        let snapped = delta
        if (ev.shiftKey) snapped = Math.round(delta / 0.05) * 0.05
        else if (ev.ctrlKey || ev.metaKey) snapped = Math.round(delta / 1.0) * 1.0
        const deltaProj = { x: dragRef.current.axisProject.x * snapped, y: dragRef.current.axisProject.y * snapped, z: dragRef.current.axisProject.z * snapped }
        const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
        const updates = applyTranslationPreview(el, deltaProj)
        if (el && updates) setElementPreview(el.id, updates as any)
        setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: snapped })
        return
      }

      // Normal (face-normal) drag
      if (typed !== '') {
        const n = Number(typed)
        if (Number.isFinite(n)) {
          const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
          if (el) {
            if (el.type === 'floor') setElementPreview(el.id, { elevation: dragRef.current.baseValue + n })
            if (el.type === 'wall') setElementPreview(el.id, { height: Math.max(0.5, dragRef.current.baseValue + n) })
          }
          setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: n })
          return
        }
      }
      const ndc = toNDC(ev.clientX, ev.clientY)
      ray.setFromCamera(ndc, camera)
      const point = new Vector3()
      if (!ray.ray.intersectPlane(dragRef.current.plane, point)) return
      const newProj = point.clone().sub(dragRef.current.faceCenter).dot(dragRef.current.normal)
      const delta = newProj - dragRef.current.startProj
      let snapped = delta
      if (ev.shiftKey) snapped = Math.round(delta / 0.05) * 0.05
      else if (ev.ctrlKey || ev.metaKey) snapped = Math.round(delta / 1.0) * 1.0
      const newValue = dragRef.current.baseValue + snapped
      const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
      if (el) {
        if (el.type === 'floor') setElementPreview(el.id, { elevation: newValue })
        if (el.type === 'wall') setElementPreview(el.id, { height: Math.max(0.5, newValue) })
      }
      setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: snapped })
    }

    function onUp(ev?: PointerEvent) {
      if (!dragRef.current) return
      const info = dragRef.current
      if (info.axis) {
        // Commit translation
        const final = activeDrag ? activeDrag.distance : 0
        const deltaProj = { x: info.axisProject.x * final, y: info.axisProject.y * final, z: info.axisProject.z * final }
        moveElement(info.elementId, { x: deltaProj.x, y: deltaProj.y, z: deltaProj.z })
      } else {
        const final = activeDrag ? activeDrag.distance : 0
        extrudeFaceStore(info.elementId, info.face.id, final)
      }
      // cleanup
      dragRef.current = null
      setActiveDrag(null)
      setTypedValue('')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (!dragRef.current) return
      if (ev.key === 'Escape') {
        const info = dragRef.current
        const el = projectRef.current.elements.find((e) => e.id === info.elementId)
        if (el) {
          if (info.axis) {
            // revert to base snapshot
            if (info.baseSnapshot) setElementPreview(info.elementId, info.baseSnapshot)
          } else {
            if (el.type === 'floor') setElementPreview(el.id, { elevation: info.baseValue })
            if (el.type === 'wall') setElementPreview(el.id, { height: info.baseValue })
          }
        }
        dragRef.current = null
        setActiveDrag(null)
        setTypedValue('')
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('keydown', onKeyDown)
      }
    }

    function startDrag(e: any, face: DerivedFace) {
      e.stopPropagation()
      const ndc = toNDC(e.clientX, e.clientY)
      ray.setFromCamera(ndc, camera)
      const normalThree = new Vector3(face.normal.x, face.normal.z, face.normal.y).normalize()
      const faceCenter = new Vector3(face.center.x, face.center.z, face.center.y)
      const plane = new Plane(normalThree, -normalThree.dot(faceCenter))
      const intersect = new Vector3()
      if (!ray.ray.intersectPlane(plane, intersect)) return
      const el = projectRef.current.elements.find((it) => it.id === face.sourceElementId)
      let baseValue = 0
      if (el) {
        if (el.type === 'floor') baseValue = el.elevation ?? 0
        else if (el.type === 'wall') baseValue = el.height ?? 9
      }
      const startProj = intersect.clone().sub(faceCenter).dot(normalThree)
      dragRef.current = { face, faceCenter, normal: normalThree, plane, startProj, baseValue, elementId: face.sourceElementId }
      setTypedValue('')
      setActiveDrag({ elementId: face.sourceElementId, faceId: face.id, distance: 0 })
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    }

    function startAxisDrag(e: any, face: DerivedFace, axisLocal: Vector3) {
      e.stopPropagation()
      const ndc = toNDC(e.clientX, e.clientY)
      ray.setFromCamera(ndc, camera)
      const normalThree = new Vector3(face.normal.x, face.normal.z, face.normal.y).normalize()
      const faceCenter = new Vector3(face.center.x, face.center.z, face.center.y)
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normalThree)
      const axisWorld = axisLocal.clone().applyQuaternion(q).normalize()
      // project axis world into project-space (x, y, z -> x, z, y)
      const axisProject = { x: axisWorld.x, y: axisWorld.z, z: axisWorld.y }
      // compute start param along axis line closest to camera ray
      const p = faceCenter
      const u = axisWorld
      const qv = ray.ray.origin
      const v = ray.ray.direction
      const startParam = closestParamsBetweenLineAndRay(p, u, qv, v)
      const el = projectRef.current.elements.find((it) => it.id === face.sourceElementId)
      const baseSnapshot = el ? JSON.parse(JSON.stringify(el)) : null
      dragRef.current = { face, faceCenter, axis: axisWorld, axisProject, axisStart: startParam, baseSnapshot, baseValue: 0, elementId: face.sourceElementId }
      setTypedValue('')
      setActiveDrag({ elementId: face.sourceElementId, faceId: face.id, distance: 0 })
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    }

    return (
      <>
        {faces.map((face) => {
          const pos: [number, number, number] = [face.center.x, face.center.z + 0.06, face.center.y]
          const normalThree = new Vector3(face.normal.x, face.normal.z, face.normal.y).normalize()
          const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normalThree)
          const geo = React.useMemo(() => {
            const pts = face.polygon
            const positions = new Float32Array(pts.length * 3)
            for (let i = 0; i < pts.length; i += 1) {
              positions[i * 3 + 0] = pts[i].x
              positions[i * 3 + 1] = pts[i].z + 0.001
              positions[i * 3 + 2] = pts[i].y
            }
            const indices: number[] = []
            for (let i = 1; i < pts.length - 1; i += 1) indices.push(0, i, i + 1)
            const g = new BufferGeometry()
            g.setAttribute('position', new BufferAttribute(positions, 3))
            if (indices.length > 0) g.setIndex(indices)
            g.computeVertexNormals()
            return g
          }, [face.polygon])
          const isHovered = hoveredFaceId === face.id
          return (
            <group key={face.id} position={pos} quaternion={q} onPointerOver={(e) => { e.stopPropagation(); setHoveredFaceId(face.id) }} onPointerOut={(e) => { e.stopPropagation(); setHoveredFaceId((id) => id === face.id ? null : id) }}>
              {/* Normal handles (push/pull) */}
              <group onPointerDown={(e) => startDrag(e.nativeEvent, face)}>
                <mesh position={[0, 0.25, 0]} scale={isHovered ? [1.12, 1.12, 1.12] : [1, 1, 1]}> 
                  <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
                  <meshStandardMaterial color="#2563eb" />
                </mesh>
                <mesh position={[0, 0.7, 0]} scale={isHovered ? [1.12, 1.12, 1.12] : [1, 1, 1]}> 
                  <coneGeometry args={[0.07, 0.2, 12]} />
                  <meshStandardMaterial color="#1d4ed8" />
                </mesh>
                {/* larger invisible hit area */}
                <mesh position={[0, 0.45, 0]} onPointerDown={(e) => startDrag(e.nativeEvent, face)}>
                  <cylinderGeometry args={[0.12, 0.12, 1.1, 8]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </group>
              <group onPointerDown={(e) => startDrag(e.nativeEvent, face)}>
                <mesh position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]} scale={isHovered ? [1.12, 1.12, 1.12] : [1, 1, 1]}> 
                  <cylinderGeometry args={[0.035, 0.035, 0.5, 10]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]} scale={isHovered ? [1.12, 1.12, 1.12] : [1, 1, 1]}> 
                  <coneGeometry args={[0.06, 0.18, 12]} />
                  <meshStandardMaterial color="#dc2626" />
                </mesh>
                <mesh position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]} onPointerDown={(e) => startDrag(e.nativeEvent, face)}>
                  <cylinderGeometry args={[0.10, 0.10, 0.9, 8]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              </group>

              {/* Axis handles: local X and local Z (tangents of the face) */}
              <group onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(1, 0, 0))}>
                <mesh position={[0.5, 0, 0]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <boxGeometry args={[0.14, 0.06, 0.06]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0.85, 0, 0]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <coneGeometry args={[0.06, 0.12, 8]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0.65, 0, 0]} onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(1, 0, 0))}>
                  <boxGeometry args={[0.36, 0.24, 0.24]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[1.02, 0.02, 0]} fontSize={0.12} color="#ef4444" anchorX="center" anchorY="middle">X</Text>
              </group>
              <group onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(-1, 0, 0))}>
                <mesh position={[-0.5, 0, 0]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <boxGeometry args={[0.14, 0.06, 0.06]} />
                  <meshStandardMaterial color="#b91c1c" />
                </mesh>
                <mesh position={[-0.85, 0, 0]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <coneGeometry args={[0.06, 0.12, 8]} />
                  <meshStandardMaterial color="#b91c1c" />
                </mesh>
                <mesh position={[-0.65, 0, 0]} onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(-1, 0, 0))}>
                  <boxGeometry args={[0.36, 0.24, 0.24]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[-1.02, 0.02, 0]} fontSize={0.12} color="#b91c1c" anchorX="center" anchorY="middle">-X</Text>
              </group>

              <group onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(0, 0, 1))}>
                <mesh position={[0, 0, 0.5]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <boxGeometry args={[0.06, 0.06, 0.14]} />
                  <meshStandardMaterial color="#16a34a" />
                </mesh>
                <mesh position={[0, 0, 0.85]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <coneGeometry args={[0.06, 0.12, 8]} />
                  <meshStandardMaterial color="#16a34a" />
                </mesh>
                <mesh position={[0, 0, 0.65]} onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(0, 0, 1))}>
                  <boxGeometry args={[0.24, 0.24, 0.36]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[0, 0.02, 1.02]} fontSize={0.12} color="#16a34a" anchorX="center" anchorY="middle">Z</Text>
              </group>
              <group onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(0, 0, -1))}>
                <mesh position={[0, 0, -0.5]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <boxGeometry args={[0.06, 0.06, 0.14]} />
                  <meshStandardMaterial color="#047857" />
                </mesh>
                <mesh position={[0, 0, -0.85]} scale={isHovered ? [1.08, 1.08, 1.08] : [1, 1, 1]}> 
                  <coneGeometry args={[0.06, 0.12, 8]} />
                  <meshStandardMaterial color="#047857" />
                </mesh>
                <mesh position={[0, 0, -0.65]} onPointerDown={(e) => startAxisDrag(e.nativeEvent, face, new Vector3(0, 0, -1))}>
                  <boxGeometry args={[0.24, 0.24, 0.36]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
                <Text position={[0, 0.02, -1.02]} fontSize={0.12} color="#047857" anchorX="center" anchorY="middle">-Z</Text>
              </group>

              {hoveredFaceId === face.id && !activeDrag && (
                <>
                  <mesh geometry={geo} position={[0, 0, 0]}>
                    <meshStandardMaterial color="#6366f1" transparent opacity={0.12} side={DoubleSide} />
                  </mesh>
                  <Html position={[0, 0.95, 0]} center transform occlude>
                    <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(15,23,42,0.9)', color: '#fff', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{face.id}</div>
                      <div style={{ opacity: 0.9 }}>Drag handles to move. Shift: fine (0.05), Ctrl: coarse (1.0)</div>
                    </div>
                  </Html>
                </>
              )}
              {activeDrag && activeDrag.faceId === face.id && (
                <Html center transform occlude>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={typedValue}
                      placeholder="ft"
                      onChange={(ev) => {
                        setTypedValue(ev.target.value)
                        const n = Number(ev.target.value)
                        if (Number.isFinite(n) && dragRef.current) {
                          if (dragRef.current.axis) {
                            const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
                            const deltaProj = { x: dragRef.current.axisProject.x * n, y: dragRef.current.axisProject.y * n, z: dragRef.current.axisProject.z * n }
                            const updates = applyTranslationPreview(el, deltaProj)
                            if (updates) setElementPreview(el.id, updates as any)
                            setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: n })
                          } else {
                            const el = projectRef.current.elements.find((e) => e.id === dragRef.current.elementId)
                            if (el) {
                              if (el.type === 'floor') setElementPreview(el.id, { elevation: dragRef.current.baseValue + n })
                              if (el.type === 'wall') setElementPreview(el.id, { height: Math.max(0.5, dragRef.current.baseValue + n) })
                            }
                            setActiveDrag({ elementId: dragRef.current.elementId, faceId: dragRef.current.face.id, distance: n })
                          }
                        }
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' && dragRef.current) {
                          const n = Number(typedValue)
                          if (Number.isFinite(n)) {
                            if (dragRef.current.axis) {
                              const deltaProj = { x: dragRef.current.axisProject.x * n, y: dragRef.current.axisProject.y * n, z: dragRef.current.axisProject.z * n }
                              moveElement(dragRef.current.elementId, { x: deltaProj.x, y: deltaProj.y, z: deltaProj.z })
                            } else {
                              extrudeFaceStore(dragRef.current.elementId, dragRef.current.face.id, n)
                            }
                            dragRef.current = null
                            setActiveDrag(null)
                            setTypedValue('')
                            window.removeEventListener('pointermove', onMove)
                            window.removeEventListener('pointerup', onUp)
                            window.removeEventListener('keydown', onKeyDown)
                          }
                        }
                        if (ev.key === 'Escape' && dragRef.current) {
                          const info = dragRef.current
                          const el = projectRef.current.elements.find((e) => e.id === info.elementId)
                          if (el) {
                            if (info.axis && info.baseSnapshot) setElementPreview(info.elementId, info.baseSnapshot)
                            if (!info.axis) {
                              if (el.type === 'floor') setElementPreview(el.id, { elevation: info.baseValue })
                              if (el.type === 'wall') setElementPreview(el.id, { height: info.baseValue })
                            }
                          }
                          dragRef.current = null
                          setActiveDrag(null)
                          setTypedValue('')
                          window.removeEventListener('pointermove', onMove)
                          window.removeEventListener('pointerup', onUp)
                          window.removeEventListener('keydown', onKeyDown)
                        }
                      }}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.9)', color: '#fff', width: 96 }}
                    />
                  </div>
                </Html>
              )}
            </group>
          )
        })}
      </>
    )
  }

  function TransformControls({ selectedId, faces }: { selectedId: string; faces: DerivedFace[] }) {
    const { camera, gl } = useThree()
    const setElementPreview = useBimProjectStore((s) => s.setElementPreview)
    const updateElement = useBimProjectStore((s) => s.updateElement)
    const projectRef = React.useRef(project)
    React.useEffect(() => { projectRef.current = project }, [project])
    const ray = React.useMemo(() => new Raycaster(), [])
    const dragRef = React.useRef<any>(null)
    const [actionType, setActionType] = React.useState<'translate' | 'rotate' | 'scale' | null>(null)
    const [typedValue, setTypedValue] = React.useState('')
    const typedValueRef = React.useRef('')
    React.useEffect(() => { typedValueRef.current = typedValue }, [typedValue])

    React.useEffect(() => {
      return () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [])

    function toNDC(clientX: number, clientY: number) {
      const rect = gl.domElement.getBoundingClientRect()
      return new Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    }

    function rotatePointAround(cx: number, cy: number, angle: number, pt: { x: number; y: number }) {
      const dx = pt.x - cx
      const dy = pt.y - cy
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      return { x: cx + cos * dx - sin * dy, y: cy + sin * dx + cos * dy }
    }

    function applyTranslationPreview(el: any, deltaProj: { x: number; y: number; z?: number }) {
      if (!el) return null
      if (el.type === 'floor') return { polygon: el.polygon.map((pt: any) => ({ x: pt.x + deltaProj.x, y: pt.y + deltaProj.y })) }
      if (el.type === 'roof') return { footprint: el.footprint.map((pt: any) => ({ x: pt.x + deltaProj.x, y: pt.y + deltaProj.y })) }
      if (el.type === 'wall') return { path: [ { x: el.path[0].x + deltaProj.x, y: el.path[0].y + deltaProj.y }, { x: el.path[1].x + deltaProj.x, y: el.path[1].y + deltaProj.y } ] }
      if (el.type === 'stair') return { position: { x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y } }
      if (el.type === 'houseAccessory') return { position: { ...el.position, x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y, z: el.position.z + (deltaProj.z ?? 0) } }
      if (el.type === 'electricalDevice' || el.type === 'plumbingFixture') return { position: { ...el.position, x: el.position.x + deltaProj.x, y: el.position.y + deltaProj.y, z: el.position.z + (deltaProj.z ?? 0) } }
      if (el.type === 'pipe' || el.type === 'duct') return { path: el.path.map((point: any) => ({ ...point, x: point.x + deltaProj.x, y: point.y + deltaProj.y, z: point.z + (deltaProj.z ?? 0) })) }
      if (el.type === 'beam') return { start: { x: el.start.x + deltaProj.x, y: el.start.y + deltaProj.y }, end: { x: el.end.x + deltaProj.x, y: el.end.y + deltaProj.y } }
      if (el.type === 'pier') return { x: el.x + deltaProj.x, y: el.y + deltaProj.y }
      return null
    }

    function applyRotationPreview(el: any, centerX: number, centerY: number, angleRad: number) {
      if (!el) return null
      if (el.type === 'floor') return { polygon: el.polygon.map((pt: any) => rotatePointAround(centerX, centerY, angleRad, pt)) }
      if (el.type === 'roof') return { footprint: el.footprint.map((pt: any) => rotatePointAround(centerX, centerY, angleRad, pt)) }
      if (el.type === 'wall') return { path: el.path.map((pt: any) => rotatePointAround(centerX, centerY, angleRad, pt) ).slice(0,2) }
      if (el.type === 'stair') return { position: rotatePointAround(centerX, centerY, angleRad, el.position) }
      if (el.type === 'houseAccessory') return { position: { ...el.position, x: rotatePointAround(centerX, centerY, angleRad, { x: el.position.x, y: el.position.y }).x, y: rotatePointAround(centerX, centerY, angleRad, { x: el.position.x, y: el.position.y }).y } }
      if (el.type === 'electricalDevice' || el.type === 'plumbingFixture') return { position: rotatePointAround(centerX, centerY, angleRad, el.position) }
      if (el.type === 'pipe' || el.type === 'duct') return { path: el.path.map((p: any) => rotatePointAround(centerX, centerY, angleRad, p)) }
      if (el.type === 'beam') return { start: rotatePointAround(centerX, centerY, angleRad, el.start), end: rotatePointAround(centerX, centerY, angleRad, el.end) }
      if (el.type === 'pier') return { x: rotatePointAround(centerX, centerY, angleRad, { x: el.x, y: el.y }).x, y: rotatePointAround(centerX, centerY, angleRad, { x: el.x, y: el.y }).y }
      return null
    }

    function applyScalePreview(el: any, centerX: number, centerY: number, factor: number) {
      if (!el) return null
      function scalePt(pt: any) { return { x: centerX + (pt.x - centerX) * factor, y: centerY + (pt.y - centerY) * factor } }
      if (el.type === 'floor') return { polygon: el.polygon.map(scalePt) }
      if (el.type === 'roof') return { footprint: el.footprint.map(scalePt) }
      if (el.type === 'wall') return { path: el.path.map(scalePt).slice(0,2) }
      if (el.type === 'stair') return { position: scalePt(el.position) }
      if (el.type === 'houseAccessory') return { position: { ...el.position, x: scalePt(el.position).x, y: scalePt(el.position).y } }
      if (el.type === 'electricalDevice' || el.type === 'plumbingFixture') return { position: scalePt(el.position) }
      if (el.type === 'pipe' || el.type === 'duct') return { path: el.path.map(scalePt) }
      if (el.type === 'beam') return { start: scalePt(el.start), end: scalePt(el.end) }
      if (el.type === 'pier') return { x: centerX + (el.x - centerX) * factor, y: centerY + (el.y - centerY) * factor }
      return null
    }

    function closestParamsBetweenLineAndRay(p: Vector3, u: Vector3, q: Vector3, v: Vector3) {
      const w0 = p.clone().sub(q)
      const a = u.dot(u)
      const b = u.dot(v)
      const c = v.dot(v)
      const d = u.dot(w0)
      const e = v.dot(w0)
      const denom = a * c - b * b
      if (Math.abs(denom) < 1e-6) return 0
      const s = (b * e - c * d) / denom
      return s
    }

    function onMove(ev: PointerEvent) {
      if (!dragRef.current) return
      const info = dragRef.current
      if (info.type === 'translate') {
        const typed = typedValueRef.current
        if (typed !== '') {
          const n = Number(typed)
          if (Number.isFinite(n)) {
            const el = projectRef.current.elements.find((e) => e.id === info.elementId)
            const deltaProj = { x: info.axisProject.x * n, y: info.axisProject.y * n, z: info.axisProject.z * n }
            const updates = applyTranslationPreview(el, deltaProj)
            if (updates) setElementPreview(el.id, updates as any)
            return
          }
        }
        const ndc = toNDC(ev.clientX, ev.clientY)
        ray.setFromCamera(ndc, camera)
        const p = info.anchor
        const u = info.axis
        const q = ray.ray.origin
        const v = ray.ray.direction
        const s = closestParamsBetweenLineAndRay(p, u, q, v)
        const delta = s - info.start
        let snapped = delta
        if (ev.shiftKey) snapped = Math.round(delta / 0.05) * 0.05
        else if (ev.ctrlKey || ev.metaKey) snapped = Math.round(delta / 1.0) * 1.0
        const deltaProj = { x: info.axisProject.x * snapped, y: info.axisProject.y * snapped, z: info.axisProject.z * snapped }
        const el = projectRef.current.elements.find((e) => e.id === info.elementId)
        const updates = applyTranslationPreview(el, deltaProj)
        if (updates) setElementPreview(el.id, updates as any)
        return
      }
      if (info.type === 'rotate') {
        const typed = typedValueRef.current
        const centerX = info.centerX
        const centerY = info.centerY
        if (typed !== '') {
          const deg = Number(typed)
          if (Number.isFinite(deg)) {
            const rad = deg * Math.PI / 180
            const el = projectRef.current.elements.find((e) => e.id === info.elementId)
            const updates = applyRotationPreview(el, centerX, centerY, rad)
            if (updates) setElementPreview(el.id, updates as any)
            return
          }
        }
        const ndc = toNDC(ev.clientX, ev.clientY)
        ray.setFromCamera(ndc, camera)
        const plane = new Plane(new Vector3(0, 1, 0), -info.anchor.y)
        const intersect = new Vector3()
        if (!ray.ray.intersectPlane(plane, intersect)) return
        const angle = Math.atan2(intersect.z - info.anchor.z, intersect.x - info.anchor.x)
        let delta = angle - info.startAngle
        // normalize to -PI..PI
        while (delta > Math.PI) delta -= Math.PI * 2
        while (delta < -Math.PI) delta += Math.PI * 2
        if (ev.shiftKey) delta = Math.round(delta * (180/Math.PI) / 5) * (5 * Math.PI / 180)
        else if (ev.ctrlKey || ev.metaKey) delta = Math.round(delta * (180/Math.PI) / 15) * (15 * Math.PI / 180)
        const el = projectRef.current.elements.find((e) => e.id === info.elementId)
        const updates = applyRotationPreview(el, centerX, centerY, delta)
        if (updates) setElementPreview(el.id, updates as any)
        return
      }
      if (info.type === 'scale') {
        const typed = typedValueRef.current
        const centerX = info.centerX
        const centerY = info.centerY
        if (typed !== '') {
          const f = Number(typed)
          if (Number.isFinite(f) && f > 0) {
            const el = projectRef.current.elements.find((e) => e.id === info.elementId)
            const updates = applyScalePreview(el, centerX, centerY, f)
            if (updates) setElementPreview(el.id, updates as any)
            return
          }
        }
        const ndc = toNDC(ev.clientX, ev.clientY)
        ray.setFromCamera(ndc, camera)
        const plane = new Plane(new Vector3(0, 1, 0), -info.anchor.y)
        const intersect = new Vector3()
        if (!ray.ray.intersectPlane(plane, intersect)) return
        const startDist = info.startDist
        const curDist = Math.hypot(intersect.x - info.anchor.x, intersect.z - info.anchor.z)
        let factor = curDist / startDist
        if (ev.shiftKey) factor = Math.round(factor * 100) / 100
        else if (ev.ctrlKey || ev.metaKey) factor = Math.round(factor * 20) / 20
        const el = projectRef.current.elements.find((e) => e.id === info.elementId)
        const updates = applyScalePreview(el, info.centerX, info.centerY, factor)
        if (updates) setElementPreview(el.id, updates as any)
        return
      }
    }

    function onUp(_ev?: PointerEvent) {
      if (!dragRef.current) return
      const info = dragRef.current
      const el = projectRef.current.elements.find((e) => e.id === info.elementId)
      if (!el) return
      if (info.type === 'translate') {
        const nd = typedValueRef.current
        if (nd !== '') {
          const n = Number(nd)
          if (Number.isFinite(n)) {
            const updates = applyTranslationPreview(el, { x: info.axisProject.x * n, y: info.axisProject.y * n, z: info.axisProject.z * n })
            if (updates) updateElement(info.elementId, updates)
          }
        } else {
          const final = info.lastPreviewDistance ?? 0
          const updates = applyTranslationPreview(el, { x: info.axisProject.x * final, y: info.axisProject.y * final, z: info.axisProject.z * final })
          if (updates) updateElement(info.elementId, updates)
        }
      } else if (info.type === 'rotate') {
        const nd = typedValueRef.current
        const centerX = info.centerX
        const centerY = info.centerY
        if (nd !== '') {
          const deg = Number(nd)
          if (Number.isFinite(deg)) {
            const rad = deg * Math.PI / 180
            const updates = applyRotationPreview(el, centerX, centerY, rad)
            if (updates) updateElement(info.elementId, updates)
          }
        } else {
          const delta = info.lastPreviewAngle ?? 0
          const updates = applyRotationPreview(el, centerX, centerY, delta)
          if (updates) updateElement(info.elementId, updates)
        }
      } else if (info.type === 'scale') {
        const nd = typedValueRef.current
        const centerX = info.centerX
        const centerY = info.centerY
        if (nd !== '') {
          const f = Number(nd)
          if (Number.isFinite(f)) {
            const updates = applyScalePreview(el, centerX, centerY, f)
            if (updates) updateElement(info.elementId, updates)
          }
        } else {
          const factor = info.lastPreviewFactor ?? 1
          const updates = applyScalePreview(el, centerX, centerY, factor)
          if (updates) updateElement(info.elementId, updates)
        }
      }
      dragRef.current = null
      setActionType(null)
      setTypedValue('')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (!dragRef.current) return
      if (ev.key === 'Escape') {
        const info = dragRef.current
        const el = projectRef.current.elements.find((e) => e.id === info.elementId)
        if (el && info.baseSnapshot) setElementPreview(info.elementId, info.baseSnapshot)
        dragRef.current = null
        setActionType(null)
        setTypedValue('')
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('keydown', onKeyDown)
      }
    }

    function startTranslate(e: any, axisWorld: Vector3) {
      e.stopPropagation()
      const ndc = toNDC(e.clientX, e.clientY)
      ray.setFromCamera(ndc, camera)
      const face = faces.find((f) => f.sourceElementId === selectedId)
      if (!face) return
      const anchor = new Vector3(face.center.x, face.center.z, face.center.y)
      const p = anchor
      const u = axisWorld.clone().normalize()
      const q = ray.ray.origin
      const v = ray.ray.direction
      const start = closestParamsBetweenLineAndRay(p, u, q, v)
      const axisProject = { x: u.x, y: u.z, z: u.y }
      const el = projectRef.current.elements.find((it) => it.id === selectedId)
      const baseSnapshot = el ? JSON.parse(JSON.stringify(el)) : null
      dragRef.current = { type: 'translate', elementId: selectedId, axis: u, axisProject, anchor: p, start, baseSnapshot }
      setActionType('translate')
      setTypedValue('')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    }

    function startRotate(e: any) {
      e.stopPropagation()
      const ndc = toNDC(e.clientX, e.clientY)
      ray.setFromCamera(ndc, camera)
      const face = faces.find((f) => f.sourceElementId === selectedId)
      if (!face) return
      const anchor = new Vector3(face.center.x, face.center.z, face.center.y)
      const plane = new Plane(new Vector3(0, 1, 0), -anchor.y)
      const intersect = new Vector3()
      if (!ray.ray.intersectPlane(plane, intersect)) return
      const startAngle = Math.atan2(intersect.z - anchor.z, intersect.x - anchor.x)
      const el = projectRef.current.elements.find((it) => it.id === selectedId)
      const baseSnapshot = el ? JSON.parse(JSON.stringify(el)) : null
      dragRef.current = { type: 'rotate', elementId: selectedId, anchor, startAngle, centerX: face.center.x, centerY: face.center.y, baseSnapshot }
      setActionType('rotate')
      setTypedValue('')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    }

    function startScale(e: any) {
      e.stopPropagation()
      const ndc = toNDC(e.clientX, e.clientY)
      ray.setFromCamera(ndc, camera)
      const face = faces.find((f) => f.sourceElementId === selectedId)
      if (!face) return
      const anchor = new Vector3(face.center.x, face.center.z, face.center.y)
      const plane = new Plane(new Vector3(0, 1, 0), -anchor.y)
      const intersect = new Vector3()
      if (!ray.ray.intersectPlane(plane, intersect)) return
      const startDist = Math.hypot(intersect.x - anchor.x, intersect.z - anchor.z)
      const el = projectRef.current.elements.find((it) => it.id === selectedId)
      const baseSnapshot = el ? JSON.parse(JSON.stringify(el)) : null
      dragRef.current = { type: 'scale', elementId: selectedId, anchor, startDist, centerX: face.center.x, centerY: face.center.y, baseSnapshot }
      setActionType('scale')
      setTypedValue('')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('keydown', onKeyDown)
    }

    const faceForAnchor = faces.find((f) => f.sourceElementId === selectedId)
    if (!faceForAnchor) return null
    const anchorPos: [number, number, number] = [faceForAnchor.center.x, faceForAnchor.center.z + 0.06, faceForAnchor.center.y]

    return (
      <group position={anchorPos}>
        {/* Translate handles */}
        <group onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(1, 0, 0))}>
          <mesh position={[1.2, 0, 0]} scale={actionType === 'translate' ? [1.06, 1.06, 1.06] : [1, 1, 1] }>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 10]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[1.2, 0, 0]} onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(1, 0, 0))}>
            <cylinderGeometry args={[0.38, 0.38, 1.6, 8]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <Text position={[1.6, 0.02, 0]} fontSize={0.12} color="#ef4444" anchorX="center" anchorY="middle">X</Text>
        </group>
        <group onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(0, 0, 1))}>
          <mesh position={[0, 0, 1.2]} scale={actionType === 'translate' ? [1.06, 1.06, 1.06] : [1, 1, 1] }>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 10]} rotation={[0, Math.PI/2, 0]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
          <mesh position={[0, 0, 1.2]} onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(0, 0, 1))}>
            <cylinderGeometry args={[0.38, 0.38, 1.6, 8]} rotation={[0, Math.PI/2, 0]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <Text position={[0, 0.02, 1.6]} fontSize={0.12} color="#16a34a" anchorX="center" anchorY="middle">Z</Text>
        </group>
        <group onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(0, 1, 0))}>
          <mesh position={[0, 1.2, 0]} scale={actionType === 'translate' ? [1.06, 1.06, 1.06] : [1, 1, 1] }>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 10]} rotation={[Math.PI/2, 0, 0]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
          <mesh position={[0, 1.2, 0]} onPointerDown={(e) => startTranslate(e.nativeEvent, new Vector3(0, 1, 0))}>
            <cylinderGeometry args={[0.38, 0.38, 1.6, 8]} rotation={[Math.PI/2, 0, 0]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <Text position={[0, 1.6, 0]} fontSize={0.12} color="#2563eb" anchorX="center" anchorY="middle">Y</Text>
        </group>

        {/* Rotation ring (Y axis) */}
        <group onPointerDown={(e) => startRotate(e.nativeEvent)}>
          <mesh>
            <torusGeometry args={[1.6, actionType === 'rotate' ? 0.04 : 0.02, 8, 64]} rotation={[Math.PI/2, 0, 0]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          <Text position={[0, 0.02, -1.8]} fontSize={0.12} color="#f59e0b" anchorX="center" anchorY="middle">Rotate</Text>
        </group>

        {/* Scale handle */}
        <group onPointerDown={(e) => startScale(e.nativeEvent)}>
          <mesh position={[1.6, 0, 0]}> 
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#7c3aed" />
          </mesh>
          <mesh position={[1.6, 0, 0]} onPointerDown={(e) => startScale(e.nativeEvent)}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <Text position={[1.95, 0.02, 0]} fontSize={0.12} color="#7c3aed" anchorX="center" anchorY="middle">Scale</Text>
        </group>

        {actionType && (
          <Html center transform occlude>
            <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
              <input
                autoFocus
                value={typedValue}
                placeholder={actionType === 'rotate' ? 'deg' : actionType === 'scale' ? '1.0' : 'ft'}
                onChange={(ev) => setTypedValue(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && dragRef.current) {
                    onUp()
                  }
                  if (ev.key === 'Escape') {
                    onKeyDown(ev as unknown as KeyboardEvent)
                  }
                }}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.9)', color: '#fff', width: 120, marginBottom: 6 }}
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                Enter: commit • Esc: cancel • Shift: fine • Ctrl: coarse
              </div>
            </div>
          </Html>
        )}
      </group>
    )
  }

  React.useEffect(() => {
    const canvas = document.createElement('canvas')
    setWebglAvailable(Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl')))
  }, [])

  if (panelMode === 'diagram' || !webglAvailable) {
    return (
      <div className="framing-diagram-panel">
        <FramingFallback project={project} data={data} />
      </div>
    )
  }

  const focusBounds = floors[0] ? polygonBounds(floors[0].polygon) : { minX: 0, maxX: 28, minY: 0, maxY: 20 }
  const focusX = (focusBounds.minX + focusBounds.maxX) / 2
  const focusY = (focusBounds.minY + focusBounds.maxY) / 2
  const focusSize = Math.max(focusBounds.maxX - focusBounds.minX, focusBounds.maxY - focusBounds.minY, 20)
  const cameraDistance = Math.max(focusSize * 1.75, 42)

  return (
    <div className="framing-viewport">
      <Canvas camera={{ position: [focusX + cameraDistance, cameraDistance * 0.62, focusY + cameraDistance], fov: 36 }} shadows>
        <color attach="background" args={['#eef2f7']} />
        <ambientLight intensity={0.74} />
        <directionalLight position={[20, 34, 12]} intensity={1.15} castShadow />
        <Grid args={[90, 90]} cellSize={1} sectionSize={10} cellColor="#cbd5e1" sectionColor="#94a3b8" position={[0, -0.02, 0]} />
        <OrbitControls makeDefault enableDamping={!reducedMotion} target={[focusX, 5, focusY]} />
        {visibleLayers.terrain && <TerrainSurface mesh={data.derived.terrainMesh} contours={data.derived.terrainContours} />}
        {visibleLayers.roof && <RoofPlanes planes={data.derived.roofPlanes} selectedId={selectedId} displayMode={modelDisplayMode} visibleLayers={visibleLayers} />}
        {visibleLayers.floors && floors.map((floor) => (
          <FloorMesh key={floor.id} floor={floor} selected={selectedId === floor.id} displayMode={modelDisplayMode} onSelect={onSelect} />
        ))}
        {visibleLayers.walls && data.derived.wallSolids.map((wall) => (
          <WallSolidMesh key={wall.id} wall={wall} selected={selectedId === wall.sourceElementId} displayMode={modelDisplayMode} onSelect={onSelect} />
        ))}
        {selectedId && data.derived.derivedFaces && (
          <>
            <FaceGizmos faces={data.derived.derivedFaces.filter((f) => f.sourceElementId === selectedId)} />
            <ElementTransformControls selectedId={selectedId} faces={data.derived.derivedFaces} />
          </>
        )}
        {visibleLayers.framing && (modelDisplayMode === 'framing' || viewMode === 'code') &&
          data.derived.framingRenderables.filter((item) => isRenderableLayerVisible(item, visibleLayers)).map((item) => (
            <FramingMemberMesh key={item.id} item={item} selected={selectedId === item.sourceElementId} onSelect={onSelect} />
          ))}
        {visibleLayers.foundation && visibleLayers.framing && (modelDisplayMode === 'framing' || viewMode === 'code') &&
          data.derived.pierBlocks.map((block) => (
            <mesh key={block.id} position={[block.center.x, block.center.z, block.center.y]} onClick={() => onSelect(block.sourceElementId)} castShadow receiveShadow>
              <boxGeometry args={[block.width, block.height, block.depth]} />
              <meshStandardMaterial color={selectedId === block.sourceElementId ? '#bfdbfe' : '#94a3b8'} />
            </mesh>
          ))}
        {visibleLayers.floors && accessories.map((accessory) => <AccessoryMesh key={accessory.id} accessory={accessory} selected={selectedId === accessory.id} onSelect={onSelect} />)}
        {visibleLayers.dimensions && (modelDisplayMode === 'framing' || viewMode === 'code') &&
          data.derived.bearingPoints.map((point) => (
            <mesh key={point.id} position={[point.position.x, point.position.z + 0.08, point.position.y]} onClick={() => onSelect(point.sourceElementId)}>
              <sphereGeometry args={[0.14, 12, 12]} />
              <meshStandardMaterial color={point.status === 'resolved' ? '#16a34a' : '#f59e0b'} />
            </mesh>
          ))}
        {visibleLayers.warnings && data.derived.unresolvedIntersections.map((item) => (
          <mesh key={item.id} position={[item.at.x, item.at.z + 0.2, item.at.y]} onClick={() => onSelect(item.sourceElementId)}>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        ))}
      </Canvas>
    </div>
  )
}

function FloorMesh({
  floor,
  selected,
  displayMode,
  onSelect,
}: {
  floor: FloorElement
  selected: boolean
  displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']
  onSelect: (id: string) => void
}) {
  const geometry = React.useMemo(() => {
    const shape = new Shape()
    floor.polygon.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y)
      else shape.lineTo(point.x, point.y)
    })
    shape.closePath()
    const next = new ShapeGeometry(shape)
    next.rotateX(Math.PI / 2)
    next.translate(0, floor.elevation + 0.03, 0)
    return next
  }, [floor.elevation, floor.polygon])

  return (
    <mesh geometry={geometry} onClick={() => onSelect(floor.id)} receiveShadow>
      <meshStandardMaterial color={selected ? '#bfdbfe' : floorColor(displayMode)} side={DoubleSide} transparent opacity={displayMode === 'framing' ? 0.12 : displayMode === 'architectural' ? 0.55 : 0.92} />
    </mesh>
  )
}

function WallSolidMesh({
  wall,
  selected,
  displayMode,
  onSelect,
}: {
  wall: WallSolidDerived
  selected: boolean
  displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']
  onSelect: (id: string) => void
}) {
  const geometry = React.useMemo(() => wallSolidGeometry(wall), [wall])
  const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x)
  return (
    <mesh
      geometry={geometry}
      position={[wall.center.x, wall.center.z, wall.center.y]}
      rotation={[0, -angle, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(wall.sourceElementId)
      }}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={selected ? '#fca5a5' : wallColor(displayMode, wall.layerBands.some((layer) => layer.side === 'exterior'))}
        side={DoubleSide}
        transparent
        opacity={displayMode === 'framing' ? 0.08 : displayMode === 'architectural' ? 0.5 : 0.88}
      />
    </mesh>
  )
}

function wallSolidGeometry(wall: WallSolidDerived): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.lineTo(wall.length, 0)
  shape.lineTo(wall.length, wall.height)
  shape.lineTo(0, wall.height)
  shape.closePath()
  for (const opening of wall.openingVoids) {
    const hole = new Shape()
    hole.moveTo(opening.startOffset, opening.sillHeight)
    hole.lineTo(opening.endOffset, opening.sillHeight)
    hole.lineTo(opening.endOffset, opening.headHeight)
    hole.lineTo(opening.startOffset, opening.headHeight)
    hole.closePath()
    shape.holes.push(hole)
  }
  const geometry = new ExtrudeGeometry(shape, {
    depth: wall.thickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  geometry.translate(-wall.length / 2, -wall.height / 2, -wall.thickness / 2)
  return geometry
}

function AccessoryMesh({ accessory, selected, onSelect }: { accessory: HouseAccessoryElement; selected: boolean; onSelect: (id: string) => void }) {
  const color = accessory.accessoryKind === 'column' ? '#7f5539' : accessory.accessoryKind === 'guardRail' ? '#0f766e' : '#94a3b8'
  return (
    <mesh position={[accessory.position.x, accessory.position.z + accessory.height / 2, accessory.position.y]} onClick={() => onSelect(accessory.id)} castShadow receiveShadow>
      <boxGeometry args={[accessory.width, Math.max(0.08, accessory.height), accessory.depth]} />
      <meshStandardMaterial color={selected ? '#2563eb' : color} transparent opacity={accessory.accessoryKind === 'guardRail' ? 0.82 : 1} />
    </mesh>
  )
}

function isRenderableLayerVisible(item: FramingRenderable, visibleLayers: ReturnType<typeof useBimProjectStore.getState>['visibleLayers']) {
  if (item.subsystem === 'floor') return visibleLayers.floorFraming
  if (item.subsystem === 'wall') return visibleLayers.wallFraming
  if (item.subsystem === 'roof') return visibleLayers.roofFraming
  if (item.subsystem === 'pier') return visibleLayers.foundation
  return true
}

function FramingMemberMesh({ item, selected, onSelect }: { item: FramingRenderable; selected: boolean; onSelect: (id: string) => void }) {
  const quaternion = React.useMemo(() => memberQuaternionFromAxes(item), [item])
  const geometry = React.useMemo(() => cutAwareMemberGeometry(item), [item])
  const width = item.crossSection.width
  const depth = item.crossSection.depth
  return (
    <group
      position={[item.center.x, item.center.z, item.center.y]}
      quaternion={quaternion}
    >
      <mesh
      onClick={(event) => {
        event.stopPropagation()
        onSelect(item.sourceElementId)
      }}
      castShadow
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={selected ? '#2563eb' : item.color} />
    </mesh>
    <CutMarkers width={width} depth={depth} length={item.length} item={item} />
    {selected && <StockLengthLabel item={item} depth={depth} />}
    </group>
  )
}

function StockLengthLabel({ item, depth }: { item: FramingRenderable; depth: number }) {
  const cutLength = item.cutLength ?? item.length
  const stockLength = item.stockLength ?? Math.ceil(cutLength / 2) * 2
  return (
    <Text
      position={[0, 0, depth / 2 + 0.18]}
      rotation={[Math.PI / 2, 0, 0]}
      fontSize={0.34}
      color="#0f172a"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.018}
      outlineColor="#f8fafc"
    >
      {`${item.size ?? 'member'}  cut ${formatFeetInches(cutLength)}  stock ${formatFeetInches(stockLength)}`}
    </Text>
  )
}

function cutAwareMemberGeometry(item: FramingRenderable): BufferGeometry {
  const width = item.crossSection.width
  const depth = item.crossSection.depth
  const length = item.length
  const startCut = cutSkew(item.endCuts?.start.kind, depth)
  const endCut = cutSkew(item.endCuts?.end.kind, depth)
  const yStartBottom = -length / 2
  const yStartTop = -length / 2 + startCut
  const yEndBottom = length / 2
  const yEndTop = length / 2 - endCut
  const x0 = -width / 2
  const x1 = width / 2
  const z0 = -depth / 2
  const z1 = depth / 2
  const vertices = new Float32Array([
    x0, yStartBottom, z0,
    x1, yStartBottom, z0,
    x1, yStartTop, z1,
    x0, yStartTop, z1,
    x0, yEndBottom, z0,
    x1, yEndBottom, z0,
    x1, yEndTop, z1,
    x0, yEndTop, z1,
  ])
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    1, 5, 6, 1, 6, 2,
    0, 3, 7, 0, 7, 4,
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function cutSkew(kind: string | undefined, depth: number): number {
  if (kind === 'plumb' || kind === 'seat' || kind === 'birdsmouth' || kind === 'miter') return Math.min(depth * 0.65, 0.42)
  return 0
}

function formatFeetInches(value: number): string {
  const feet = Math.floor(value)
  const inches = Math.round((value - feet) * 12)
  if (inches === 12) return `${feet + 1}'-0"`
  return `${feet}'-${inches}"`
}

function memberQuaternionFromAxes(item: FramingRenderable): Quaternion {
  const xAxis = toThreeAxis(item.widthAxis)
  const yAxis = toThreeAxis(item.lengthAxis)
  const desiredDepth = toThreeAxis(item.depthAxis)
  let zAxis = new Vector3().crossVectors(xAxis, yAxis).normalize()
  if (zAxis.dot(desiredDepth) < 0) {
    xAxis.multiplyScalar(-1)
    zAxis = new Vector3().crossVectors(xAxis, yAxis).normalize()
  }
  const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
  return new Quaternion().setFromRotationMatrix(matrix)
}

function toThreeAxis(axis: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(axis.x, axis.z, axis.y).normalize()
}

function CutMarkers({ width, depth, length, item }: { width: number; depth: number; length: number; item: FramingRenderable }) {
  const y0 = -length / 2 - 0.003
  const y1 = length / 2 + 0.003
  const top = depth / 2 + 0.006
  const startSkew = cutSkew(item.endCuts?.start.kind, depth)
  const endSkew = cutSkew(item.endCuts?.end.kind, depth)
  return (
    <>
      <Line points={[[-width / 2, y0 + startSkew, top], [width / 2, y0 + startSkew, top]]} color="#f8fafc" lineWidth={1.1} />
      <Line points={[[-width / 2, y1 - endSkew, top], [width / 2, y1 - endSkew, top]]} color="#f8fafc" lineWidth={1.1} />
    </>
  )
}

function TerrainSurface({ mesh, contours }: { mesh: TerrainMesh; contours: TerrainContourDerived[] }) {
  const geometry = React.useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.vertices.flatMap((point) => [point.x, point.z - 0.36, point.y])), 3))
    geometry.setIndex(mesh.triangles.flatMap((triangle) => triangle))
    geometry.computeVertexNormals()
    return geometry
  }, [mesh])

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#cfe7bf" roughness={0.92} metalness={0} side={DoubleSide} transparent opacity={0.82} />
      </mesh>
      {contours.map((contour) => (
        <Line
          key={contour.id}
          points={contour.points.map((point) => [point.x, point.z + 0.03, point.y])}
          color={contour.elevation % 2 === 0 ? '#6b7280' : '#94a3b8'}
          lineWidth={1.4}
        />
      ))}
    </>
  )
}

function RoofPlanes({ planes, selectedId, displayMode, visibleLayers }: { planes: RoofPlaneDerived[]; selectedId: string | null; displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']; visibleLayers: ReturnType<typeof useBimProjectStore.getState>['visibleLayers'] }) {
  return (
    <>
      {planes.map((plane) => (
        <RoofPlaneMesh key={plane.id} plane={plane} selected={selectedId === plane.sourceElementId} displayMode={displayMode} visibleLayers={visibleLayers} />
      ))}
    </>
  )
}

function RoofPlaneMesh({ plane, selected, displayMode, visibleLayers }: { plane: RoofPlaneDerived; selected: boolean; displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']; visibleLayers: ReturnType<typeof useBimProjectStore.getState>['visibleLayers'] }) {
  const geometry = React.useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(plane.polygon.flatMap((point) => [point.x, point.z + 0.02, point.y])), 3))
    geometry.setIndex(plane.polygon.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3])
    geometry.computeVertexNormals()
    return geometry
  }, [plane])
  if (plane.kind === 'gable' && !visibleLayers.siding) return null
  if (plane.kind !== 'gable' && !visibleLayers.roofing && displayMode === 'painted') return null
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={selected ? '#fde68a' : roofPlaneColor(plane, displayMode)} side={DoubleSide} transparent opacity={displayMode === 'framing' ? 0.18 : displayMode === 'architectural' ? 0.38 : 0.92} />
    </mesh>
  )
}

function floorColor(displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']) {
  if (displayMode === 'painted') return '#b9854f'
  if (displayMode === 'architectural') return '#d8b47a'
  return '#d8b47a'
}

function wallColor(displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode'], exterior: boolean) {
  if (displayMode === 'painted') return exterior ? '#d7d1c2' : '#f8fafc'
  if (displayMode === 'architectural') return exterior ? '#cbd5e1' : '#e5e7eb'
  return '#cbd5e1'
}

function roofPlaneColor(plane: RoofPlaneDerived, displayMode: ReturnType<typeof useBimProjectStore.getState>['modelDisplayMode']) {
  if (plane.kind === 'gable') return displayMode === 'painted' ? '#d7d1c2' : '#d1d5db'
  if (displayMode === 'painted') return '#5f6f7f'
  return '#f3d19c'
}

function FramingFallback({ project, data }: { project: ProjectDocument; data: EditorDerivedData }) {
  const floor = project.elements.find((element): element is FloorElement => element.type === 'floor')
  if (!floor) return null
  const allPoints = data.derived.framing.flatMap((item) => [item.start, item.end])
  const minX = Math.min(...allPoints.map((point) => point.x), 0)
  const maxX = Math.max(...allPoints.map((point) => point.x), 28)
  const minZ = Math.min(...allPoints.map((point) => point.z), -1)
  const maxZ = Math.max(...allPoints.map((point) => point.z), 16)
  const scaleX = 620 / Math.max(maxX - minX, 1)
  const scaleZ = 160 / Math.max(maxZ - minZ, 1)
  const toDiagram = (point: { x: number; z: number }) => ({
    x: 48 + (point.x - minX) * scaleX,
    y: 182 - (point.z - minZ) * scaleZ,
  })
  const projected = data.derived.framing.filter((member) => member.subsystem !== 'mep')
  const contours = data.derived.terrainContours.slice(0, 8)

  return (
    <div className="framing-fallback" aria-label="Model-derived framing elevation diagram">
      <svg viewBox="0 0 720 210">
        <rect x="0" y="0" width="720" height="210" fill="#f8fafc" />
        {contours.map((contour) => {
          const points = contour.points.map((point) => `${toDiagram(point).x},${toDiagram(point).y}`).join(' ')
          return <polyline key={contour.id} points={points} fill="none" stroke="#cbd5e1" strokeWidth="1" />
        })}
        {project.site.boundary.slice(0, 2).map((point, index) => {
          const start = toDiagram({ x: point.x, z: project.site.terrain.baseElevation - 0.2 })
          const end = toDiagram({ x: project.site.boundary[index + 1]?.x ?? point.x, z: project.site.terrain.baseElevation - 0.2 })
          return <line key={`${point.x}-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#94a3b8" strokeWidth="2" />
        })}
        {projected.map((member) => {
          const start = toDiagram(member.start)
          const end = toDiagram(member.end)
          return (
            <line
              key={member.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={member.subsystem === 'roof' ? '#92400e' : member.subsystem === 'pier' ? '#7f5539' : member.subsystem === 'floor' ? '#a16207' : '#8b5a2b'}
              strokeWidth={member.visualRole === 'beam' || member.visualRole === 'post' ? 3 : 1.5}
              opacity={member.role.includes('engineering') ? 0.25 : 0.78}
            />
          )
        })}
        <text x="500" y="28">model-derived framing elevation</text>
        <text x="500" y="46">{projected.length} derived members</text>
        <text x="500" y="64">{data.derived.pierBlocks.length} pier blocks</text>
      </svg>
    </div>
  )
}
