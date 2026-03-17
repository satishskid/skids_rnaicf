import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const behavioralDef: ModuleDefinition = {
  type: 'behavioral' as any,
  name: 'Behavioral Assessment',
  description: 'Structured autism/neurodevelopmental observation',
  icon: 'Users',
  duration: '10-15 min',
  color: 'bg-violet-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('behavioral' as any),
}

const neurodevelopmentDef: ModuleDefinition = {
  type: 'neurodevelopment' as any,
  name: 'Neurodevelopment',
  description: 'Developmental milestone screening',
  icon: 'Users',
  duration: '10-15 min',
  color: 'bg-violet-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('neurodevelopment' as any),
}

registerModule(behavioralDef)
registerModule(neurodevelopmentDef)
export default behavioralDef
