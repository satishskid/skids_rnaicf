import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const def: ModuleDefinition = {
  type: 'posture' as any,
  name: 'Posture & Spine',
  description: 'Scoliosis screening, gait',
  icon: 'Spine',
  duration: '2-3 min',
  color: 'bg-emerald-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'environment',
  recommendedAge: ['school', 'adolescent'],
  chips: getChipsForModule('posture' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
