import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Stethoscope,
  Heart,
  Brain,
  Accessibility,
  Apple,
  Activity,
  Shield,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowUpRight,
  List,
  FileText,
  Users,
  Clock,
  Eye,
  Ear,
  Syringe,
} from 'lucide-react'

// ── Types ──

interface Condition {
  name: string
  icdCode: string
  sourceModules: string[]
  description: string
}

interface CategoryConfig {
  id: string
  label: string
  icon: typeof Heart
  badge: string
  bg: string
  text: string
  conditions: Condition[]
}

// ── Table of Contents ──

const TOC_ITEMS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'condition-categories', label: 'Condition Categories' },
  { id: 'cat-defects', label: 'Defects (Congenital/Structural)', indent: true },
  { id: 'cat-delay', label: 'Developmental Delay', indent: true },
  { id: 'cat-disability', label: 'Disability', indent: true },
  { id: 'cat-deficiency', label: 'Nutritional Deficiency', indent: true },
  { id: 'cat-behavioral', label: 'Behavioral / Mental Health', indent: true },
  { id: 'cat-immunization', label: 'Immunization Status', indent: true },
  { id: 'cat-learning', label: 'Learning Disabilities', indent: true },
  { id: 'risk-classification', label: 'Risk Classification' },
  { id: 'accuracy-limitations', label: 'Screening Accuracy & Limitations' },
  { id: 'best-practices', label: 'Best Practices' },
  { id: 'referral-guidelines', label: 'Referral Guidelines' },
  { id: 'specialist-referral', label: 'Specialist Referral Table' },
]

