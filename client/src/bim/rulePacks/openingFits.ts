import { ProjectDocument, DerivedModel, RuleResult, OpeningElement } from '../types'
import { distance2 } from '../geometry'

export const openingFitsPack = {
  id: 'opening-fits',
  title: 'Opening Fit Checks',
  description: 'Ensure openings fit host walls and basic header planning checks.',
  validate: (project: ProjectDocument, derived: DerivedModel): RuleResult[] => {
    const results: RuleResult[] = []
    for (const element of project.elements) {
      if (element.type !== 'opening') continue
      const opening = element as OpeningElement
      const wall = project.elements.find((el): el is any => el.type === 'wall' && el.id === opening.hostWallId)
      const wallLength = wall ? distance2(wall.path[0], wall.path[1]) : 0
      results.push({
        id: `opening-fit-${opening.id}`,
        status: wall && opening.center - opening.width / 2 >= 0 && opening.center + opening.width / 2 <= wallLength ? 'pass' : 'fail',
        severity: wall && opening.center - opening.width / 2 >= 0 && opening.center + opening.width / 2 <= wallLength ? 'info' : 'error',
        elementId: opening.id,
        title: 'Opening fits host wall',
        message: wall ? 'Opening position is checked against the host wall.' : 'Opening host wall was not found.',
        suggestion: wall ? 'Keep rough opening inside the wall segment.' : 'Assign this opening to an existing wall.',
        highlightTarget: { elementId: opening.id, kind: 'element' },
        reference: { standard: 'IRC', section: 'Openings', url: 'https://www.iccsafe.org/' },
      })

      results.push({
        id: `opening-header-${opening.id}`,
        status: opening.width <= 5 || opening.headerSize !== '2x8' ? 'pass' : 'warning',
        severity: opening.width <= 5 || opening.headerSize !== '2x8' ? 'info' : 'warning',
        elementId: opening.id,
        title: 'Header planning',
        message: opening.width <= 5 ? 'Opening width is within the starter header rule range.' : 'Wide openings need header sizing by span/load table.',
        suggestion: opening.width <= 5 ? undefined : 'Use a table-based header selection or engineered header.',
        highlightTarget: { elementId: opening.id, kind: 'element' },
        reference: { standard: 'IRC', section: 'Headers', url: 'https://www.iccsafe.org/' },
      })
    }
    return results
  },
}

export default openingFitsPack
