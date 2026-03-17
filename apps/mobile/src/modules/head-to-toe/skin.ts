import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'
import { skinQualityGate } from '../../lib/ai/quality-gate'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'skin' as any,
  name: 'Skin & Wound',
  description: 'Skin condition and wound monitoring',
  icon: 'Scan',
  duration: '2-4 min',
  color: 'bg-orange-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('skin' as any),
  analysisType: 'skin',
  qualityGate: skinQualityGate,
}

registerModule(def)
export default def
