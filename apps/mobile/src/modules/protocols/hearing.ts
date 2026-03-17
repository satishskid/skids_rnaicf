import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'hearing' as any,
  name: 'Hearing Screening',
  description: 'Picture-based audiometry — child taps matching image',
  icon: 'Headphones',
  duration: '5-8 min',
  color: 'bg-purple-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('hearing' as any),
}

registerModule(def)
export default def
