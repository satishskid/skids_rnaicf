import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'nutrition_intake' as any,
  name: 'Nutrition Intake',
  description: 'School & home diet capture with regional food chips',
  icon: 'Apple',
  duration: '2-3 min',
  color: 'bg-green-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('nutrition_intake' as any),
}

registerModule(def)
export default def
