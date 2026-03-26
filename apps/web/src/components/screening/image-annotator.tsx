
import React, { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AnnotationPin, Severity } from '@skids/shared'

interface ImageAnnotatorProps {
  imageSrc: string // base64 or URL
  pins: AnnotationPin[]
  onAddPin: (pin: AnnotationPin) => void
  onRemovePin: (pinId: string) => void
  activeLabel?: string // label from currently selected chip to apply to new pins
  activeSeverity?: Severity
  onCapture?: () => void // trigger camera capture
  className?: string
}

const SEVERITY_PIN_COLORS: Record<Severity, string> = {
  normal: '#22c55e',
  mild: '#eab308',
  moderate: '#f97316',
  severe: '#ef4444',
}

export function ImageAnnotator({
  imageSrc,
  pins,
  onAddPin,
  onRemovePin,
  activeLabel,
  activeSeverity,
  className = '',
}: ImageAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPinTooltip, setShowPinTooltip] = useState<string | null>(null)

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!activeLabel) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      const pin: AnnotationPin = {
        id: `pin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        label: activeLabel,
        severity: activeSeverity,
      }
      onAddPin(pin)
    },
    [activeLabel, activeSeverity, onAddPin]
  )

  return (
    <div className={`relative ${className}`}>
      {/* Instructions */}
      {activeLabel && (
        <div className="mb-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 text-center">
          Tap on image to pin location for: <strong>{activeLabel}</strong>
        </div>
      )}

      {/* Image container */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg border-2 ${
          activeLabel ? 'border-blue-400 cursor-crosshair' : 'border-gray-200'
        }`}
        onClick={handleImageClick}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="Captured evidence"
            className="w-full h-auto block"
            draggable={false}
          />
        ) : (
          <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-400">
            No image captured
          </div>
        )}

        {/* Pins overlay */}
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="absolute transform -translate-x-1/2 -translate-y-full"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            {/* Pin marker */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowPinTooltip(showPinTooltip === pin.id ? null : pin.id)
              }}
              className="relative flex flex-col items-center"
            >
              <svg
                width="24"
                height="32"
                viewBox="0 0 24 32"
                className="drop-shadow-md"
              >
                <path
                  d="M12 0C5.373 0 0 5.373 0 12c0 8 12 20 12 20s12-12 12-20C24 5.373 18.627 0 12 0z"
                  fill={pin.severity ? SEVERITY_PIN_COLORS[pin.severity] : '#3b82f6'}
                />
                <circle cx="12" cy="11" r="5" fill="white" opacity="0.9" />
              </svg>
            </button>

            {/* Tooltip */}
            {showPinTooltip === pin.id && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white border rounded-lg shadow-lg p-2 min-w-[140px] z-20">
                <p className="text-xs font-medium text-gray-800">{pin.label}</p>
                {pin.severity && (
                  <p className="text-xs text-gray-500 capitalize">{pin.severity}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 text-xs text-red-600 h-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemovePin(pin.id)
                    setShowPinTooltip(null)
                  }}
                >
                  Remove Pin
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pin count */}
      {pins.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{pins.length} location{pins.length > 1 ? 's' : ''} marked</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-500 h-6"
            onClick={() => pins.forEach((p) => onRemovePin(p.id))}
          >
            Clear All Pins
          </Button>
        </div>
      )}
    </div>
  )
}