// ── Category Data ──

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'cat-defects',
    label: 'Defects (Congenital/Structural)',
    icon: Heart,
    badge: 'bg-red-100 text-red-800',
    bg: 'bg-red-50',
    text: 'text-red-700',
    conditions: [
      { name: 'Cleft Lip/Palate', icdCode: 'Q36-Q37', sourceModules: ['Dental'], description: 'Congenital orofacial cleft affecting the lip, palate, or both. May impair feeding, speech, and dental development.' },
      { name: 'Down Syndrome', icdCode: 'Q90', sourceModules: ['General Appearance'], description: 'Chromosomal disorder (trisomy 21) with characteristic facial features, hypotonia, and variable intellectual disability.' },
      { name: 'Congenital Heart Defect', icdCode: 'Q24.9', sourceModules: ['Vitals'], description: 'Suspected structural heart abnormality based on murmur, cyanosis, or abnormal vitals requiring cardiology evaluation.' },
      { name: 'Hydrocephalus', icdCode: 'Q03', sourceModules: ['General Appearance'], description: 'Abnormal accumulation of cerebrospinal fluid within brain ventricles causing increased head circumference.' },
      { name: 'Microcephaly', icdCode: 'Q02', sourceModules: ['General Appearance'], description: 'Head circumference significantly below average for age and sex, potentially indicating impaired brain growth.' },
      { name: 'Clubfoot', icdCode: 'Q66', sourceModules: ['Posture'], description: 'Congenital foot deformity with inward rotation and plantar flexion. Early treatment with serial casting is effective.' },
      { name: 'Undescended Testis', icdCode: 'Q53', sourceModules: ['General Appearance'], description: 'Failure of one or both testes to descend into the scrotum. Requires referral if not resolved by 6 months.' },
      { name: 'Hypospadias', icdCode: 'Q54', sourceModules: ['General Appearance'], description: 'Urethral opening on the underside of the penis. Severity ranges from glanular to penoscrotal.' },
      { name: 'Polydactyly', icdCode: 'Q69', sourceModules: ['Motor'], description: 'Presence of extra fingers or toes. May be isolated or associated with other congenital syndromes.' },
      { name: 'Syndactyly', icdCode: 'Q70', sourceModules: ['Motor'], description: 'Fusion of two or more fingers or toes. May be cutaneous (skin only) or osseous (bone).' },
      { name: 'Spina Bifida', icdCode: 'Q05', sourceModules: ['Posture'], description: 'Neural tube defect with incomplete closure of the vertebral column. Severity ranges from occulta to myelomeningocele.' },
      { name: 'Ambiguous Genitalia', icdCode: 'Q56', sourceModules: ['General Appearance'], description: 'External genitalia that do not appear clearly male or female, requiring endocrine and genetic evaluation.' },
    ],
  },
  {
    id: 'cat-delay',
    label: 'Developmental Delay',
    icon: Brain,
    badge: 'bg-orange-100 text-orange-800',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    conditions: [
      { name: 'Global Developmental Delay', icdCode: 'F88', sourceModules: ['Neurodevelopment'], description: 'Significant delay in two or more developmental domains in children under 5 years of age.' },
      { name: 'Speech Delay', icdCode: 'F80', sourceModules: ['Neurodevelopment'], description: 'Failure to meet age-appropriate milestones in expressive or receptive language development.' },
      { name: 'Motor Delay', icdCode: 'F82', sourceModules: ['Motor'], description: 'Delayed achievement of gross or fine motor milestones such as sitting, walking, grasping, or drawing.' },
      { name: 'Cognitive Delay', icdCode: 'F79', sourceModules: ['Neurodevelopment'], description: 'Below-expected intellectual functioning for age, affecting reasoning, problem-solving, and learning.' },
      { name: 'Social-Emotional Delay', icdCode: 'F84.9', sourceModules: ['Neurodevelopment'], description: 'Marked reduction in social interaction and emotional regulation beyond what is typical for age.' },
      { name: 'Adaptive Behavior Delay', icdCode: 'F70-F79', sourceModules: ['Neurodevelopment'], description: 'Difficulty with age-appropriate daily living skills including self-care, communication, and socialization.' },
    ],
  },
  {
    id: 'cat-disability',
    label: 'Disability',
    icon: Accessibility,
    badge: 'bg-purple-100 text-purple-800',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    conditions: [
      { name: 'Vision Impairment', icdCode: 'H54', sourceModules: ['Vision'], description: 'Reduced visual acuity or visual field not correctable to normal with standard lenses.' },
      { name: 'Hearing Loss', icdCode: 'H90-H91', sourceModules: ['Hearing'], description: 'Partial or complete inability to hear in one or both ears. May be conductive, sensorineural, or mixed.' },
      { name: 'Cerebral Palsy', icdCode: 'G80', sourceModules: ['Motor'], description: 'Non-progressive motor disorder from early brain injury affecting movement, posture, and coordination.' },
      { name: 'Intellectual Disability', icdCode: 'F70-F79', sourceModules: ['Neurodevelopment'], description: 'Significant limitations in intellectual functioning and adaptive behavior originating before age 18.' },
      { name: 'Physical Disability', icdCode: '--', sourceModules: ['Motor', 'Posture'], description: 'Limitation in physical functioning affecting mobility, dexterity, or stamina requiring assistive interventions.' },
      { name: 'Multiple Disabilities', icdCode: '--', sourceModules: ['Multiple Modules'], description: 'Co-occurrence of two or more disabilities requiring coordinated multi-disciplinary intervention.' },
    ],
  },
  {
    id: 'cat-deficiency',
    label: 'Nutritional Deficiency',
    icon: Apple,
    badge: 'bg-yellow-100 text-yellow-800',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    conditions: [
      { name: 'Severe Acute Malnutrition (SAM)', icdCode: 'E43', sourceModules: ['General Appearance', 'MUAC'], description: 'Life-threatening condition with severe wasting (WHZ < -3) requiring urgent nutritional rehabilitation.' },
      { name: 'Moderate Acute Malnutrition (MAM)', icdCode: 'E44', sourceModules: ['General Appearance', 'MUAC'], description: 'Moderate wasting (WHZ -3 to -2) requiring supplementary feeding and monitoring.' },
      { name: 'Stunting', icdCode: 'E45', sourceModules: ['General Appearance'], description: 'Low height-for-age reflecting chronic undernutrition, impacting growth and cognitive development.' },
      { name: 'Wasting', icdCode: 'E46', sourceModules: ['General Appearance'], description: 'Low weight-for-height indicating acute malnutrition or recent illness-related weight loss.' },
      { name: 'Anemia', icdCode: 'D50', sourceModules: ['General Appearance', 'Eyes', 'Nails'], description: 'Clinical signs of low hemoglobin including pallor of conjunctivae, nail beds, and palms.' },
      { name: 'Vitamin A Deficiency', icdCode: 'E50', sourceModules: ['Eyes', 'Skin'], description: 'Deficiency causing night blindness, xerophthalmia, and increased susceptibility to infections.' },
      { name: 'Vitamin D Deficiency', icdCode: 'E55', sourceModules: ['Posture', 'General Appearance'], description: 'Deficiency leading to rickets in children with bone deformities, muscle weakness, and growth failure.' },
      { name: 'Iodine Deficiency / Goiter', icdCode: 'E01', sourceModules: ['Neck'], description: 'Thyroid gland enlargement due to iodine deficiency. Graded by visibility and palpation (Grade 1-3).' },
      { name: 'Zinc Deficiency', icdCode: 'E60', sourceModules: ['Skin', 'General Appearance'], description: 'Deficiency causing growth retardation, immune dysfunction, and dermatitis (acrodermatitis).' },
      { name: 'Iron Deficiency', icdCode: 'E61.1', sourceModules: ['Nails', 'General Appearance'], description: 'Most common nutritional deficiency worldwide. Manifests as koilonychia, pallor, and fatigue.' },
      { name: 'Obesity', icdCode: 'E66', sourceModules: ['General Appearance'], description: 'Excess body fat accumulation (BMI > 95th percentile) increasing risk of metabolic and orthopedic complications.' },
      { name: 'Fluorosis', icdCode: 'K00.3', sourceModules: ['Dental'], description: 'Enamel defects from excessive fluoride ingestion during tooth development. White spots to brown pitting.' },
    ],
  },
  {
    id: 'cat-behavioral',
    label: 'Behavioral / Mental Health',
    icon: Activity,
    badge: 'bg-blue-100 text-blue-800',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    conditions: [
      { name: 'ADHD', icdCode: 'F90', sourceModules: ['Neurodevelopment'], description: 'Persistent pattern of inattention and/or hyperactivity-impulsivity interfering with functioning or development.' },
      { name: 'Autism Spectrum Disorder', icdCode: 'F84.0', sourceModules: ['Neurodevelopment'], description: 'Neurodevelopmental condition with persistent deficits in social communication and restricted/repetitive behaviors.' },
      { name: 'Anxiety Disorder', icdCode: 'F41', sourceModules: ['Neurodevelopment'], description: 'Excessive worry or fear disproportionate to the situation, causing significant distress or functional impairment.' },
      { name: 'Depression', icdCode: 'F32', sourceModules: ['Neurodevelopment'], description: 'Persistent sadness, loss of interest, and associated symptoms affecting daily functioning for 2+ weeks.' },
      { name: 'Conduct Disorder', icdCode: 'F91', sourceModules: ['Neurodevelopment'], description: 'Repetitive pattern of behavior violating others\u0027 rights or age-appropriate social norms and rules.' },
      { name: 'Oppositional Defiant Disorder (ODD)', icdCode: 'F91.3', sourceModules: ['Neurodevelopment'], description: 'Recurrent pattern of angry, irritable mood with argumentative, defiant, or vindictive behavior toward authority.' },
      { name: 'Enuresis', icdCode: 'F98.0', sourceModules: ['Neurodevelopment'], description: 'Involuntary urination (bedwetting) beyond the age at which bladder control is typically achieved (5+ years).' },
      { name: 'Encopresis', icdCode: 'F98.1', sourceModules: ['Neurodevelopment'], description: 'Repeated passage of feces in inappropriate places beyond the age at which bowel control is expected (4+ years).' },
    ],
  },
  {
    id: 'cat-immunization',
    label: 'Immunization Status',
    icon: Syringe,
    badge: 'bg-emerald-100 text-emerald-800',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    conditions: [
      { name: 'Incomplete Primary Series', icdCode: 'Z28.3', sourceModules: ['Immunization'], description: 'Primary vaccination series (BCG, OPV, DPT, Hepatitis B, Measles) not completed per national schedule.' },
      { name: 'Missing Boosters', icdCode: 'Z28.3', sourceModules: ['Immunization'], description: 'Age-appropriate booster doses not administered. Catch-up schedule should be initiated.' },
      { name: 'No Vaccination Record', icdCode: 'Z28.9', sourceModules: ['Immunization'], description: 'No immunization card or records available. Treat as unimmunized and initiate catch-up schedule.' },
      { name: 'Partial Coverage', icdCode: 'Z28.3', sourceModules: ['Immunization'], description: 'Some vaccinations received but schedule is incomplete. Document what is available and plan catch-up.' },
      { name: 'Delayed Schedule', icdCode: 'Z28.8', sourceModules: ['Immunization'], description: 'Vaccinations started but significantly behind schedule. Requires accelerated catch-up plan per guidelines.' },
    ],
  },
  {
    id: 'cat-learning',
    label: 'Learning Disabilities',
    icon: BookOpen,
    badge: 'bg-indigo-100 text-indigo-800',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    conditions: [
      { name: 'Dyslexia', icdCode: 'F81.0', sourceModules: ['Neurodevelopment'], description: 'Specific learning disorder affecting reading accuracy, fluency, and comprehension despite adequate instruction.' },
      { name: 'Dyscalculia', icdCode: 'F81.2', sourceModules: ['Neurodevelopment'], description: 'Specific learning disorder affecting number sense, math fact recall, and arithmetic reasoning.' },
      { name: 'Dysgraphia', icdCode: 'F81.1', sourceModules: ['Neurodevelopment'], description: 'Specific learning disorder affecting written expression, handwriting legibility, and spelling.' },
    ],
  },
]

