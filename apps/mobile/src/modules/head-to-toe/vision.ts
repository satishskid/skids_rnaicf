import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'
import { visionQualityGate } from '../../lib/ai/quality-gate'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'vision' as any,
  name: 'Vision Screening',
  description: 'Red reflex and eye alignment analysis',
  icon: 'Eye',
  duration: '2-3 min',
  color: 'bg-blue-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'user',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('vision' as any),
  analysisType: 'vision',
  qualityGate: visionQualityGate,
}

registerModule(def)
export default def
