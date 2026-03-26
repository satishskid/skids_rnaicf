
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'

// ── Intervention definitions ──────────────────

interface InterventionDef {
  id: string
  label: string
  category: string
  icdCode?: string
}

const INTERVENTION_CATEGORIES: { name: string; color: string; items: InterventionDef[] }[] = [
  {
    name: 'Supplementation',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    items: [
      { id: 'iv_s1', label: 'IFA Tablets (Iron+Folic Acid)', category: 'Supplementation' },
      { id: 'iv_s2', label: 'Vitamin A Dose', category: 'Supplementation' },
      { id: 'iv_s3', label: 'Zinc Supplement', category: 'Supplementation' },
      { id: 'iv_s4', label: 'Calcium Supplement', category: 'Supplementation' },
      { id: 'iv_s5', label: 'ORS + Zinc (diarrhea)', category: 'Supplementation' },
      { id: 'iv_s6', label: 'Therapeutic Food (RUTF/RUSF)', category: 'Supplementation' },
    ],
  },
  {
    name: 'Fortification',
    color: 'bg-green-100 text-green-700 border-green-200',
    items: [
      { id: 'iv_f1', label: 'Fortified Rice', category: 'Fortification' },
      { id: 'iv_f2', label: 'Fortified Wheat Flour', category: 'Fortification' },
      { id: 'iv_f3', label: 'Fortified Oil', category: 'Fortification' },
      { id: 'iv_f4', label: 'Fortified Milk', category: 'Fortification' },
      { id: 'iv_f5', label: 'Double-Fortified Salt', category: 'Fortification' },
    ],
  },
  {
    name: 'Deworming',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    items: [
      { id: 'iv_d1', label: 'Albendazole (NDD)', category: 'Deworming' },
      { id: 'iv_d2', label: 'Mebendazole', category: 'Deworming' },
    ],
  },
  {
    name: 'Feeding Programs',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    items: [
      { id: 'iv_p1', label: 'PMPOSHAN (Mid-Day Meal)', category: 'Feeding Programs' },
      { id: 'iv_p2', label: 'ICDS Take-Home Ration', category: 'Feeding Programs' },
      { id: 'iv_p3', label: 'Supplementary Nutrition (SNP)', category: 'Feeding Programs' },
      { id: 'iv_p4', label: 'Community Kitchen', category: 'Feeding Programs' },
    ],
  },
  {
    name: 'Clinical',
    color: 'bg-red-100 text-red-700 border-red-200',
    items: [
      { id: 'iv_c1', label: 'OTP (Outpatient Therapeutic)', category: 'Clinical' },
      { id: 'iv_c2', label: 'NRC (Nutrition Rehab Centre)', category: 'Clinical' },
      { id: 'iv_c3', label: 'Growth Monitoring', category: 'Clinical' },
      { id: 'iv_c4', label: 'Referral to PHC', category: 'Clinical' },
    ],
  },
]

type InterventionStatus = 'not_started' | 'active' | 'completed' | 'discontinued'
type InterventionFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'one_time'

interface InterventionEntry {
  chipId: string
  name: string
  category: string
  status: InterventionStatus
  startDate: string
  frequency: InterventionFrequency
  notes: string
}

// ── Component ──────────────────────────────────

