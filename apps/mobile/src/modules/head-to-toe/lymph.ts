import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'lymph' as any,
  name: 'Lymph Nodes',
  description: 'Cervical, axillary, inguinal',
  icon: 'Circle',
  duration: '2 min',
  color: 'bg-fuchsia-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('lymph' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
