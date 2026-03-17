import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'throat' as any,
  name: 'Throat Examination',
  description: 'Tonsils, pharynx, uvula',
  icon: 'Throat',
  duration: '1-2 min',
  color: 'bg-teal-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('throat' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
