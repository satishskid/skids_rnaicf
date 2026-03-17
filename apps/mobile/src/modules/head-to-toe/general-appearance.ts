import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'general_appearance' as any,
  name: 'General Appearance',
  description: 'Nutritional status, pallor, hydration',
  icon: 'UserCheck',
  duration: '1-2 min',
  color: 'bg-slate-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'user',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('general_appearance' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
