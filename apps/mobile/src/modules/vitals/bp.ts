import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const def: ModuleDefinition = {
  type: 'bp' as any,
  name: 'Blood Pressure',
  description: 'Systolic/diastolic with pediatric classification',
  icon: 'Heart',
  duration: '2 min',
  color: 'bg-red-700',
  group: 'vitals',
  captureType: 'value',
  recommendedAge: ['school', 'adolescent'],
  chips: getChipsForModule('bp' as any),
}

registerModule(def)
export default def
