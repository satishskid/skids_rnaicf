import { Link } from 'react-router-dom'
import {
  BookOpen,
  Users,
  Workflow,
  LayoutGrid,
  Tag,
  Stethoscope,
  PieChart,
  BarChart3,
  FileDown,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  ListChecks,
  Shield,
  Eye,
  Ruler,
  Weight,
  Activity,
  Droplets,
  Gauge,
  Ear,
  Smile,
  ScanLine,
  HeartPulse,
  Bone,
  Scissors,
  Brain,
  Baby,
  Wind,
  Hand,
  Microscope,
  Syringe,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowUpRight,
  FileText,
  Monitor,
  Smartphone,
  Database,
  Globe,
  Camera,
  Video,
  Keyboard,
  CircleDot,
} from 'lucide-react'
import type { ReactNode } from 'react'

// ── Internal Components ──

interface SectionCardProps {
  id: string
  icon: ReactNode
  title: string
  children: ReactNode
}

function SectionCard({ id, icon, title, children }: SectionCardProps) {
  return (
    <section id={id} className="border border-gray-200 bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-gray-700">{icon}</div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="text-gray-700 space-y-3">{children}</div>
    </section>
  )
}

interface DataTableProps {
  headers: string[]
  rows: string[][]
  compact?: boolean
}

function DataTable({ headers, rows, compact }: DataTableProps) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`text-left ${compact ? 'p-2' : 'p-3'} border border-gray-200 font-semibold text-gray-700`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`${compact ? 'p-2' : 'p-3'} border border-gray-200 text-gray-600`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkflowStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
        {number}
      </span>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

interface CategoryCardProps {
  name: string
  count: number
  color: string
  icon: ReactNode
  conditions: string[]
}

