import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'hair' as any,
  name: 'Hair & Scalp',
  description: 'Pediculosis, dandruff, alopecia, tinea',
  icon: 'Sparkles',
  duration: '1-2 min',
  color: 'bg-amber-600',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('hair' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
