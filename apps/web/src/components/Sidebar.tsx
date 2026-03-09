import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Settings,
  Heart,
  Inbox,
  Globe,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const allNavigation = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard, roles: undefined },
  { name: 'Campaigns', to: '/campaigns', icon: Megaphone, roles: undefined },
  { name: 'Doctor Inbox', to: '/doctor-inbox', icon: Inbox, roles: ['doctor', 'admin', 'ops_manager'] as string[] },
  { name: 'Population Health', to: '/authority', icon: Globe, roles: ['authority', 'admin', 'ops_manager'] as string[] },
  { name: 'Analytics', to: '/analytics', icon: BarChart3, roles: undefined },
  { name: 'Documentation', to: '/docs', icon: BookOpen, roles: ['admin', 'doctor', 'nurse', 'ops_manager'] as string[] },
  { name: 'Settings', to: '/settings', icon: Settings, roles: undefined },
]

export function Sidebar() {
  const { user } = useAuth()
  const userRole = user?.role || 'nurse'

  const navigation = allNavigation.filter(
    item => !item.roles || item.roles.includes(userRole)
  )

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Heart className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-lg font-black text-gray-900">SKIDS</span>
          <span className="ml-1 text-lg font-light text-gray-400">screen</span>
          <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
            v3
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-4 space-y-1 px-3">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Bottom branding */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4">
        <p className="text-xs text-gray-400">
          Pediatric Health Screening
        </p>
        <p className="text-xs text-gray-400">
          SKIDS Screen Platform
        </p>
      </div>
    </aside>
  )
}
