// M-CHAT-R/F Screening — Web implementation
// 20-question autism screening for toddlers (16-30 months)

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MCHAT_ITEMS, scoreMChat, type MChatAnswer } from '@/lib/ai/mchat-scoring'

interface MChatScreeningProps {
  onResult: (result: {
    classification: string
    confidence: number
    summary: string
    suggestedChips: string[]
  }) => void
  childAge?: number // months
}

export function MChatScreening({ onResult, childAge }: MChatScreeningProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, MChatAnswer>>({})
  const [submitted, setSubmitted] = useState(false)

  const currentItem = MCHAT_ITEMS[currentIndex]
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / MCHAT_ITEMS.length) * 100

  const domainColors: Record<string, string> = {
    social: 'bg-blue-100 text-blue-700',
    communication: 'bg-green-100 text-green-700',
    behavior: 'bg-purple-100 text-purple-700',
    sensory: 'bg-orange-100 text-orange-700',
  }

  const handleAnswer = (answer: 'yes' | 'no') => {
    const mchatAnswer: MChatAnswer = { itemId: currentItem.id, response: answer }
    setAnswers(prev => ({ ...prev, [currentItem.id]: mchatAnswer }))

    // Auto-advance to next unanswered or stay if last
    if (currentIndex < MCHAT_ITEMS.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleSubmit = () => {
    const answerList = Object.values(answers)
    if (answerList.length < MCHAT_ITEMS.length) return

    const result = scoreMChat(answerList)
    setSubmitted(true)

    const chips: string[] = []
    if (result.risk === 'high') chips.push('asd_high_risk', 'referral_needed')
    else if (result.risk === 'medium') chips.push('asd_medium_risk', 'followup_needed')

    const classification = result.risk === 'low' ? 'Low Risk'
      : result.risk === 'medium' ? 'Medium Risk — Follow-Up Needed'
      : 'High Risk — Refer Immediately'

    onResult({
      classification,
      confidence: 0.90,
      summary: `[M-CHAT-R/F] Score: ${result.totalScore}/20. Risk: ${result.risk.toUpperCase()}. ` +
        `Critical items failed: ${result.criticalFailed}. ` +
        `Domains — Social: ${result.domainScores.social}, Communication: ${result.domainScores.communication}, ` +
        `Behavior: ${result.domainScores.behavior}, Sensory: ${result.domainScores.sensory}. ` +
        (result.risk === 'high' ? 'Immediate referral for diagnostic evaluation recommended.' :
         result.risk === 'medium' ? 'Administer M-CHAT-R/F Follow-Up interview.' :
         'No follow-up needed at this time.'),
      suggestedChips: chips,
    })
  }

  if (submitted) {
    const result = scoreMChat(Object.values(answers))
    const riskColor = result.risk === 'low' ? 'text-green-600' : result.risk === 'medium' ? 'text-yellow-600' : 'text-red-600'
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <h3 className="text-lg font-bold">M-CHAT-R/F Result</h3>
          <div className={`text-4xl font-bold ${riskColor}`}>{result.totalScore}/20</div>
          <Badge variant={result.risk === 'low' ? 'default' : 'destructive'} className="text-sm">
            {result.risk.toUpperCase()} RISK
          </Badge>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Social: {result.domainScores.social}</div>
            <div>Communication: {result.domainScores.communication}</div>
            <div>Behavior: {result.domainScores.behavior}</div>
            <div>Sensory: {result.domainScores.sensory}</div>
          </div>
          {result.criticalFailed > 0 && (
            <p className="text-sm text-red-600">Critical items failed: {result.criticalFailed}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">M-CHAT-R/F Screening</h3>
        <p className="text-sm text-muted-foreground">
          Modified Checklist for Autism in Toddlers {childAge ? `(${childAge} months)` : '(16-30 months)'}
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {currentIndex + 1} of {MCHAT_ITEMS.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Current Question */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={domainColors[currentItem.domain] || ''} variant="outline">
              {currentItem.domain}
            </Badge>
            {currentItem.critical && <Badge variant="destructive" className="text-xs">Critical</Badge>}
          </div>

          <p className="text-base font-medium leading-relaxed">
            {currentItem.id}. {currentItem.text}
          </p>

          {/* Answer indicator */}
          {answers[currentItem.id] && (
            <p className="text-xs text-muted-foreground">
              Current answer: <strong>{answers[currentItem.id].response.toUpperCase()}</strong> (tap to change)
            </p>
          )}

          {/* Yes/No buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              size="lg"
              variant={answers[currentItem.id]?.response === 'yes' ? 'default' : 'outline'}
              className="h-16 text-lg"
              onClick={() => handleAnswer('yes')}
            >
              Yes
            </Button>
            <Button
              size="lg"
              variant={answers[currentItem.id]?.response === 'no' ? 'default' : 'outline'}
              className="h-16 text-lg"
              onClick={() => handleAnswer('no')}
            >
              No
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <div className="flex-1" />
        {currentIndex < MCHAT_ITEMS.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            Next
          </Button>
        ) : answeredCount === MCHAT_ITEMS.length ? (
          <Button size="sm" onClick={handleSubmit}>
            Calculate Score
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Answer all questions ({MCHAT_ITEMS.length - answeredCount} remaining)
          </Button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap gap-1 justify-center">
        {MCHAT_ITEMS.map((item, i) => (
          <button
            key={item.id}
            className={`w-6 h-6 rounded-full text-xs font-medium border transition-all ${
              i === currentIndex ? 'ring-2 ring-primary ring-offset-1' : ''
            } ${
              answers[item.id]
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-gray-200'
            }`}
            onClick={() => setCurrentIndex(i)}
          >
            {item.id}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MChatScreening
