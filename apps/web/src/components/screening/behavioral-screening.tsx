// Behavioral Assessment — Web port of mobile BehavioralForm
// Observation checklist for ASD/ADHD screening

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BEHAVIORAL_TASKS, getBehavioralTasksForAge, generateBehavioralAssessment,
} from '@/lib/ai/behavioral-assessment'

interface BehavioralScreeningProps {
  onResult: (result: {
    classification: string
    confidence: number
    summary: string
    suggestedChips: string[]
  }) => void
  childAge?: number // months
}

type ObservedLevel = 'not_observed' | 'absent' | 'emerging' | 'present'

const OBS_OPTIONS: { level: ObservedLevel; label: string; score: number; color: string }[] = [
  { level: 'not_observed', label: 'N/A', score: -1, color: '#94a3b8' },
  { level: 'absent', label: 'Absent', score: 0, color: '#ef4444' },
  { level: 'emerging', label: 'Emerging', score: 0.5, color: '#f59e0b' },
  { level: 'present', label: 'Present', score: 1, color: '#22c55e' },
]

export function BehavioralScreening({ onResult, childAge }: BehavioralScreeningProps) {
  const tasks = childAge ? getBehavioralTasksForAge(childAge) : BEHAVIORAL_TASKS
  const [observations, setObservations] = useState<Record<string, ObservedLevel>>(
    Object.fromEntries(tasks.map(t => [t.id, 'not_observed']))
  )
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>(
    Object.fromEntries(tasks.map(t => [t.id, '']))
  )
  const [submitted, setSubmitted] = useState(false)

  const observedCount = Object.values(observations).filter(o => o !== 'not_observed').length

  const handleSubmit = () => {
    const taskScores = tasks
      .filter(t => observations[t.id] !== 'not_observed')
      .map(t => {
        const scoreVal = OBS_OPTIONS.find(o => o.level === observations[t.id])?.score ?? 0
        return {
          taskId: t.id,
          score: scoreVal,
          concern: scoreVal < 0.5,
          details: taskNotes[t.id]?.trim() || `Observed: ${observations[t.id]}`,
          confidence: 0.8,
        }
      })

    if (taskScores.length === 0) return

    const result = generateBehavioralAssessment(taskScores, childAge || 36)

    const chips: string[] = []
    if (result.compositeScore < 0.3) chips.push('behavioral_concern', 'asd_risk')
    else if (result.compositeScore < 0.6) chips.push('behavioral_concern')
    if (result.socialCommunicationScore < 0.4) chips.push('social_interaction_concern')
    if (result.restrictedBehaviorScore < 0.4) chips.push('restricted_behavior_concern')

    const classification = result.combinedRisk === 'low' ? 'Age Appropriate'
      : result.combinedRisk === 'medium' ? 'Mild Concern' : 'Behavioral Concern'

    setSubmitted(true)
    onResult({
      classification,
      confidence: 0.85,
      summary: `[Behavioral] Composite: ${Math.round(result.compositeScore * 100)}%. ` +
        `Social/Communication: ${Math.round(result.socialCommunicationScore * 100)}%. ` +
        `Restricted behaviors: ${Math.round(result.restrictedBehaviorScore * 100)}%. ` +
        `${taskScores.length} behaviors observed. ` +
        (result.recommendations.length > 0 ? result.recommendations[0] : ''),
      suggestedChips: chips,
    })
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-bold">Behavioral Assessment</h3>
          <p className="text-sm text-muted-foreground mt-2">No age-appropriate behavioral tasks available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Behavioral Assessment</h3>
        <p className="text-sm text-muted-foreground">
          Observe each behavior and rate ({observedCount}/{tasks.length} observed)
        </p>
      </div>

      {tasks.map(task => (
        <Card key={task.id} className={submitted ? 'opacity-70' : ''}>
          <CardContent className="p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-sm">{task.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
              {task.instructions?.[0] && (
                <p className="text-xs text-muted-foreground italic mt-1">{task.instructions[0]}</p>
              )}
            </div>

            {/* Observation level buttons */}
            <div className="grid grid-cols-4 gap-2">
              {OBS_OPTIONS.map(opt => {
                const isSelected = observations[task.id] === opt.level
                return (
                  <button
                    key={opt.level}
                    className={`py-2 px-1 rounded-md border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-2 font-bold'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                    style={isSelected ? { borderColor: opt.color, color: opt.color, backgroundColor: opt.color + '15' } : {}}
                    onClick={() => setObservations(prev => ({ ...prev, [task.id]: opt.level }))}
                    disabled={submitted}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Optional note */}
            {observations[task.id] !== 'not_observed' && !submitted && (
              <input
                type="text"
                className="w-full border rounded-md px-3 py-1.5 text-sm"
                placeholder="Brief note (optional)"
                value={taskNotes[task.id]}
                onChange={e => setTaskNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {observedCount > 0 && !submitted && (
        <Button className="w-full" onClick={handleSubmit}>
          Analyze Behavior ({observedCount} observations)
        </Button>
      )}
    </div>
  )
}