// ── Specialist referral mappings ──

const SPECIALIST_REFERRALS = [
  { condition: 'Vision Impairment', specialist: 'Ophthalmologist', urgency: 'Within 2 weeks', notes: 'Include visual acuity readings and observation photos' },
  { condition: 'Hearing Loss', specialist: 'Audiologist / ENT', urgency: 'Within 2 weeks', notes: 'Note laterality (unilateral/bilateral) and suspected type' },
  { condition: 'Congenital Heart Defect', specialist: 'Pediatric Cardiologist', urgency: 'Within 1 week', notes: 'Document murmur grade, cyanosis, and vitals readings' },
  { condition: 'Cleft Lip/Palate', specialist: 'Plastic Surgeon / Cleft Team', urgency: 'Within 1 month', notes: 'Document type (lip, palate, or both) and feeding status' },
  { condition: 'Cerebral Palsy', specialist: 'Pediatric Neurologist', urgency: 'Within 2 weeks', notes: 'Include motor function level and associated impairments' },
  { condition: 'ADHD / Behavioral', specialist: 'Child Psychiatrist / Psychologist', urgency: 'Within 1 month', notes: 'Document behavioral observations and teacher reports' },
  { condition: 'Down Syndrome', specialist: 'Geneticist / Pediatrician', urgency: 'Within 1 month', notes: 'Screen for associated cardiac, thyroid, and vision issues' },
  { condition: 'SAM / Severe Malnutrition', specialist: 'Nutritional Rehab Center (NRC)', urgency: 'Immediate', notes: 'MUAC, weight-for-height, and edema status required' },
  { condition: 'Scoliosis / Posture', specialist: 'Orthopedic Surgeon', urgency: 'Within 1 month', notes: 'Include Cobb angle estimation and Adams forward bend result' },
  { condition: 'Learning Disabilities', specialist: 'Educational Psychologist', urgency: 'Within 2 months', notes: 'Include academic performance data and teacher observations' },
]

