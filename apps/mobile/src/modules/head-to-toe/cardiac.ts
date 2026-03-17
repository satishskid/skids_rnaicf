import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'cardiac' as any,
  name: 'Cardiac Auscultation',
  description: 'Heart sounds via stethoscope (4 auscultation points)',
  icon: 'Stethoscope',
  duration: '3-5 min',
  color: 'bg-rose-600',
  group: 'head_to_toe',
  captureType: 'audio',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('cardiac' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
