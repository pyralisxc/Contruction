import { blueprintHtml, projectToJson, takeoffToCsv } from '../bim/exporters'
import { ProjectDocument, TakeoffSummary } from '../bim/types'

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function readProjectFile(file: File): Promise<ProjectDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as ProjectDocument)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not parse project file'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read project file'))
    reader.readAsText(file)
  })
}

export function safeProjectSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contractor-hub-project'
}

export function saveProjectJson(project: ProjectDocument) {
  downloadText(`${safeProjectSlug(project.name)}.json`, projectToJson(project), 'application/json')
}

export function saveTakeoffCsv(project: ProjectDocument, takeoff: TakeoffSummary) {
  downloadText(`${safeProjectSlug(project.name)}-bom.csv`, takeoffToCsv(takeoff, project), 'text/csv')
}

export function openBlueprintPackage(project: ProjectDocument, takeoff: TakeoffSummary) {
  const popup = window.open('', '_blank')
  if (!popup) return
  popup.document.write(blueprintHtml(project, takeoff))
  popup.document.close()
  popup.focus()
}

