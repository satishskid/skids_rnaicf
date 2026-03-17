import { registerModule } from '../registry'
import type { ModuleDefinition } from '../types'
import { getChipsForModule } from '../../lib/annotations'

const ALL_AGES = ['infant', 'toddler', 'preschool', 'school', 'adolescent'] as const

const motorDef: ModuleDefinition = {
  type: 'motor' as any,
  name: 'Motor Assessment',
  description: 'Gross and fine motor skill evaluation',
  icon: 'Activity',
  duration: '5-10 min',
  color: 'bg-green-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('motor' as any),
}

const grossMotorDef: ModuleDefinition = {
  type: 'gross_motor' as any,
  name: 'Gross Motor Assessment',
  description: 'Gross and fine motor skill evaluation',
  icon: 'Activity',
  duration: '5-10 min',
  color: 'bg-green-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('gross_motor' as any),
}

const fineMotorDef: ModuleDefinition = {
  type: 'fine_motor' as any,
  name: 'Fine Motor Assessment',
  description: 'Gross and fine motor skill evaluation',
  icon: 'Activity',
  duration: '5-10 min',
  color: 'bg-green-600',
  group: 'head_to_toe',
  captureType: 'form',
  recommendedAge: [...ALL_AGES],
  chips: getChipsForModule('fine_motor' as any),
}

registerModule(motorDef)
registerModule(grossMotorDef)
registerModule(fineMotorDef)
export default motorDef
