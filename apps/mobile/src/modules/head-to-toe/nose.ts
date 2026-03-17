import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'nose' as any,
  name: 'Nose Examination',
  description: 'Septum, discharge, turbinates',
  icon: 'Nose',
  duration: '1 min',
  color: 'bg-lime-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('nose' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
