import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface LoadingSpinnerProps {
  message?: string
  /** Show a progress bar that fills over estimatedMs */
  estimatedMs?: number
}

export function LoadingSpinner({ message = 'Loading...', estimatedMs }: LoadingSpinnerProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!estimatedMs) return
    const interval = 100
    const step = (interval / estimatedMs) * 90 // cap at 90% (never show 100 until done)
    const timer = setInterval(() => {
      setProgress(prev => Math.min(90, prev + step))
    }, interval)
    return () => clearInterval(timer)
  }, [estimatedMs])

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-3 text-sm text-gray-500">{message}</p>
      {estimatedMs && (
        <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
