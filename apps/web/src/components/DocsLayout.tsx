import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Rocket,
  ClipboardList,
  BookMarked,
  Wrench,
  Stethoscope,
  ArrowLeft,
  Heart,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const ALLOWED_ROLES = new Set(['admin', 'doctor', 'nurse', 'ops_manager'])

const NAV_ITEMS = [
  { to: '/docs', label: 'Overview', icon: BookOpen, end: true },
  { to: '/docs/field-guide', label: 'Field Team Guide', icon: ClipboardList, end: false },
  { to: '/docs/quick-start', label: 'Quick Start & Manual', icon: Rocket, end: false },
  { to: '/docs/ops-manual', label: 'Operations Manual', icon: BookMarked, end: false },
  { to: '/docs/tech-manual', label: 'Technical Manual', icon: Wrench, end: false },
  { to: '/docs/clinical-reference', label: 'Clinical Reference', icon: Stethoscope, end: false },
]

export function DocsLayout() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!ALLOWED_ROLES.has(user?.role || '')) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-8">
        <BookOpen className="mb-4 h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
        <p className="mt-2 text-sm text-gray-500">
          Documentation is available for admin, doctor, and nurse roles.
        </p>
        <NavLink
          to="/"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </NavLink>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </NavLink>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <Heart className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">SKIDS Docs</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">v3.0</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 lg:block">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Content */}
        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
