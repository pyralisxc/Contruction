import React from 'react'
import { TopBar } from './TopBar'
import { ModeRail } from './ModeRail'
import { StatusBar } from './StatusBar'
import { ToolPanel } from '../tools/ToolPanel'
import { Inspector } from '../inspector/Inspector'
import { CanvasWorkspace } from '../canvas/CanvasWorkspace'
import useBimProjectStore from '../../stores/bimProjectStore'
import { buildEditorData } from '../selectors'
import { openBlueprintPackage, readProjectFile, saveProjectJson, saveTakeoffCsv } from '../projectIO'

export function EditorShell() {
  const project = useBimProjectStore((state) => state.project)
  const selectedId = useBimProjectStore((state) => state.selectedId)
  const selectElement = useBimProjectStore((state) => state.selectElement)
  const loadProject = useBimProjectStore((state) => state.loadProject)
  const snapFeet = useBimProjectStore((state) => state.snapFeet)
  const data = React.useMemo(() => buildEditorData(project, selectedId), [project, selectedId])
  const [railCollapsed, setRailCollapsed] = React.useState(false)

  const handleLoad = React.useCallback(
    (file: File) => {
      readProjectFile(file)
        .then(loadProject)
        .catch((error: Error) => window.alert(error.message))
    },
    [loadProject],
  )

  return (
    <div className={`contractor-app ${railCollapsed ? 'rail-collapsed' : ''}`}>
      <TopBar
        project={project}
        onSave={() => saveProjectJson(project)}
        onLoad={handleLoad}
        onExportCsv={() => saveTakeoffCsv(project, data.takeoff)}
        onBlueprint={() => openBlueprintPackage(project, data.takeoff)}
      />
      <div className="workspace">
        <ModeRail collapsed={railCollapsed} onToggleCollapse={() => setRailCollapsed((v) => !v)} />
        <ToolPanel project={project} data={data} onSelectViolation={(id) => id && selectElement(id)} />
        <CanvasWorkspace project={project} data={data} onSelect={selectElement} />
        <Inspector project={project} data={data} />
      </div>
      <StatusBar selectedId={selectedId} rules={data.rules} estimate={data.takeoff.estimatedCost} snapFeet={snapFeet} />
    </div>
  )
}

