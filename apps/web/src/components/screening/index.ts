// Existing modules
export { VisionScreening } from './vision-screening'
export { VitalsScreening } from './vitals-screening'
export { RespiratoryScreening } from './respiratory-screening'
export { SkinScreening } from './skin-screening'
export { EarScreening } from './ear-screening'
export { MotorScreening } from './motor-screening'
export { NeuroScreening } from './neuro-screening'

// New photo-based modules
export { GeneralAppearanceScreening } from './general-appearance-screening'
export { HairScreening } from './hair-screening'
export { EyesExternalScreening } from './eyes-external-screening'
export { NoseScreening } from './nose-screening'
export { NailsScreening } from './nails-screening'
export { PostureScreening } from './posture-screening'
export { AbdomenScreening } from './abdomen-screening'

// New video-based modules
export { DentalScreening } from './dental-screening'
export { ThroatScreening } from './throat-screening'
export { NeckScreening } from './neck-screening'

// New value-based modules
export { HeightScreening } from './height-screening'
export { WeightScreening } from './weight-screening'
export { SpO2Screening } from './spo2-screening'
export { HemoglobinScreening } from './hemoglobin-screening'
export { BPScreening } from './bp-screening'

// New form-based modules
export { LymphScreening } from './lymph-screening'
export { HearingScreening } from './hearing-screening'
export { ImmunizationScreening } from './immunization-screening'

// Stethoscope auscultation modules
export { CardiacScreening } from './cardiac-screening'
export { PulmonaryScreening } from './pulmonary-screening'

// Nutrition / Feeding India modules
export { MUACScreening } from './muac-screening'
export { NutritionIntakeScreening } from './nutrition-intake-screening'
export { InterventionScreening } from './intervention-screening'

// Custom module renderer
export { CustomScreening } from './custom-screening'

// Shared components
export { AnnotationChips } from './annotation-chips'
export { ImageAnnotator } from './image-annotator'
export { DeviceValueCapture } from './device-value-capture'
export { VideoCapture } from './video-capture'

// Types and configs
export { MODULE_INSTRUCTIONS, MODULE_ANNOTATION_CONFIGS, getAnnotationConfig } from './types'
export type { ScreeningProps } from './types'