function CategoryCard({ name, count, color, icon, conditions }: CategoryCardProps) {
  return (
    <div className={`border ${color} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-gray-900">{name}</h4>
        <span className="ml-auto text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
          {count} conditions
        </span>
      </div>
      <p className="text-xs text-gray-600">{conditions.join(', ')}</p>
    </div>
  )
}

// ── Main Page ──

export function OpsManualPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FileText className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Operations Manual</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-2">
        {/* Table of Contents */}
        <nav className="bg-white rounded-lg shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-600" />
            Contents
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { href: '#overview', label: 'Overview' },
              { href: '#roles', label: 'Roles & Access' },
              { href: '#campaign-workflow', label: 'Campaign Workflow' },
              { href: '#screening-modules', label: 'Screening Modules' },
              { href: '#annotation-system', label: 'Annotation System' },
              { href: '#doctor-review', label: 'Doctor Review' },
              { href: '#4d-categories', label: '4D Report Categories' },
              { href: '#analytics', label: 'Analytics & Reports' },
              { href: '#data-export', label: 'Data Export' },
              { href: '#troubleshooting', label: 'Troubleshooting' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline py-0.5"
              >
                <ChevronRight className="w-3 h-3" />
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* 1. Overview */}
        <SectionCard id="overview" icon={<BookOpen className="w-5 h-5" />} title="Overview">
          <p>
            SKIDS Screen V3 is a comprehensive pediatric health screening platform purpose-built for
            large-scale school screening programs. It provides a complete digital workflow from field
            capture to clinical review to population health reporting.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-700">27+</p>
              <p className="text-xs text-indigo-600 font-medium">Screening Modules</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-700">52</p>
              <p className="text-xs text-emerald-600 font-medium">Clinical Conditions</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700">7</p>
              <p className="text-xs text-amber-600 font-medium">Report Categories</p>
            </div>
            <div className="text-center p-4 bg-rose-50 rounded-lg">
              <p className="text-2xl font-bold text-rose-700">5</p>
              <p className="text-xs text-rose-600 font-medium">User Roles</p>
            </div>
          </div>
          <p className="mt-3">
            The platform is built on an offline-first architecture, enabling field teams to conduct
            screenings in environments with limited or no internet connectivity. Data is synchronized
            automatically when connectivity is available, ensuring no screening data is lost.
          </p>
        </SectionCard>

        {/* 2. Roles & Access */}
        <SectionCard id="roles" icon={<Users className="w-5 h-5" />} title="Roles & Access">
          <p>
            Access control is role-based. Each user is assigned a role that determines which features
            and data they can access within the platform.
          </p>
          <DataTable
            headers={['Role', 'Screen', 'Review', 'Campaigns', 'Analytics', 'Admin']}
            rows={[
              ['Admin', 'Full', 'Full', 'Create / Edit / Delete', 'Full', 'Full'],
              ['Ops Manager', 'View', 'View', 'Create / Edit', 'Full', 'Limited'],
              ['Nurse', 'Capture / Edit', 'No', 'View Assigned', 'No', 'No'],
              ['Doctor', 'View', 'Full', 'View Assigned', 'Campaign-level', 'No'],
              ['Authority', 'No', 'No', 'View All', 'Population-level', 'No'],
            ]}
          />
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Admin:</span> Full system access including user
                management, campaign creation, template configuration, and data export.
              </p>
            </div>
            <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Ops Manager:</span> Campaign management, team
                assignments, progress monitoring, and data export. Cannot manage users or system settings.
              </p>
            </div>
            <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <HeartPulse className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Nurse:</span> Field screening: capture images/videos,
                annotate findings, rate severity, and sync data. Access limited to assigned campaigns.
              </p>
            </div>
            <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <Stethoscope className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Doctor:</span> Review screening observations, make
                clinical decisions (approve, refer, follow-up, discharge, retake), rate observation
                quality, and add notes.
              </p>
            </div>
            <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <Globe className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Authority:</span> Population-level analytics, prevalence
                reports, and cohort analysis across campaigns and regions. Read-only access.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* 3. Campaign Workflow */}
        <SectionCard
          id="campaign-workflow"
          icon={<Workflow className="w-5 h-5" />}
          title="Campaign Workflow"
        >
          <p>
            A campaign represents a screening event at a specific school or location. The campaign
            lifecycle follows these sequential stages:
          </p>
          <div className="space-y-3 mt-3">
            <WorkflowStep
              number={1}
              title="Plan"
              description="Identify the target school, estimate the number of children, select the screening scope, and schedule dates. Coordinate with school administrators for logistics."
            />
            <WorkflowStep
              number={2}
              title="Create Campaign"
              description="Enter campaign details in the system: name, school, location, dates, and any special notes. A unique campaign code is generated automatically."
            />
            <WorkflowStep
              number={3}
              title="Configure Modules"
              description="Select screening modules to include. Choose from templates or custom-pick modules. Enable AI assistance per module. Set mandatory vs optional flags."
            />
            <WorkflowStep
              number={4}
              title="Register Children"
              description="Import children via CSV upload (name, DOB, gender, class, section) or register them individually. Validate data quality before proceeding."
            />
            <WorkflowStep
              number={5}
              title="Screen"
              description="Field nurses conduct screenings using the mobile app. Capture images/videos, annotate findings, rate severity. Data syncs to cloud for review."
            />
            <WorkflowStep
              number={6}
              title="Review"
              description="Doctors review flagged observations in the Doctor Inbox. Make clinical decisions, rate quality, add notes. Prioritize by risk level."
            />
            <WorkflowStep
              number={7}
              title="Report"
              description="Generate 4D reports per child and population-level prevalence reports. Share individual reports with parents. Aggregate data for authorities."
            />
            <WorkflowStep
              number={8}
              title="Complete"
              description="Mark the campaign as complete. Archive data. Generate final analytics including coverage rates, condition prevalence, and referral statistics."
            />
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-gray-500 overflow-x-auto py-2">
            {['Plan', 'Create', 'Configure', 'Register', 'Screen', 'Review', 'Report', 'Complete'].map(
              (step, i, arr) => (
                <span key={step} className="flex items-center gap-1 whitespace-nowrap">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-medium">
                    {step}
                  </span>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                </span>
              ),
            )}
          </div>
        </SectionCard>

        {/* 4. Screening Modules */}
        <SectionCard
          id="screening-modules"
          icon={<LayoutGrid className="w-5 h-5" />}
          title="Screening Modules"
        >
          <p>
            Modules are organized into two groups: Vitals (quantitative measurements) and
            Head-to-Toe (clinical examination with image/video capture).
          </p>

          {/* Vitals Group */}
          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Vitals Group (7 modules)
            </h3>
            <DataTable
              compact
              headers={['Module', 'Capture Type', 'Duration', 'Device Integration']}
              rows={[
                ['Vision', 'Device / Manual', '2-3 min', 'Welch Allyn Spot Screener'],
                ['Height', 'Manual Entry', '30 sec', 'Stadiometer'],
                ['Weight', 'Manual Entry', '30 sec', 'Digital Scale'],
                ['SpO2', 'Device Reading', '30 sec', 'Pulse Oximeter'],
                ['Hemoglobin', 'Device Reading', '1 min', 'HemoCue / TrueHb'],
                ['Blood Pressure', 'Device Reading', '1-2 min', 'Digital BP Monitor'],
                ['Hearing', 'Device / Manual', '2-3 min', 'Audiometer / Screening App'],
              ]}
            />
          </div>

          {/* Head-to-Toe Group */}
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <ScanLine className="w-4 h-4 text-emerald-600" />
              Head-to-Toe Group (20 modules)
            </h3>
            <DataTable
              compact
              headers={['Module', 'Capture Type', 'Duration', 'AI Enabled']}
              rows={[
                ['Dental', 'Photo', '1-2 min', 'Yes'],
                ['Skin', 'Photo', '1-2 min', 'Yes'],
                ['Ear', 'Photo', '1-2 min', 'Yes'],
                ['Eyes', 'Photo', '1 min', 'Yes'],
                ['Throat', 'Photo', '1 min', 'Yes'],
                ['Nose', 'Photo', '1 min', 'Yes'],
                ['Neck', 'Photo', '1 min', 'Planned'],
                ['Hair', 'Photo', '1 min', 'Yes'],
                ['Nails', 'Photo', '1 min', 'Yes'],
                ['Posture', 'Photo', '1-2 min', 'Planned'],
                ['Motor', 'Video', '2-3 min', 'Planned'],
                ['Abdomen', 'Photo / Palpation', '1-2 min', 'No'],
                ['Lymph Nodes', 'Manual / Photo', '1 min', 'No'],
                ['General Appearance', 'Photo', '1 min', 'Yes'],
                ['Neurodevelopment', 'Questionnaire', '3-5 min', 'No'],
                ['Respiratory', 'Audio / Video', '2-3 min', 'AyuSynk'],
                ['Cardiac', 'Audio / Video', '2-3 min', 'AyuSynk'],
                ['Pulmonary', 'Audio', '2-3 min', 'AyuSynk'],
                ['MUAC', 'Manual Entry', '30 sec', 'No'],
                ['Nutrition Intake', 'Questionnaire', '2-3 min', 'No'],
              ]}
            />
          </div>
        </SectionCard>

        {/* 5. Annotation System */}
        <SectionCard id="annotation-system" icon={<Tag className="w-5 h-5" />} title="Annotation System">
          <p>
            The annotation system enables structured clinical documentation. Nurses select
            pre-defined clinical findings (chips), grade severity, and optionally pin findings to
            specific locations on captured images.
          </p>

          {/* Chips */}
          <div className="mt-3">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Annotation Chips</h3>
            <p className="text-sm">
              Each chip represents a specific clinical finding mapped to an ICD-10 code. Chips are
              organized by module and category. Examples include "Dental Caries" (K02.9), "Pallor"
              (R23.1), "Tonsillitis" (J03.9), and "Pediculosis" (B85.0).
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: 'Dental Caries', code: 'K02.9' },
                { label: 'Pallor', code: 'R23.1' },
                { label: 'Tonsillitis', code: 'J03.9' },
                { label: 'Pediculosis', code: 'B85.0' },
                { label: 'Refractive Error', code: 'H52.7' },
                { label: 'Eczema', code: 'L30.9' },
              ].map((chip) => (
                <span
                  key={chip.code}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs"
                >
                  <span className="font-medium text-blue-900">{chip.label}</span>
                  <span className="text-blue-500">{chip.code}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Severity Grading */}
          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Severity Grading</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-green-900">Normal</p>
                <p className="text-xs text-green-700">No findings or within normal limits</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-yellow-900">Mild</p>
                <p className="text-xs text-yellow-700">Minor findings, may need monitoring</p>
              </div>
              <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-orange-900">Moderate</p>
                <p className="text-xs text-orange-700">Significant findings, referral advised</p>
              </div>
              <div className="text-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-red-900">Severe</p>
                <p className="text-xs text-red-700">Critical findings, urgent referral</p>
              </div>
            </div>
          </div>

          {/* Location Pins */}
          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Location Pins</h3>
            <p className="text-sm">
              For image-based modules, nurses can place location pins on the captured image to mark
              the exact position of a finding. Each pin is linked to an annotation chip and severity
              grade. This helps doctors during review by precisely identifying affected areas.
            </p>
          </div>
        </SectionCard>

        {/* 6. Doctor Review */}
        <SectionCard
          id="doctor-review"
          icon={<Stethoscope className="w-5 h-5" />}
          title="Doctor Review"
        >
          <p>
            The doctor review system provides five decision types for each screening observation.
            Decisions determine the follow-up pathway for the child.
          </p>
          <div className="space-y-3 mt-3">
            <div className="flex gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">Approve</p>
                <p className="text-sm text-green-700">
                  Confirm the nurse's findings and severity rating. The observation is finalized and
                  included in the child's 4D report as documented.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900">Refer</p>
                <p className="text-sm text-orange-700">
                  Refer the child to a specialist for further evaluation. Specify the specialty (e.g.,
                  ophthalmology, dermatology, ENT). A referral note is generated for the parent.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Follow-up</p>
                <p className="text-sm text-blue-700">
                  Schedule a re-check at a later date. The child remains in the review queue and a
                  follow-up reminder is created. Used for borderline findings that need monitoring.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Discharge</p>
                <p className="text-sm text-gray-600">
                  No action needed. The finding is within normal limits or does not warrant
                  intervention. The observation is closed with no follow-up required.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <RotateCcw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Retake</p>
                <p className="text-sm text-amber-700">
                  Request the nurse to recapture the image or video. Specify the reason (poor quality,
                  wrong angle, blurry, obstructed view). The observation returns to the nurse's queue.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 7. 4D Report Categories */}
        <SectionCard
          id="4d-categories"
          icon={<PieChart className="w-5 h-5" />}
          title="4D Report Categories"
        >
          <p>
            Screening findings are organized into 7 report categories for structured clinical
            reporting. Each category groups related conditions for clear communication to parents
            and health authorities.
          </p>
          <div className="space-y-3 mt-3">
            <CategoryCard
              name="Defects"
              count={12}
              color="border-red-200"
              icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              conditions={[
                'Congenital Heart Defect',
                'Cleft Lip/Palate',
                'Clubfoot',
                'Cryptorchidism',
                'Hernia',
                'Hydrocephalus',
                'Hypospadias',
                'Microcephaly',
                'Neural Tube Defect',
                'Polydactyly',
                'Scoliosis',
                'Strabismus',
              ]}
            />
            <CategoryCard
              name="Delay"
              count={6}
              color="border-amber-200"
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              conditions={[
                'Speech Delay',
                'Motor Delay',
                'Cognitive Delay',
                'Social Development Delay',
                'Language Delay',
                'Growth Delay',
              ]}
            />
            <CategoryCard
              name="Disability"
              count={6}
              color="border-blue-200"
              icon={<Eye className="w-4 h-4 text-blue-500" />}
              conditions={[
                'Visual Impairment',
                'Hearing Impairment',
                'Intellectual Disability',
                'Physical Disability',
                'Learning Disability',
                'Multiple Disability',
              ]}
            />
            <CategoryCard
              name="Deficiency"
              count={12}
              color="border-orange-200"
              icon={<Droplets className="w-4 h-4 text-orange-500" />}
              conditions={[
                'Iron Deficiency Anemia',
                'Vitamin A Deficiency',
                'Vitamin D Deficiency',
                'Iodine Deficiency',
                'Zinc Deficiency',
                'Calcium Deficiency',
                'Protein-Energy Malnutrition',
                'Stunting',
                'Wasting',
                'Underweight',
                'Overweight',
                'Obesity',
              ]}
            />
            <CategoryCard
              name="Behavioral"
              count={8}
              color="border-purple-200"
              icon={<Brain className="w-4 h-4 text-purple-500" />}
              conditions={[
                'ADHD',
                'Autism Spectrum',
                'Anxiety',
                'Depression',
                'Conduct Disorder',
                'Oppositional Defiant',
                'Substance Use',
                'Sleep Disorder',
              ]}
            />
            <CategoryCard
              name="Immunization"
              count={5}
              color="border-teal-200"
              icon={<Syringe className="w-4 h-4 text-teal-500" />}
              conditions={[
                'Incomplete Primary Series',
                'Missing Boosters',
                'No BCG Scar',
                'Delayed Schedule',
                'No Records Available',
              ]}
            />
            <CategoryCard
              name="Learning"
              count={3}
              color="border-indigo-200"
              icon={<GraduationCap className="w-4 h-4 text-indigo-500" />}
              conditions={['Dyslexia', 'Dyscalculia', 'Dysgraphia']}
            />
          </div>
          <div className="mt-3 bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Total:</span> 52 conditions across 7 categories. Each
              condition is mapped to one or more ICD-10 codes for clinical interoperability and
              standardized reporting.
            </p>
          </div>
        </SectionCard>

        {/* 8. Analytics & Reports */}
        <SectionCard
          id="analytics"
          icon={<BarChart3 className="w-5 h-5" />}
          title="Analytics & Reports"
        >
          <p>
            The platform provides multi-level analytics for different user roles, from campaign-level
            metrics to population-level prevalence data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <BarChart3 className="w-5 h-5 text-indigo-600 mb-2" />
              <h4 className="font-semibold text-indigo-900 text-sm">Campaign Analytics</h4>
              <ul className="text-xs text-indigo-700 mt-2 space-y-1">
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Screening progress and coverage rates
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Module completion rates
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Review status breakdown
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Referral rates by module
                </li>
              </ul>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <PieChart className="w-5 h-5 text-emerald-600 mb-2" />
              <h4 className="font-semibold text-emerald-900 text-sm">Prevalence Reports</h4>
              <ul className="text-xs text-emerald-700 mt-2 space-y-1">
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Condition prevalence by category
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Age and gender distribution
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Geographic distribution
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Trend analysis over time
                </li>
              </ul>
            </div>
            <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
              <Microscope className="w-5 h-5 text-violet-600 mb-2" />
              <h4 className="font-semibold text-violet-900 text-sm">Cohort Analysis</h4>
              <ul className="text-xs text-violet-700 mt-2 space-y-1">
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Longitudinal tracking across years
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Treatment outcome monitoring
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Intervention effectiveness
                </li>
                <li className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Population health indicators
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* 9. Data Export */}
        <SectionCard id="data-export" icon={<FileDown className="w-5 h-5" />} title="Data Export">
          <p>
            Data can be exported in multiple formats for integration with external systems, research
            analysis, and regulatory reporting.
          </p>

          <div className="mt-3">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">JSON Export Format</h3>
            <p className="text-sm">
              The JSON export includes the complete screening record with nested structures for
              observations, annotations, and review decisions. Each record includes metadata
              (timestamps, user IDs, device info) and clinical data (chips, severity, ICD codes).
            </p>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 mt-2 text-xs font-mono overflow-x-auto">
              <pre>{`{
  "campaign": { "code": "CAM-2024-001", "school": "..." },
  "child": { "id": "...", "name": "...", "dob": "..." },
  "observations": [
    {
      "module": "dental",
      "captureType": "photo",
      "chips": [
        { "label": "Dental Caries", "icd": "K02.9", "severity": "moderate" }
      ],
      "review": { "decision": "refer", "doctor": "..." }
    }
  ]
}`}</pre>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">CSV Import Format</h3>
            <p className="text-sm">
              Children are imported via CSV with the following required columns. Additional optional
              columns can be included for enriched data.
            </p>
            <DataTable
              compact
              headers={['Column', 'Required', 'Format', 'Example']}
              rows={[
                ['name', 'Yes', 'Text', 'Aarav Sharma'],
                ['dob', 'Yes', 'YYYY-MM-DD', '2018-05-15'],
                ['gender', 'Yes', 'M / F', 'M'],
                ['class', 'Yes', 'Text / Number', '3'],
                ['section', 'No', 'Text', 'A'],
                ['parent_phone', 'No', 'Phone number', '+919876543210'],
                ['aadhaar_last4', 'No', '4 digits', '1234'],
                ['blood_group', 'No', 'Text', 'B+'],
              ]}
            />
          </div>
        </SectionCard>

        {/* 10. Troubleshooting */}
        <SectionCard
          id="troubleshooting"
          icon={<HelpCircle className="w-5 h-5" />}
          title="Troubleshooting"
        >
          <p>Technical requirements and common issues for the web dashboard.</p>

          <div className="mt-3">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Browser Requirements</h3>
            <DataTable
              compact
              headers={['Browser', 'Minimum Version', 'Recommended']}
              rows={[
                ['Google Chrome', '90+', 'Latest'],
                ['Safari', '15+', 'Latest'],
                ['Microsoft Edge', '90+', 'Latest'],
                ['Firefox', '95+', 'Latest'],
              ]}
            />
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Device Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-gray-600" />
                  <p className="font-semibold text-gray-900 text-sm">Mobile (Screening)</p>
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>Android 10+ or iOS 15+</li>
                  <li>Minimum 4 GB RAM</li>
                  <li>Rear camera 12 MP or higher</li>
                  <li>2 GB free storage</li>
                  <li>Bluetooth 4.0+ for peripherals</li>
                </ul>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-gray-600" />
                  <p className="font-semibold text-gray-900 text-sm">Desktop (Review / Admin)</p>
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>Windows 10+, macOS 12+, or Linux</li>
                  <li>Minimum 8 GB RAM</li>
                  <li>Screen resolution 1280x720 or higher</li>
                  <li>Stable internet connection</li>
                  <li>Modern browser (see table above)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Common Issues</h3>
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-900 text-sm">
                  Dashboard loads slowly or times out
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Check your internet speed (minimum 5 Mbps recommended). Clear browser cache. If
                  loading large campaigns ({'>'} 5000 children), use filters to reduce data volume. Try
                  disabling browser extensions that may interfere.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-900 text-sm">
                  Images not displaying in review
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure images have synced from the mobile device. Check the sync status for the
                  observation. Large images may take longer to load. Verify that your network allows
                  access to the image storage CDN.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-900 text-sm">
                  CSV import fails or shows validation errors
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Verify column headers match exactly: name, dob, gender, class, section. Check date
                  format is YYYY-MM-DD. Remove blank rows and special characters. Ensure the file is
                  UTF-8 encoded. Maximum 5000 rows per import.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-900 text-sm">
                  Analytics show incorrect or stale data
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Analytics are updated in near-real-time. If data appears stale, wait 2-3 minutes and
                  refresh. Check if all field devices have synced. Verify the campaign date filters are
                  set correctly.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-900 text-sm">
                  User cannot access certain features
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Verify the user's assigned role has the required permissions (see Roles & Access
                  section). Check that the user is assigned to the correct campaign. Contact an admin to
                  update role assignments if needed.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-6">
          <p>SKIDS Screen V3 Operations Manual</p>
          <p className="mt-1">
            For field-level guidance, see the{' '}
            <Link to="/docs/field-guide" className="text-indigo-600 hover:underline">
              Field Team Guide
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
