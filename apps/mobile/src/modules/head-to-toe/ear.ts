import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'
import { earQualityGate } from '../../lib/ai/quality-gate'

const def: ModuleDefinition = {
  type: 'ear' as any,
  name: 'Ear Screening',
  description: 'Tympanic membrane examination',
  icon: 'Ear',
  duration: '2-3 min',
  color: 'bg-yellow-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: ['infant', 'toddler', 'preschool', 'school'],
  chips: getChipsForModule('ear' as any),
  analysisType: 'ear',
  qualityGate: earQualityGate,
}

registerModule(def)
export default def
