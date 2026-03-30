/**
 * ConfidenceBadge — Shows AI confidence level as a colored badge.
 * Used on every AI-generated finding to indicate reliability.
 */

interface ConfidenceBadgeProps {
  /** Confidence score 0-1 */
  confidence: number
  /** Show numeric percentage */
  showPercent?: boolean
  className?: string
}

function getConfidenceLevel(score: number): { label: string; color: string; textColor: string } {
  if (score >= 0.9) return { label: 'High', color: 'bg-green-100', textColor: 'text-green-700' }
  if (score >= 0.7) return { label: 'Medium', color: 'bg-blue-100', textColor: 'text-blue-700' }
  if (score >= 0.5) return { label: 'Low', color: 'bg-amber-100', textColor: 'text-amber-700' }
  return { label: 'Very Low', color: 'bg-red-100', textColor: 'text-red-700' }
}

export function ConfidenceBadge({ confidence, showPercent = true, className = '' }: ConfidenceBadgeProps) {
  const { label, color, textColor } = getConfidenceLevel(confidence)
  const pct = Math.round(confidence * 100)

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${color} ${textColor} ${className}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{
        backgroundColor: confidence >= 0.9 ? '#22c55e' : confidence >= 0.7 ? '#3b82f6' : confidence >= 0.5 ? '#f59e0b' : '#ef4444',
      }} />
      {showPercent ? `${pct}%` : label}
    </span>
  )
}
