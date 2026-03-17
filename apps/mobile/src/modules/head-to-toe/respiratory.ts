import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'respiratory' as any,
  name: 'Respiratory Audio',
  description: 'Cough and breathing analysis',
  icon: 'Mic',
  duration: '1-2 min',
  color: 'bg-teal-500',
  group: 'head_to_toe',
  captureType: 'audio',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('respiratory' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
