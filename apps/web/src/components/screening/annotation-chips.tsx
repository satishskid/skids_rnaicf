
import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { AnnotationChipConfig, Severity } from '@skids/shared'
import { AIAnalysisPanel, type AIAnalysisResult } from '@/components/ai/AIAnalysisPanel'
import type { OrgConfig } from '@/lib/org-config'

interface AnnotationChipsProps {
  chips: AnnotationChipConfig[]
  selectedChips: string[]
  onToggleChip: (chipId: string) => void
  chipSeverities: Record<string, Severity>
  onSetSeverity: (chipId: string, severity: Severity) => void
  aiSuggestedChips?: string[]
  notes: string
  onNotesChange: (notes: string) => void
  onComplete: () => void
  onBack?: () => void
  // AI analysis integration
  imageDataUrl?: string
  moduleType?: string
  moduleName?: string
  childAge?: string
  orgConfig?: OrgConfig | null
  onAiSuggestChips?: (chipIds: string[]) => void
  onAiAnalysisComplete?: (result: AIAnalysisResult) => void
}

const SEVERITY_COLORS: Record<Severity, string> = {
  normal: 'bg-green-100 text-green-700 border-green-300',
  mild: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  moderate: 'bg-orange-100 text-orange-700 border-orange-300',
  severe: 'bg-red-100 text-red-700 border-red-300',
}

const SEVERITY_BG: Record<Severity, string> = {
  normal: 'bg-green-50 border-green-200 hover:bg-green-100',
  mild: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
  moderate: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
  severe: 'bg-red-50 border-red-200 hover:bg-red-100',
}

const SEVERITY_LABELS: Record<Exclude<Severity, 'normal'>, { icon: string; desc: string }> = {
  mild: { icon: '🟡', desc: 'Minor finding, monitor' },
  moderate: { icon: '🟠', desc: 'Needs attention' },
  severe: { icon: '🔴', desc: 'Urgent, refer immediately' },
}

