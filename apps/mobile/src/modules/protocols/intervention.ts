import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'intervention' as any,
  name: 'Interventions',
  description: 'Track supplementation, fortification, deworming, feeding programs',
  icon: 'Pill',
  duration: '2-3 min',
  color: 'bg-indigo-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('intervention' as any),
}

registerModule(def)
export default def
