import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'spo2' as any,
  name: 'SpO2',
  description: 'Oxygen saturation level',
  icon: 'Droplet',
  duration: '1 min',
  color: 'bg-red-600',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('spo2' as any),
}

registerModule(def)
export default def
