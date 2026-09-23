import type { Port } from './types'

export type PortDirection = 'in' | 'out' | 'bidirectional' | 'unknown'

export interface PortCompatibility {
  compatible: boolean
  domain: string
  sourceDirection: PortDirection
  targetDirection: PortDirection
  reason?: string
}

export function portDomain(kind: string): string {
  return kind.trim().split('.')[0] || 'unknown'
}

export function portDirection(kind: string): PortDirection {
  const parts = kind.trim().split('.')
  if (parts.includes('bidirectional')) return 'bidirectional'
  if (parts.includes('out')) return 'out'
  if (parts.includes('in')) return 'in'
  return 'unknown'
}

export function checkPortCompatibility(source: Port, target: Port): PortCompatibility {
  const domain = portDomain(source.kind)
  const targetDomain = portDomain(target.kind)
  const sourceDirection = portDirection(source.kind)
  const targetDirection = portDirection(target.kind)

  if (domain !== targetDomain) {
    return {
      compatible: false,
      domain,
      sourceDirection,
      targetDirection,
      reason: `Port domains differ: ${domain} -> ${targetDomain}`,
    }
  }

  if (sourceDirection !== 'out' && sourceDirection !== 'bidirectional') {
    return {
      compatible: false,
      domain,
      sourceDirection,
      targetDirection,
      reason: `Source port is not an output: ${source.kind}`,
    }
  }

  if (targetDirection !== 'in' && targetDirection !== 'bidirectional') {
    return {
      compatible: false,
      domain,
      sourceDirection,
      targetDirection,
      reason: `Target port is not an input: ${target.kind}`,
    }
  }

  return {
    compatible: true,
    domain,
    sourceDirection,
    targetDirection,
  }
}

export function defaultConnectionKind(source: Port): string {
  return `${portDomain(source.kind)}.connects`
}
