import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'pulmonary' as any,
  name: 'Pulmonary Auscultation',
  description: 'Lung sounds via stethoscope (6 auscultation points)',
  icon: 'Stethoscope',
  duration: '5-7 min',
  color: 'bg-teal-600',
  group: 'head_to_toe',
  captureType: 'audio',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('pulmonary' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
