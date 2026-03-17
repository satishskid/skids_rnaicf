import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'height' as any,
  name: 'Height',
  description: 'Height-for-age WHO Z-score',
  icon: 'Ruler',
  duration: '1 min',
  color: 'bg-blue-600',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('height' as any),
}

registerModule(def)
export default def
