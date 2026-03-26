/**
 * ModuleScreen — Renders the correct screening module component.
 * Route: /screen/:code/:childId/:module
 */
import { useParams } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Lazy-load each screening module for code splitting
const modules: Record<string, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  abdomen: lazy(() => import('@/components/screening/abdomen-screening')),
  bp: lazy(() => import('@/components/screening/bp-screening')),
  cardiac: lazy(() => import('@/components/screening/cardiac-screening')),
  custom: lazy(() => import('@/components/screening/custom-screening')),
  dental: lazy(() => import('@/components/screening/dental-screening')),
  ear: lazy(() => import('@/components/screening/ear-screening')),
  eyes_external: lazy(() => import('@/components/screening/eyes-external-screening')),
  general_appearance: lazy(() => import('@/components/screening/general-appearance-screening')),
  hair: lazy(() => import('@/components/screening/hair-screening')),
  hearing: lazy(() => import('@/components/screening/hearing-screening')),
  height: lazy(() => import('@/components/screening/height-screening')),
  hemoglobin: lazy(() => import('@/components/screening/hemoglobin-screening')),
  immunization: lazy(() => import('@/components/screening/immunization-screening')),
  intervention: lazy(() => import('@/components/screening/intervention-screening')),
  lymph: lazy(() => import('@/components/screening/lymph-screening')),
  motor: lazy(() => import('@/components/screening/motor-screening')),
  muac: lazy(() => import('@/components/screening/muac-screening')),
  nails: lazy(() => import('@/components/screening/nails-screening')),
  neck: lazy(() => import('@/components/screening/neck-screening')),
  neuro: lazy(() => import('@/components/screening/neuro-screening')),
  nose: lazy(() => import('@/components/screening/nose-screening')),
  nutrition_intake: lazy(() => import('@/components/screening/nutrition-intake-screening')),
  posture: lazy(() => import('@/components/screening/posture-screening')),
  pulmonary: lazy(() => import('@/components/screening/pulmonary-screening')),
  respiratory: lazy(() => import('@/components/screening/respiratory-screening')),
  skin: lazy(() => import('@/components/screening/skin-screening')),
  spo2: lazy(() => import('@/components/screening/spo2-screening')),
  throat: lazy(() => import('@/components/screening/throat-screening')),
  vision: lazy(() => import('@/components/screening/vision-screening')),
  vitals: lazy(() => import('@/components/screening/vitals-screening')),
  weight: lazy(() => import('@/components/screening/weight-screening')),
}

export default function ModuleScreen() {
  const { code, childId, module } = useParams<{ code: string; childId: string; module: string }>()

  if (!module || !modules[module]) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-destructive">Module not found: {module}</h1>
        <p className="text-muted-foreground mt-2">Available modules: {Object.keys(modules).join(', ')}</p>
      </div>
    )
  }

  const ModuleComponent = modules[module]

  return (
    <div className="p-4">
      <Suspense fallback={<div className="p-8 text-center">Loading {module?.replace(/_/g, ' ')} module...</div>}>
        <ModuleComponent />
      </Suspense>
    </div>
  )
}
