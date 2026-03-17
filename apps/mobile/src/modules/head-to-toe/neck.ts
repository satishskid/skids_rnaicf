import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'neck' as any,
  name: 'Neck & Thyroid',
  description: 'Goiter, lymphadenopathy, swallowing',
  icon: 'Neck',
  duration: '2-3 min',
  color: 'bg-indigo-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('neck' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