export function AnnotationChips({
  chips,
  selectedChips,
  onToggleChip,
  chipSeverities,
  onSetSeverity,
  aiSuggestedChips = [],
  notes,
  onNotesChange,
  onComplete,
  onBack,
  imageDataUrl,
  moduleType,
  moduleName,
  childAge,
  orgConfig,
  onAiSuggestChips,
  onAiAnalysisComplete,
}: AnnotationChipsProps) {
  const [severityDrawerChip, setSeverityDrawerChip] = useState<AnnotationChipConfig | null>(null)

  // Group chips by category
  const grouped = useMemo(() => {
    const groups: Record<string, AnnotationChipConfig[]> = {}
    for (const chip of chips) {
      if (!groups[chip.category]) groups[chip.category] = []
      groups[chip.category].push(chip)
    }
    return groups
  }, [chips])

  const isAiSuggested = (chipId: string) => aiSuggestedChips.includes(chipId)
  const isSelected = (chipId: string) => selectedChips.includes(chipId)

  // Determine which categories should be open by default
  // AI-suggested categories + categories with selections auto-expand
  const defaultOpenCategories = useMemo(() => {
    const open: string[] = []
    for (const [category, categoryChips] of Object.entries(grouped)) {
      const hasAiSuggested = categoryChips.some(c => aiSuggestedChips.includes(c.id))
      const hasSelected = categoryChips.some(c => selectedChips.includes(c.id))
      if (hasAiSuggested || hasSelected) {
        open.push(category)
      }
    }
    // If nothing is suggested/selected, open the first category
    if (open.length === 0 && Object.keys(grouped).length > 0) {
      open.push(Object.keys(grouped)[0])
    }
    return open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only compute once on mount

  // Count selected chips per category
  const categorySelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [category, categoryChips] of Object.entries(grouped)) {
      counts[category] = categoryChips.filter(c => selectedChips.includes(c.id)).length
    }
    return counts
  }, [grouped, selectedChips])

  const handleChipTap = (chip: AnnotationChipConfig) => {
    const wasSelected = isSelected(chip.id)
    onToggleChip(chip.id)

    // If selecting (not deselecting) and chip has severity, open severity drawer
    if (!wasSelected && chip.severity) {
      setSeverityDrawerChip(chip)
    }
  }

  const handleSeveritySelect = (severity: Severity) => {
    if (severityDrawerChip) {
      onSetSeverity(severityDrawerChip.id, severity)
      setSeverityDrawerChip(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pb-28 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-gray-700">Clinical Findings</h3>
          <Badge variant="secondary" className="text-xs">
            {selectedChips.length} selected
          </Badge>
        </div>

        {/* AI Analysis Panel — show when image is available */}
        {imageDataUrl && moduleType && moduleName && (
          <AIAnalysisPanel
            imageDataUrl={imageDataUrl}
            moduleType={moduleType}
            moduleName={moduleName}
            childAge={childAge}
            nurseChips={selectedChips}
            chipSeverities={chipSeverities}
            availableChipIds={chips.map(c => c.id)}
            mode="nurse"
            orgConfig={orgConfig}
            onSuggestChips={onAiSuggestChips}
            onAnalysisComplete={onAiAnalysisComplete}
          />
        )}

        {/* AI suggestion banner */}
        {aiSuggestedChips.length > 0 && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-200 text-purple-800 text-[10px]">AI</Badge>
              <span className="text-xs text-purple-700 font-medium">
                {aiSuggestedChips.length} finding{aiSuggestedChips.length > 1 ? 's' : ''} detected
              </span>
            </div>
            <p className="text-xs text-purple-600">
              Tap dashed chips to confirm AI suggestions. Adjust severity as needed.
            </p>
          </div>
        )}

        {/* Accordion chip categories */}
        <Accordion
          type="multiple"
          defaultValue={defaultOpenCategories}
          className="w-full"
        >
          {Object.entries(grouped).map(([category, categoryChips]) => {
            const selectedCount = categorySelectedCounts[category] || 0
            const hasAiChips = categoryChips.some(c => aiSuggestedChips.includes(c.id))

            return (
              <AccordionItem key={category} value={category} className="border-b-0">
                <AccordionTrigger className="py-2.5 px-1 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {category}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({categoryChips.length})
                    </span>
                    {selectedCount > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 h-4 min-w-0">
                        {selectedCount}
                      </Badge>
                    )}
                    {hasAiChips && (
                      <Badge className="bg-purple-100 text-purple-700 text-[10px] px-1 py-0 h-4 min-w-0">
                        AI
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="flex flex-wrap gap-2">
                    {categoryChips.map((chip) => {
                      const selected = isSelected(chip.id)
                      const aiSuggested = isAiSuggested(chip.id)
                      const severity = chipSeverities[chip.id]

                      return (
                        <button
                          key={chip.id}
                          onClick={() => handleChipTap(chip)}
                          className={`
                            inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium
                            border transition-all cursor-pointer select-none
                            min-h-[44px] active:scale-95
                            ${selected
                              ? severity
                                ? SEVERITY_COLORS[severity]
                                : 'bg-blue-100 text-blue-700 border-blue-300'
                              : aiSuggested
                                ? 'bg-purple-50 text-purple-700 border-purple-300 border-dashed border-2'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                            }
                          `}
                        >
                          {aiSuggested && !selected && (
                            <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">
                              AI
                            </span>
                          )}
                          {selected && (
                            <span className="text-xs font-bold">✓</span>
                          )}
                          <span>{chip.label}</span>
                          {chip.locationPin && selected && (
                            <span className="text-xs" title="Tap image to pin location">📍</span>
                          )}
                          {chip.severity && selected && severity && (
                            <span className="text-[10px] opacity-75 capitalize">
                              ({severity})
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {/* Free-text notes */}
        <div className="px-1">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Additional Notes</p>
          <Textarea
            placeholder="Any additional observations..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="text-sm"
            inputMode="text"
          />
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40">
        <div className="flex gap-3 max-w-lg mx-auto">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1 h-12 text-base">
              Back
            </Button>
          )}
          <Button
            onClick={onComplete}
            className="flex-1 h-12 text-base font-semibold"
          >
            {selectedChips.length > 0
              ? `Complete · ${selectedChips.length} Finding${selectedChips.length > 1 ? 's' : ''}`
              : 'Complete — No Findings'}
          </Button>
        </div>
      </div>

      {/* Severity picker drawer (bottom sheet) */}
      <Drawer
        open={!!severityDrawerChip}
        onOpenChange={(open) => {
          if (!open) setSeverityDrawerChip(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="text-base">
              Set Severity: {severityDrawerChip?.label}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-gray-500">
              How severe is this finding?
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2.5">
            {(['mild', 'moderate', 'severe'] as Exclude<Severity, 'normal'>[]).map((sev) => (
              <button
                key={sev}
                onClick={() => handleSeveritySelect(sev)}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  active:scale-[0.98] min-h-[56px]
                  ${severityDrawerChip && chipSeverities[severityDrawerChip.id] === sev
                    ? SEVERITY_COLORS[sev] + ' border-2 ring-2 ring-offset-1 ring-current'
                    : SEVERITY_BG[sev]
                  }
                `}
              >
                <span className="text-2xl">{SEVERITY_LABELS[sev].icon}</span>
                <div className="text-left">
                  <p className="font-semibold capitalize text-base">{sev}</p>
                  <p className="text-xs opacity-75">{SEVERITY_LABELS[sev].desc}</p>
                </div>
              </button>
            ))}
            <button
              onClick={() => setSeverityDrawerChip(null)}
              className="w-full p-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 active:bg-gray-100 min-h-[44px]"
            >
              Skip — No severity
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
