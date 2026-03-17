import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'nails' as any,
  name: 'Nails',
  description: 'Clubbing, koilonychia, pallor',
  icon: 'Hand',
  duration: '1 min',
  color: 'bg-stone-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('nails' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