// ── Main Component ──

export function ClinicalReferencePage() {
  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link
        to="/docs"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Documentation
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-100 p-3">
            <Stethoscope className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clinical Reference</h1>
            <p className="mt-1 text-sm text-gray-500">
              SKIDS Screen V3 &mdash; For Doctors & Clinicians
            </p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="mb-3 flex items-center gap-2">
          <List className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900">Table of Contents</h2>
        </div>
        <nav className="grid gap-1 sm:grid-cols-2">
          {TOC_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white hover:text-blue-600 ${
                item.indent ? 'pl-7 text-gray-500' : 'font-medium text-gray-700'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* 1. Introduction */}
      <section id="introduction" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Introduction</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The SKIDS (School Kids Development Screening) platform screens children
          across <strong>52 clinical conditions</strong> organized into{' '}
          <strong>7 diagnostic categories</strong>. These categories form the
          foundation of the 4D Report framework: Defects, Delay, Disability,
          and Deficiency, extended with Behavioral/Mental Health, Immunization
          Status, and Learning Disabilities.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Each condition is mapped to specific annotation chips collected during
          field screening across 27+ modules. The system uses ICD-10 coding for
          standardized classification and generates risk assessments based on
          the presence, severity, and combination of findings.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">52</p>
            <p className="text-xs text-gray-500">Conditions</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">7</p>
            <p className="text-xs text-gray-500">Categories</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">27+</p>
            <p className="text-xs text-gray-500">Modules</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">300+</p>
            <p className="text-xs text-gray-500">Annotation Chips</p>
          </div>
        </div>
      </section>

      {/* 2. Condition Categories */}
      <section id="condition-categories">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-bold text-gray-900">Condition Categories</h2>
        </div>
        <div className="space-y-6">
          {CATEGORIES.map((cat) => (
            <CategorySection key={cat.id} category={cat} />
          ))}
        </div>
      </section>

      {/* 3. Risk Classification */}
      <section id="risk-classification" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Risk Classification</h2>
        <p className="mt-2 text-sm text-gray-600">
          Each child receives an overall risk classification based on the number
          and severity of conditions detected across all screened categories.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-4 font-semibold text-gray-900">Level</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Criteria</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Action</th>
                <th className="pb-3 font-semibold text-gray-900">Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                    <CheckCircle2 className="h-3 w-3" /> Normal
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600">No conditions detected</td>
                <td className="py-3 pr-4 text-gray-600">Routine follow-up at next screening cycle</td>
                <td className="py-3">
                  <span className="inline-block h-4 w-12 rounded bg-green-500" />
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
                    <Info className="h-3 w-3" /> Mild
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600">1 condition, low severity</td>
                <td className="py-3 pr-4 text-gray-600">Doctor review within 2 weeks; monitor and re-screen</td>
                <td className="py-3">
                  <span className="inline-block h-4 w-12 rounded bg-yellow-400" />
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                    <AlertTriangle className="h-3 w-3" /> Moderate
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600">1-2 conditions, moderate severity</td>
                <td className="py-3 pr-4 text-gray-600">Specialist referral within 1 month; begin intervention</td>
                <td className="py-3">
                  <span className="inline-block h-4 w-12 rounded bg-orange-500" />
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                    <AlertTriangle className="h-3 w-3" /> Severe
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-600">3+ conditions, or any high-severity finding</td>
                <td className="py-3 pr-4 text-gray-600">Immediate referral; priority case management</td>
                <td className="py-3">
                  <span className="inline-block h-4 w-12 rounded bg-red-500" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Screening Accuracy & Limitations */}
      <section id="accuracy-limitations" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Screening Accuracy & Limitations</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-green-200 bg-green-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-bold text-green-900">What SKIDS IS</h3>
            </div>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A population-level screening tool for early detection
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A risk identifier for 52 conditions across 7 categories
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                An AI-assisted annotation aid to support field teams
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A structured referral and tracking system
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A data collection platform for public health analytics
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-sm font-bold text-red-900">What SKIDS IS NOT</h3>
            </div>
            <ul className="space-y-2 text-sm text-red-800">
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A diagnostic tool (findings require clinical confirmation)
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A replacement for comprehensive clinical examination
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A substitute for laboratory tests or imaging studies
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A treatment recommendation engine
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                A replacement for specialist evaluation and diagnosis
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> AI annotations are advisory only. All
              AI-generated suggestions must be reviewed and confirmed by a
              qualified medical professional before being acted upon. False
              positives and false negatives are expected in any screening
              program.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Best Practices */}
      <section id="best-practices" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Best Practices</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Nurse best practices */}
          <div className="rounded-lg border border-gray-200 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-bold text-gray-900">For Nurses & Field Staff</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                <span><strong>Capture Quality:</strong> Ensure clear, well-focused photos with the target area clearly visible and centered in frame</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                <span><strong>Lighting:</strong> Use natural light when possible; avoid harsh shadows and backlighting; use flash only for oral/dental modules</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                <span><strong>Child Cooperation:</strong> Engage the child before screening; explain each step; use age-appropriate language and reassurance</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                <span><strong>Annotation Selection:</strong> Select all applicable chips; do not skip findings even if uncertain; let the doctor review decide</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                <span><strong>Sync Regularly:</strong> Sync completed observations when connectivity is available to ensure timely doctor review</span>
              </li>
            </ul>
          </div>
          {/* Doctor best practices */}
          <div className="rounded-lg border border-gray-200 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">For Doctors & Reviewers</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span><strong>Review Thoroughness:</strong> Examine all observation photos and AI annotations before making a decision; do not rely on AI alone</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span><strong>Quality Rating:</strong> Rate observation quality honestly to improve training data and field team performance</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span><strong>Documentation:</strong> Add clinical notes for any modified or overridden AI annotations; document reasoning for referrals</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span><strong>4D Report Review:</strong> Check the complete 4D report for each child before finalizing to catch cross-module patterns</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span><strong>Referral Specificity:</strong> Specify the target specialist and urgency level when generating referrals</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. Referral Guidelines */}
      <section id="referral-guidelines" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Referral Guidelines</h2>
        <p className="mt-2 text-sm text-gray-600">
          Referrals are categorized by urgency based on the nature and severity of findings.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-sm font-bold text-red-900">Immediate Referral</h3>
            </div>
            <p className="text-xs text-red-700 mb-3">Within 24-48 hours</p>
            <ul className="space-y-1.5 text-xs text-red-800">
              <li>Life-threatening conditions (SAM with complications)</li>
              <li>Suspected congenital heart disease with cyanosis</li>
              <li>Acute neurological signs (seizures, altered consciousness)</li>
              <li>Severe dehydration or bilateral pitting edema</li>
              <li>Signs of abuse or neglect</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <h3 className="text-sm font-bold text-orange-900">Specialist Referral</h3>
            </div>
            <p className="text-xs text-orange-700 mb-3">Within 2-4 weeks</p>
            <ul className="space-y-1.5 text-xs text-orange-800">
              <li>Confirmed vision or hearing impairment</li>
              <li>Suspected cerebral palsy or motor disorders</li>
              <li>Developmental delay requiring formal assessment</li>
              <li>Behavioral conditions (ADHD, ASD) for evaluation</li>
              <li>Congenital anomalies needing surgical consultation</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-blue-900">Follow-up Monitoring</h3>
            </div>
            <p className="text-xs text-blue-700 mb-3">Next screening cycle (1-3 months)</p>
            <ul className="space-y-1.5 text-xs text-blue-800">
              <li>Mild nutritional deficiencies responding to supplementation</li>
              <li>Borderline findings requiring re-assessment</li>
              <li>Conditions under treatment with expected improvement</li>
              <li>Immunization catch-up in progress</li>
              <li>Mild dental or skin findings being managed</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. Specialist Referral Table */}
      <section id="specialist-referral" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Specialist Referral Table</h2>
        <p className="mt-2 text-sm text-gray-600">
          Recommended specialist mappings for the most common conditions identified during screening.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-4 font-semibold text-gray-900">Condition</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Refer To</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Urgency</th>
                <th className="pb-3 font-semibold text-gray-900">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SPECIALIST_REFERRALS.map((ref) => (
                <tr key={ref.condition}>
                  <td className="py-3 pr-4 font-medium text-gray-900">{ref.condition}</td>
                  <td className="py-3 pr-4 text-gray-700">{ref.specialist}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        ref.urgency === 'Immediate'
                          ? 'bg-red-100 text-red-800'
                          : ref.urgency.includes('1 week')
                            ? 'bg-orange-100 text-orange-800'
                            : ref.urgency.includes('2 weeks')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {ref.urgency}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-gray-500">{ref.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-center">
        <p className="text-xs text-gray-500">
          SKIDS Screen V3 Clinical Reference &mdash; Last updated March 2026
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            to="/docs"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Documentation Hub
          </Link>
          <Link
            to="/docs/tech-manual"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Technical Manual
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Category Section Component ──

function CategorySection({ category }: { category: CategoryConfig }) {
  const Icon = category.icon

  return (
    <div id={category.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className={`px-6 py-4 ${category.bg} border-b border-gray-200`}>
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${category.text}`} />
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wide ${category.text}`}>
              {category.label}
            </h3>
            <p className="text-xs text-gray-500">
              {category.conditions.length} condition{category.conditions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {category.conditions.map((cond) => (
          <div key={cond.name} className="px-6 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{cond.name}</span>
                  {cond.icdCode !== '--' && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                      {cond.icdCode}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{cond.description}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap gap-1">
                {cond.sourceModules.map((mod) => (
                  <span
                    key={mod}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${category.badge}`}
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
