import type * as z from 'zod/v4'

import { requirementSignature, type SupplyObservation } from '../../../packages/supply/src/index'
import {
  createId,
  previewTransaction,
  type WorldTransaction,
} from '../../../packages/world/src/index'
import type { ProjectRuntimeManager } from './projectRuntime'
import type { supplyObservationInputSchema } from './contracts'

export function normalizeSupplyObservation(
  projects: ProjectRuntimeManager,
  projectId: string,
  input: z.infer<typeof supplyObservationInputSchema>,
): SupplyObservation {
  const requirement = input.requirementId
    ? projects.buildGraph(projectId).requirements.find(
        (candidate) => candidate.id === input.requirementId,
      )
    : undefined

  if (input.requirementId && !requirement) {
    throw new Error(`Unknown Build requirement: ${input.requirementId}`)
  }

  return {
    ...input,
    id: input.id ?? createId('supply-observation'),
    observedAt: input.observedAt ?? new Date().toISOString(),
    requirementSignature: requirement ? requirementSignature(requirement) : undefined,
    specification: input.specification ?? requirement?.specification,
    name: input.name ?? requirement?.name,
  }
}

export function proposalView(
  projects: ProjectRuntimeManager,
  projectId: string,
  proposal: WorldTransaction,
) {
  try {
    const preview = previewTransaction(
      projects.runtime(projectId).store.snapshot(),
      proposal,
    )
    return {
      status: 'ready' as const,
      proposal,
      diff: preview.diff,
    }
  } catch (error) {
    return {
      status: 'stale-or-invalid' as const,
      proposal,
      error: error instanceof Error ? error.message : 'Proposal is no longer valid',
    }
  }
}

export function proposalViews(
  projects: ProjectRuntimeManager,
  projectId: string,
) {
  return projects.runtime(projectId).proposalStore.list().map(
    (proposal) => proposalView(projects, projectId, proposal),
  )
}
