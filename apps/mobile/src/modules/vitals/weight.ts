import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'weight' as any,
  name: 'Weight',
  description: 'Weight-for-age WHO Z-score',
  icon: 'Scale',
  duration: '1 min',
  color: 'bg-green-600',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('weight' as any),
}

registerModule(def)
export default def
