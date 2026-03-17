import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'
import { dentalQualityGate } from '../../lib/ai/quality-gate'

const def: ModuleDefinition = {
  type: 'dental' as any,
  name: 'Dental Screening',
  description: 'Caries, malocclusion, gingivitis, oral health',
  icon: 'Tooth',
  duration: '2-3 min',
  color: 'bg-sky-500',
  group: 'head_to_toe',
  captureType: 'video',
  cameraFacing: 'environment',
  recommendedAge: ['preschool', 'school', 'adolescent'],
  chips: getChipsForModule('dental' as any),
  analysisType: 'dental',
  qualityGate: dentalQualityGate,
}

registerModule(def)
export default def
