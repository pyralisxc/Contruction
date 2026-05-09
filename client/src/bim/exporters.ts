import { ProjectDocument, TakeoffSummary } from './types'

export function projectToJson(project: ProjectDocument): string {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2)
}

export function takeoffToCsv(takeoff: TakeoffSummary, project: ProjectDocument): string {
  const header = ['Subsystem', 'Phase', 'Location', 'Material', 'Description', 'Quantity', 'Unit', 'Waste Factor']
  const rows = takeoff.lines.map((line) => [
    line.subsystem,
    line.phase,
    line.location,
    project.materials[line.materialId]?.name ?? line.materialId,
    line.description,
    line.quantity.toFixed(2),
    line.unit,
    `${Math.round(line.wasteFactor * 100)}%`,
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(','))
    .join('\n')
}

export function blueprintHtml(project: ProjectDocument, takeoff: TakeoffSummary): string {
  const warnings = takeoff.estimatedCost.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${project.name} Blueprint Package</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td, th { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
    .sheet { page-break-after: always; }
    .note { color: #6b7280; font-size: 12px; max-width: 760px; }
  </style>
</head>
<body>
  <section class="sheet">
    <h1>${project.name}</h1>
    <p class="note">Permit-supporting concept package generated from BIM-lite model. Final approval remains with the local AHJ and licensed professionals for engineered conditions.</p>
    <h2>Project Data</h2>
    <table>
      <tr><th>Jurisdiction Profile</th><td>${project.jurisdiction.profile}</td></tr>
      <tr><th>Edition</th><td>${project.jurisdiction.edition}</td></tr>
      <tr><th>Levels</th><td>${project.levels.length}</td></tr>
      <tr><th>Elements</th><td>${project.elements.length}</td></tr>
      <tr><th>Estimated Materials</th><td>${warnings}</td></tr>
    </table>
  </section>
  <section class="sheet">
    <h2>Material Schedule</h2>
    <table>
      <tr><th>Subsystem</th><th>Location</th><th>Description</th><th>Qty</th><th>Unit</th></tr>
      ${takeoff.lines.map((line) => `<tr><td>${line.subsystem}</td><td>${line.location}</td><td>${line.description}</td><td>${line.quantity.toFixed(2)}</td><td>${line.unit}</td></tr>`).join('')}
    </table>
  </section>
</body>
</html>`
}
