import type { BuildRequirementProvider } from '../../build/src/index'

export interface CapabilityDefinition {
  id: string
  version: string
  name: string
  description: string
  entityKinds: string[]
  buildRequirementProviders?: BuildRequirementProvider[]
}

export interface CapabilitySummary {
  id: string
  version: string
  name: string
  description: string
  entityKinds: string[]
  buildRequirementProviderCount: number
}

export class CapabilityRegistry {
  #capabilities = new Map<string, CapabilityDefinition>()

  register(capability: CapabilityDefinition): void {
    if (this.#capabilities.has(capability.id)) {
      throw new Error(`Capability already registered: ${capability.id}`)
    }
    this.#capabilities.set(capability.id, capability)
  }

  get(id: string): CapabilityDefinition | undefined {
    return this.#capabilities.get(id)
  }

  list(): CapabilitySummary[] {
    return [...this.#capabilities.values()]
      .map((capability) => ({
        id: capability.id,
        version: capability.version,
        name: capability.name,
        description: capability.description,
        entityKinds: [...capability.entityKinds],
        buildRequirementProviderCount: capability.buildRequirementProviders?.length ?? 0,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  buildRequirementProviders(): BuildRequirementProvider[] {
    return [...this.#capabilities.values()]
      .flatMap((capability) => capability.buildRequirementProviders ?? [])
  }
}
