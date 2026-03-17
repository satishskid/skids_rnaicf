import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const def: ModuleDefinition = {
  type: 'mchat' as any,
  name: 'M-CHAT Screening',
  description: 'Modified Checklist for Autism in Toddlers',
  icon: 'Brain',
  duration: '5-10 min',
  color: 'bg-pink-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: ['toddler', 'preschool'],
  chips: getChipsForModule('mchat' as any),
}

registerModule(def)
export default def