export function InterventionScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  const [interventions, setInterventions] = useState<InterventionEntry[]>([])
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Supplementation')
  const [globalNotes, setGlobalNotes] = useState('')

  const allItems = INTERVENTION_CATEGORIES.flatMap(c => c.items)
  const activeIds = new Set(interventions.map(i => i.chipId))

  const addIntervention = (item: InterventionDef) => {
    if (activeIds.has(item.id)) {
      // Remove it
      setInterventions(prev => prev.filter(i => i.chipId !== item.id))
    } else {
      // Add with defaults
      setInterventions(prev => [...prev, {
        chipId: item.id,
        name: item.label,
        category: item.category,
        status: 'active',
        startDate: new Date().toISOString().split('T')[0],
        frequency: 'daily',
        notes: '',
      }])
    }
  }

  const updateIntervention = (chipId: string, updates: Partial<InterventionEntry>) => {
    setInterventions(prev => prev.map(i => i.chipId === chipId ? { ...i, ...updates } : i))
  }

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Intervention Tracking for {childName}</AlertTitle>
            <AlertDescription>
              <p className="text-sm mt-1">Record ongoing nutrition interventions: supplementation, fortification, deworming, feeding programs, and clinical referrals.</p>
            </AlertDescription></Alert>
          <Button className="w-full" onClick={() => setStep(1)}>Start Assessment</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          Interventions
          <Badge variant="outline" className="text-xs font-normal">{childName}</Badge>
          {interventions.length > 0 && (
            <Badge className="bg-blue-600 text-xs">{interventions.length} active</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Intervention Categories (accordion-style) ── */}
        {INTERVENTION_CATEGORIES.map(cat => (
          <div key={cat.name} className="border rounded-lg overflow-hidden">
            <button
              className={`w-full flex items-center justify-between p-3 text-left text-sm font-medium ${cat.color}`}
              onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
            >
              <span>{cat.name}</span>
              <div className="flex items-center gap-2">
                {interventions.filter(i => i.category === cat.name).length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {interventions.filter(i => i.category === cat.name).length}
                  </Badge>
                )}
                {expandedCategory === cat.name
                  ? <Icons.ChevronDown className="w-4 h-4" />
                  : <Icons.ChevronRight className="w-4 h-4" />}
              </div>
            </button>

            {expandedCategory === cat.name && (
              <div className="p-3 space-y-2 bg-white">
                {/* Chip selector */}
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map(item => (
                    <Badge
                      key={item.id}
                      variant={activeIds.has(item.id) ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs transition-colors ${
                        activeIds.has(item.id) ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => addIntervention(item)}
                    >
                      {activeIds.has(item.id) && <Icons.Check className="w-3 h-3 mr-1" />}
                      {item.label}
                    </Badge>
                  ))}
                </div>

                {/* Detail fields for selected interventions */}
                {interventions.filter(i => i.category === cat.name).map(intervention => (
                  <Card key={intervention.chipId} className="border-blue-100 bg-blue-50/50 mt-2">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">{intervention.name}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Status</Label>
                          <Select
                            value={intervention.status}
                            onValueChange={v => updateIntervention(intervention.chipId, { status: v as InterventionStatus })}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="discontinued">Discontinued</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Start Date</Label>
                          <Input
                            type="date"
                            value={intervention.startDate}
                            onChange={e => updateIntervention(intervention.chipId, { startDate: e.target.value })}
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Frequency</Label>
                          <Select
                            value={intervention.frequency}
                            onValueChange={v => updateIntervention(intervention.chipId, { frequency: v as InterventionFrequency })}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="one_time">One-time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}

        <Separator />

        {/* Global notes */}
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            rows={2}
            placeholder="e.g., receiving IFA every Monday at school, deworming done on NDD..."
            value={globalNotes}
            onChange={e => setGlobalNotes(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>

        {/* Summary */}
        {interventions.length > 0 && (
          <div className="text-xs text-gray-500">
            {interventions.filter(i => i.status === 'active').length} active,{' '}
            {interventions.filter(i => i.status === 'completed').length} completed,{' '}
            {interventions.filter(i => i.status === 'not_started').length} not started
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
            <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              const activeCount = interventions.filter(i => i.status === 'active').length
              const clinicalCount = interventions.filter(i => i.category === 'Clinical' && i.status === 'active').length
              const riskCategory = clinicalCount > 0 ? 'high_risk' : activeCount === 0 ? 'possible_risk' : 'no_risk'
              const chipIds = interventions.map(i => i.chipId)
              onComplete({
                moduleType: 'intervention',
                interventions,
                notes: globalNotes,
                riskCategory,
                summaryText: `${interventions.length} intervention(s): ${interventions.filter(i => i.status === 'active').map(i => i.name).join(', ') || 'none active'}`,
                annotationData: { selectedChips: chipIds, chipSeverities: {} },
              })
            }}
          >
            Save Interventions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
