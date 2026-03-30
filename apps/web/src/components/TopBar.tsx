import { LogOut, User, Bell, Shield } from 'lucide-react'
import { useAuth } from '../lib/auth'

const ROLE_TITLES: Record<string, string> = {
  admin: 'Admin Command Center',
  ops_manager: 'Operations Dashboard',
  doctor: 'Doctor Dashboard',
  nurse: 'Screening Dashboard',
  authority: 'Authority Analytics',
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  ops_manager: { label: 'Ops', color: 'bg-amber-100 text-amber-700' },
  doctor: { label: 'Doctor', color: 'bg-blue-100 text-blue-700' },
  nurse: { label: 'Nurse', color: 'bg-green-100 text-green-700' },
  authority: { label: 'Authority', color: 'bg-purple-100 text-purple-700' },
}

export function TopBar() {
  const { user, signOut } = useAuth()
  const role = user?.role || 'nurse'
  const title = ROLE_TITLES[role] || 'SKIDS Screen'
  const badge = ROLE_BADGES[role]

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-gray-700">
          {title}
        </h2>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
              {user?.name ?? 'Doctor'}
            </p>
            <p className="text-xs text-gray-500">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={signOut}
            className="ml-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
