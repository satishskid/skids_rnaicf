
import React from 'react'
import { AuscultationPoint } from '@/lib/ai/auscultation'

interface BodyDiagramProps {
  points: AuscultationPoint[]
  recordedPoints: Set<string>
  activePoint: string | null
  onSelectPoint: (pointId: string) => void
  view: 'anterior' | 'posterior'
}

export function BodyDiagram({ points, recordedPoints, activePoint, onSelectPoint, view }: BodyDiagramProps) {
  const filteredPoints = points.filter(p => p.side === view)

  return (
    <div className="relative w-full aspect-[3/4] max-w-[280px] mx-auto">
      {/* Body outline SVG */}
      <svg viewBox="0 0 100 130" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.5">
        {/* Head */}
        <ellipse cx="50" cy="10" rx="10" ry="10" className="fill-gray-100 stroke-gray-300" />
        {/* Neck */}
        <rect x="46" y="18" width="8" height="6" className="fill-gray-100 stroke-gray-300" rx="2" />
        {/* Torso */}
        <path d="M30 24 L70 24 L68 75 L32 75 Z" className="fill-gray-50 stroke-gray-300" />
        {/* Shoulders */}
        <path d="M30 24 Q25 24 22 30 L22 45 Q22 48 25 48 L30 48" className="fill-gray-50 stroke-gray-300" />
        <path d="M70 24 Q75 24 78 30 L78 45 Q78 48 75 48 L70 48" className="fill-gray-50 stroke-gray-300" />
        {/* Arms */}
        <path d="M22 48 L18 80 L22 80 L26 48" className="fill-gray-50 stroke-gray-300" />
        <path d="M78 48 L82 80 L78 80 L74 48" className="fill-gray-50 stroke-gray-300" />
        {/* Legs */}
        <path d="M35 75 L33 120 L40 120 L42 75" className="fill-gray-50 stroke-gray-300" />
        <path d="M58 75 L56 120 L63 120 L65 75" className="fill-gray-50 stroke-gray-300" />

        {/* Rib guides for reference */}
        {view === 'anterior' && (
          <>
            <line x1="35" y1="30" x2="65" y2="30" className="stroke-gray-200" strokeDasharray="2,2" />
            <line x1="34" y1="38" x2="66" y2="38" className="stroke-gray-200" strokeDasharray="2,2" />
            <line x1="33" y1="46" x2="67" y2="46" className="stroke-gray-200" strokeDasharray="2,2" />
            <line x1="33" y1="54" x2="67" y2="54" className="stroke-gray-200" strokeDasharray="2,2" />
          </>
        )}
        {view === 'posterior' && (
          <>
            <line x1="50" y1="26" x2="50" y2="70" className="stroke-gray-200" strokeDasharray="2,2" />
            <line x1="35" y1="35" x2="65" y2="35" className="stroke-gray-200" strokeDasharray="2,2" />
            <line x1="34" y1="50" x2="66" y2="50" className="stroke-gray-200" strokeDasharray="2,2" />
          </>
        )}

        {/* View label */}
        <text x="50" y="128" textAnchor="middle" className="fill-gray-400 text-[4px]">
          {view === 'anterior' ? 'ANTERIOR' : 'POSTERIOR'}
        </text>
      </svg>

      {/* Auscultation points overlay */}
      {filteredPoints.map(point => {
        const isRecorded = recordedPoints.has(point.id)
        const isActive = activePoint === point.id

        return (
          <button
            key={point.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full transition-all
              ${isActive
                ? 'w-8 h-8 bg-blue-500 ring-4 ring-blue-200 z-20'
                : isRecorded
                  ? 'w-6 h-6 bg-green-500 ring-2 ring-green-200 z-10'
                  : 'w-6 h-6 bg-orange-400 ring-2 ring-orange-200 hover:ring-orange-300 hover:w-7 hover:h-7 z-10'
              }
              flex items-center justify-center`}
            style={{ left: `${point.x}%`, top: `${(point.y / 130) * 100}%` }}
            onClick={() => onSelectPoint(point.id)}
          >
            {isRecorded ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span className="text-white text-[8px] font-bold">{point.shortLabel.charAt(0)}</span>
            )}
          </button>
        )
      })}

      {/* Point labels */}
      {filteredPoints.map(point => (
        <div
          key={`label-${point.id}`}
          className="absolute text-[9px] text-gray-500 whitespace-nowrap pointer-events-none"
          style={{
            left: `${point.x}%`,
            top: `${(point.y / 130) * 100 + 5}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {point.shortLabel}
        </div>
      ))}
    </div>
  )
}
