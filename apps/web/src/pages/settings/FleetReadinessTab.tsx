import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

interface DeviceCheck {
  id: string
  label: string
  status: string
  detail?: string
}

interface DeviceEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  campaignCode: string | null
  deviceType: string
  checks: DeviceCheck[]
  overallStatus: string
  reportedAt: string
}

interface FleetSummary {
  total: number
  ready: number
  warning: number
  error: number
}

export function FleetReadinessTab() {
  const { apiCall } = useAuth()
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [summary, setSummary] = useState<FleetSummary>({ total: 0, ready: 0, warning: 0, error: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [campaignFilter, setCampaignFilter] = useState<string>('')

  const fetchFleet = useCallback(async () => {
    setLoading(true)
    try {
      const url = campaignFilter
        ? `/api/device-status/fleet?campaign=${campaignFilter}`
        : '/api/device-status/fleet'
      const res = await apiCall(url)
      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices || [])
        setSummary(data.summary || { total: 0, ready: 0, warning: 0, error: 0 })
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [apiCall, campaignFilter])

  useEffect(() => { fetchFleet() }, [fetchFleet])

  const statusColor = (status: string) => {
    switch (status) {
      case 'ready': case 'ok': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const statusEmoji = (status: string) => {
    switch (status) {
      case 'ready': case 'ok': return '\u2705'
      case 'warning': return '\u26A0\uFE0F'
      case 'error': return '\u274C'
      default: return '\u2753'
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Total Devices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{summary.ready}</div>
            <div className="text-sm text-muted-foreground">Ready</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{summary.warning}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{summary.error}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Filter by campaign code..."
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button onClick={fetchFleet} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Device Fleet Status</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-8">
              No device readiness reports yet. Reports are submitted when nurses/doctors open the readiness check before screening.
            </p>
          )}
          <div className="space-y-2">
            {devices.map(device => (
              <div key={device.id} className="border rounded-lg">
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left"
                  onClick={() => setExpandedId(expandedId === device.id ? null : device.id)}
                >
                  <div className={`w-3 h-3 rounded-full ${statusColor(device.overallStatus)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{device.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.userRole} &middot; {device.deviceType} &middot; {timeAgo(device.reportedAt)}
                    </div>
                  </div>
                  {device.campaignCode && (
                    <Badge variant="outline" className="text-xs">{device.campaignCode}</Badge>
                  )}
                  <Badge
                    variant={device.overallStatus === 'ready' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {device.overallStatus}
                  </Badge>
                </button>

                {expandedId === device.id && (
                  <div className="px-3 pb-3 border-t">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {device.checks.map(check => (
                        <div key={check.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                          <span>{statusEmoji(check.status)}</span>
                          <span className="font-medium">{check.label}</span>
                          {check.detail && <span className="text-muted-foreground ml-auto truncate max-w-[150px]">{check.detail}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Last reported: {new Date(device.reportedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
