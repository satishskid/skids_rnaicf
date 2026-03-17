import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'hemoglobin' as any,
  name: 'Hemoglobin',
  description: 'WHO anemia classification',
  icon: 'Droplet',
  duration: '1 min',
  color: 'bg-rose-600',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('hemoglobin' as any),
}

registerModule(def)
export default def
