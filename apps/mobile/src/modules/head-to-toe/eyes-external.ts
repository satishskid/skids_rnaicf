import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const def: ModuleDefinition = {
  type: 'eyes_external' as any,
  name: 'Eyes External',
  description: 'Strabismus, ptosis, conjunctival pallor/redness',
  icon: 'EyeExternal',
  duration: '1-2 min',
  color: 'bg-cyan-500',
  group: 'head_to_toe',
  captureType: 'photo',
  cameraFacing: 'user',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('eyes_external' as any),
  analysisType: 'general',
}

registerModule(def)
export default def
