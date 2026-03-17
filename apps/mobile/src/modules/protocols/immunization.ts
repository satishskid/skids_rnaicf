import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'immunization' as any,
  name: 'Immunization Status',
  description: 'Vaccine schedule tracking and compliance',
  icon: 'Shield',
  duration: '2-3 min',
  color: 'bg-blue-700',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('immunization' as any),
}

registerModule(def)
export default def
