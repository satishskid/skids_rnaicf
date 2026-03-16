import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Megaphone,
  TrendingUp,
  Users,
  CheckCircle2,
  UserCheck,
  Activity,
  RefreshCw,
  ArrowRight,
  BarChart3,
  BookOpen,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui'
import { StatsCard } from '@/components/StatsCard'
import { useApi } from '@/lib/hooks'

// ── Types ──────────────────────────────────────────

interface CampaignRow {
  code: string
  name: string
  status: string
  totalChildren?: number
}

interface CampaignsResponse {
  campaigns: CampaignRow[]
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  hasPin: boolean
}

interface AdminUsersResponse {
  users: AdminUser[]
}

interface HealthCheck {
  status: string
  latencyMs: number
  details?: Record<string, unknown>
}

interface DetailedHealth {
  status: string
  version: string
  environment: string
  timestamp: string
  checks: Record<string, HealthCheck>
}

// ── Component ──────────────────────────────────────

export function OverviewTab() {
  const navigate = useNavigate()

  // Fetch campaigns and users
  const { data: campaignData } = useApi<CampaignsResponse>('/api/campaigns')
  const { data: userData } = useApi<AdminUsersResponse>('/api/admin/users')

  // System health (separate for refresh)
  const [health, setHealth] = useState<DetailedHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  async function fetchHealth() {
    setHealthLoading(true)
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/health/detailed`)
      setHealth(await res.json())
    } catch {
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const campaigns = campaignData?.campaigns ?? []
  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const totalChildren = campaigns.reduce((sum, c) => sum + (c.totalChildren ?? 0), 0)
  const users = userData?.users ?? []
  const completedRate =
    campaigns.length > 0
      ? Math.round(
          (campaigns.filter((c) => c.status === 'completed').length / campaigns.length) * 100
        )
      : 0

  // User role breakdown
  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 mt-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Campaigns"
          value={campaigns.length}
          icon={Megaphone}
          color="blue"
        />
        <StatsCard
          title="Active"
          value={activeCampaigns.length}
          subtitle="Currently running"
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Children Enrolled"
          value={totalChildren.toLocaleString()}
          icon={Users}
          color="purple"
        />
        <StatsCard
          title="Platform Users"
          value={users.length}
          subtitle={Object.entries(roleCounts)
            .map(([r, c]) => `${c} ${r}${c > 1 ? 's' : ''}`)
            .join(', ')}
          icon={UserCheck}
          color="orange"
        />
        <StatsCard
          title="Completion"
          value={`${completedRate}%`}
          subtitle={`${campaigns.filter((c) => c.status === 'completed').length} of ${campaigns.length}`}
          icon={CheckCircle2}
          color="yellow"
        />
      </div>

      {/* Two-column: Quick Actions + System Health */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to key management areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <QuickLink
                icon={Users}
                label="User Management"
                desc="Create users, manage PINs & passwords"
                onClick={() => navigate('/admin/users')}
              />
              <QuickLink
                icon={Megaphone}
                label="Campaign Management"
                desc="Create and manage screening campaigns"
                onClick={() => navigate('/campaigns')}
              />
              <QuickLink
                icon={BarChart3}
                label="Analytics"
                desc="Population health insights & reports"
                onClick={() => navigate('/analytics')}
              />
              <QuickLink
                icon={BookOpen}
                label="Documentation"
                desc="Guides, manuals & clinical reference"
                onClick={() => navigate('/docs')}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>API and service status</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchHealth} disabled={healthLoading}>
                <RefreshCw
                  className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {health ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      health.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-sm font-medium capitalize">{health.status}</span>
                  <Badge variant="secondary">v{health.version}</Badge>
                  <Badge variant="outline">{health.environment}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(health.checks).map(([name, check]) => (
                    <div key={name} className="rounded-lg bg-muted p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize">{name}</span>
                        <Badge
                          variant={
                            check.status === 'ok'
                              ? 'success'
                              : check.status === 'not_configured'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {check.status}
                        </Badge>
                      </div>
                      {check.latencyMs > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {check.latencyMs}ms
                        </p>
                      )}
                      {check.details && typeof check.details === 'object' && (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(check.details).map(([k, v]) => (
                            <div key={k} className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {healthLoading ? 'Checking system health...' : 'Unable to connect to API.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Last 5 campaigns across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Campaign</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Children</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 5).map((c) => (
                    <tr
                      key={c.code}
                      className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/campaigns/${c.code}`)}
                    >
                      <td className="py-2.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.code}</p>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            c.status === 'active'
                              ? 'success'
                              : c.status === 'completed'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {c.totalChildren ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────

function QuickLink({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent cursor-pointer"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
}
