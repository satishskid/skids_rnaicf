import { Link } from 'react-router-dom'
import {
  Rocket,
  ClipboardList,
  BookMarked,
  Wrench,
  Stethoscope,
  BookOpen,
} from 'lucide-react'

const DOC_CARDS = [
  {
    to: '/docs/quick-start',
    icon: Rocket,
    title: 'Quick Start & User Manual',
    description:
      'Architecture overview, role-based guides, AI capabilities, and FAQ for every user.',
    audience: 'For All Users',
    color: 'bg-orange-100 text-orange-600',
  },
  {
    to: '/docs/field-guide',
    icon: ClipboardList,
    title: 'Field Team Guide',
    description:
      'Step-by-step screening workflows, device setup, offline sync, and troubleshooting for field teams.',
    audience: 'For Nurses & Field Staff',
    color: 'bg-green-100 text-green-600',
  },
  {
    to: '/docs/ops-manual',
    icon: BookMarked,
    title: 'Operations Manual',
    description:
      'Campaign planning, user management, analytics dashboards, and reporting workflows.',
    audience: 'For Ops & Program Teams',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    to: '/docs/tech-manual',
    icon: Wrench,
    title: 'Technical Manual',
    description:
      'API reference, database schema, deployment pipelines, and infrastructure documentation.',
    audience: 'For Engineers & DevOps',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    to: '/docs/clinical-reference',
    icon: Stethoscope,
    title: 'Clinical Reference',
    description:
      'Module-level screening criteria, grading scales, referral logic, and condition definitions.',
    audience: 'For Doctors & Clinicians',
    color: 'bg-red-100 text-red-600',
  },
]

const STATS = [
  { label: 'Screening Modules', value: '27+' },
  { label: 'Conditions Covered', value: '52' },
  { label: 'Categories', value: '7' },
  { label: 'User Roles', value: '5' },
]

export function DocsHubPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
          <BookOpen className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          SKIDS Screen Documentation
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
          Comprehensive guides for the School Kids Development Screening
          platform &mdash; from field operations to clinical reference and
          technical architecture.
        </p>
      </div>

      {/* Doc Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2 ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
              {card.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {card.description}
            </p>
            <span className="mt-3 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {card.audience}
            </span>
          </Link>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center"
          >
            <p className="text-2xl font-bold text-blue-600">{stat.value}</p>
            <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
