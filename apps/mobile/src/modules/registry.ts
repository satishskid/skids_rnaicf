/**
 * Module Registry — stores all registered module definitions.
 * Separated from index.ts to avoid circular imports.
 */

import type { ModuleType } from '../lib/types'
import type { ModuleDefinition } from './types'

const registry = new Map<string, ModuleDefinition>()

export function registerModule(def: ModuleDefinition) {
  registry.set(def.type, def)
}

export function getModule(type: ModuleType | string): ModuleDefinition | undefined {
  return registry.get(type)
}

export function getAllModules(): ModuleDefinition[] {
  return Array.from(registry.values())
}

export function getModulesForAge(ageGroup: string): ModuleDefinition[] {
  return getAllModules().filter(m => m.recommendedAge.includes(ageGroup as never))
}
