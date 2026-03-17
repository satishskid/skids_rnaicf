import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const def: ModuleDefinition = {
  type: 'muac' as any,
  name: 'MUAC',
  description: 'Mid-Upper Arm Circumference (wasting indicator)',
  icon: 'Ruler',
  duration: '1 min',
  color: 'bg-amber-600',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: ['infant', 'toddler', 'preschool'],
  chips: getChipsForModule('muac' as any),
}

registerModule(def)
export default def
