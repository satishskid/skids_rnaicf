import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'abdomen' as any,
  name: 'Abdomen',
  description: 'Distension, hernia, tenderness',
  icon: 'Abdomen',
  duration: '2-3 min',
  color: 'bg-violet-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('abdomen' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
