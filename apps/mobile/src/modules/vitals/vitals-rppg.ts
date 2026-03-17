import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'vitals' as any,
  name: 'Vitals Check',
  description: 'Heart rate via rPPG',
  icon: 'Heart',
  duration: '1-2 min',
  color: 'bg-red-500',
  group: 'vitals',
  captureType: 'video',
  cameraFacing: 'user',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('vitals' as any),
}

registerModule(def)
export default def
