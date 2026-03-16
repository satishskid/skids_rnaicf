import { useState } from 'react'
import { LayoutDashboard, Building, Shield, User, Key, Bot } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Tabs } from '@/components/ui'
import { OverviewTab } from './OverviewTab'
import { OrganizationTab } from './OrganizationTab'
import { SecurityTab } from './SecurityTab'
import { PreferencesTab } from './PreferencesTab'
import { AIDevicesTab } from './AIDevicesTab'

type SettingsTab = 'overview' | 'organization' | 'security' | 'preferences' | 'ai-devices'

const ADMIN_TABS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'organization', label: 'Organization', icon: Building },
  { id: 'security', label: 'Security & Users', icon: Shield },
  { id: 'ai-devices', label: 'AI & Devices', icon: Bot },
  { id: 'preferences', label: 'Preferences', icon: User },
]

const USER_TABS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'preferences', label: 'Profile & Preferences', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'organization', label: 'AI Keys', icon: Key },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  ops_manager: 'Operations Manager',
  doctor: 'Doctor',
  nurse: 'Nurse',
  authority: 'Authority',
}

export function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'ops_manager'
  const userRole = user?.role || 'nurse'

  const tabs = isAdmin ? ADMIN_TABS : USER_TABS
  const defaultTab: SettingsTab = isAdmin ? 'overview' : 'preferences'
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? 'Command Center' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? 'Operations overview, AI configuration, and platform settings.'
            : 'Manage your profile, preferences, and security settings.'}
        </p>
      </div>

      {/* Tab navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && isAdmin && <OverviewTab />}
      {activeTab === 'organization' && <OrganizationTab isAdmin={isAdmin} />}
      {activeTab === 'security' && <SecurityTab isAdmin={isAdmin} />}
      {activeTab === 'ai-devices' && <AIDevicesTab />}
      {activeTab === 'preferences' && <PreferencesTab />}

      {/* Version Footer */}
      <div className="rounded-lg bg-muted p-4 text-center">
        <p className="text-xs text-muted-foreground">
          SKIDS Screen v3.0 &mdash; {ROLE_LABELS[userRole] || userRole} Dashboard
        </p>
        <p className="text-xs text-muted-foreground">
          API: skids-api.satish-9f4.workers.dev
        </p>
      </div>
    </div>
  )
}
