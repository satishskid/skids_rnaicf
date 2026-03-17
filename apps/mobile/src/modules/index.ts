/**
 * Module Registry — single source of truth for all screening modules.
 *
 * To add a new module:
 * 1. Create a file in the appropriate group folder (vitals/, head-to-toe/, protocols/)
 * 2. Export a ModuleDefinition and call registerModule() from './registry'
 * 3. Add the import here
 *
 * That's it. No need to touch ModuleScreen, annotations, image-analyzer, etc.
 */

// Re-export registry functions (registry.ts has no circular deps)
export { registerModule, getModule, getAllModules, getModulesForAge } from './registry'

// ── Import all modules (each file calls registerModule on load) ──

// Vitals
import './vitals/height'
import './vitals/weight'
import './vitals/spo2'
import './vitals/hemoglobin'
import './vitals/bp'
import './vitals/muac'
import './vitals/vitals-rppg'

// Head-to-toe
import './head-to-toe/general-appearance'
import './head-to-toe/hair'
import './head-to-toe/eyes-external'
import './head-to-toe/vision'
import './head-to-toe/ear'
import './head-to-toe/nose'
import './head-to-toe/throat'
import './head-to-toe/dental'
import './head-to-toe/neck'
import './head-to-toe/abdomen'
import './head-to-toe/skin'
import './head-to-toe/nails'
import './head-to-toe/posture'
import './head-to-toe/lymph'
import './head-to-toe/respiratory'
import './head-to-toe/cardiac'
import './head-to-toe/pulmonary'

// Protocols (form-based)
import './protocols/hearing'
import './protocols/mchat'
import './protocols/behavioral'
import './protocols/motor'
import './protocols/nutrition'
import './protocols/intervention'
import './protocols/immunization'

// Re-export types
export type { ModuleDefinition, ChipDef, ModuleGuidance, FormProps, CaptureType, AnalysisType } from './types'
