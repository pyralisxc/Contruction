import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, Line, OrbitControls, Text } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Quaternion, Vector3 } from 'three'
import { distance2, polygonBounds } from '../../bim/geometry'
import { FloorElement, FramingRenderable, HouseAccessoryElement, ProjectDocument, RoofPlaneDerived, TerrainContourDerived, TerrainMesh, ViewMode, WallElement } from '../../bim/types'
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
  const floors = project.elements.filter((element): element is FloorElement => element.type === 'floor')
  const walls = project.elements.filter((element): element is WallElement => element.type === 'wall')
  const accessories = project.elements.filter((element): element is HouseAccessoryElement => element.type === 'houseAccessory')

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
        <OrbitControls makeDefault enableDamping target={[focusX, 5, focusY]} />
        {visibleLayers.terrain && <TerrainSurface mesh={data.derived.terrainMesh} contours={data.derived.terrainContours} />}
        {visibleLayers.roof && <RoofPlanes planes={data.derived.roofPlanes} selectedId={selectedId} displayMode={modelDisplayMode} visibleLayers={visibleLayers} />}
        {visibleLayers.floors && floors.map((floor) => {
          const bounds = polygonBounds(floor.polygon)
          return (
            <mesh key={floor.id} position={[(bounds.minX + bounds.maxX) / 2, floor.elevation + 0.03, (bounds.minY + bounds.maxY) / 2]} onClick={() => onSelect(floor.id)}>
              <boxGeometry args={[bounds.maxX - bounds.minX, 0.08, bounds.maxY - bounds.minY]} />
              <meshStandardMaterial color={selectedId === floor.id ? '#bfdbfe' : floorColor(modelDisplayMode)} transparent opacity={modelDisplayMode === 'framing' ? 0.12 : modelDisplayMode === 'architectural' ? 0.55 : 0.92} />
            </mesh>
          )
        })}
        {visibleLayers.walls && walls.map((wall) => {
          const length = distance2(wall.path[0], wall.path[1])
          const midX = (wall.path[0].x + wall.path[1].x) / 2
          const midY = (wall.path[0].y + wall.path[1].y) / 2
          const angle = Math.atan2(wall.path[1].y - wall.path[0].y, wall.path[1].x - wall.path[0].x)
          const elevation = project.levels.find((level) => level.id === wall.levelId)?.elevation ?? 0
          return (
            <mesh key={wall.id} position={[midX, elevation + wall.height / 2, midY]} rotation={[0, -angle, 0]} onClick={() => onSelect(wall.id)}>
              <boxGeometry args={[length, wall.height, wall.exterior ? 0.5 : 0.35]} />
              <meshStandardMaterial color={selectedId === wall.id ? '#fca5a5' : wallColor(modelDisplayMode, wall.exterior)} transparent opacity={modelDisplayMode === 'framing' ? 0.08 : modelDisplayMode === 'architectural' ? 0.5 : 0.88} />
            </mesh>
          )
        })}
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
