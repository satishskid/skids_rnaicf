/**
 * ConsentGate — Blocks screening until parent/guardian consent is confirmed.
 * Shows consent status and allows nurse to record consent before proceeding.
 * Consent can be: paper-based (nurse confirms they have signed form) or digital.
 */

import { useState } from 'react'
import { Shield, CheckCircle2, AlertTriangle, FileCheck } from 'lucide-react'

interface ConsentGateProps {
  childName: string
  childId: string
  campaignCode: string
  /** Called when consent is confirmed — allows screening to proceed */
  onConsentConfirmed: () => void
  /** If consent was previously recorded */
  existingConsent?: { type: string; recordedAt: string; recordedBy: string } | null
}

export function ConsentGate({
  childName,
  childId,
  campaignCode,
  onConsentConfirmed,
  existingConsent,
}: ConsentGateProps) {
  const [consentType, setConsentType] = useState<'paper' | 'verbal' | 'digital' | null>(
    existingConsent ? (existingConsent.type as 'paper' | 'verbal' | 'digital') : null
  )
  const [confirmed, setConfirmed] = useState(!!existingConsent)
  const [guardianName, setGuardianName] = useState('')

  if (confirmed || existingConsent) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <div>
          <p className="text-xs font-semibold text-green-800">Consent Recorded</p>
          <p className="text-[10px] text-green-600">
            {existingConsent
              ? `${existingConsent.type} consent — ${new Date(existingConsent.recordedAt).toLocaleDateString()}`
              : `${consentType} consent confirmed`}
            {guardianName && ` — Guardian: ${guardianName}`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <h3 className="text-base font-bold text-amber-900">Consent Required</h3>
          <p className="mt-1 text-sm text-amber-800">
            Before screening <strong>{childName}</strong>, parent/guardian consent must be recorded.
          </p>

          {/* Consent type selection */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700">How was consent obtained?</p>
            <div className="flex gap-2">
              {([
                { value: 'paper', label: 'Signed Paper Form', icon: '📄' },
                { value: 'verbal', label: 'Verbal Consent', icon: '🗣️' },
                { value: 'digital', label: 'Digital (SMS/App)', icon: '📱' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConsentType(opt.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    consentType === opt.value
                      ? 'border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                      : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span>{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Guardian name (optional) */}
          {consentType && (
            <div className="mt-3">
              <label className="text-xs font-medium text-amber-700">Guardian Name (optional)</label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Parent/guardian who gave consent"
                className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

          {/* Confirm button */}
          {consentType && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setConfirmed(true)
                  // Store consent locally for this screening session
                  try {
                    const key = `consent-${campaignCode}-${childId}`
                    localStorage.setItem(key, JSON.stringify({
                      type: consentType,
                      guardianName: guardianName || undefined,
                      recordedAt: new Date().toISOString(),
                    }))
                  } catch { /* ignore */ }
                  onConsentConfirmed()
                }}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
              >
                <FileCheck className="h-4 w-4" />
                Confirm Consent & Start Screening
              </button>
              <p className="text-[10px] text-amber-500">
                By confirming, you attest that valid consent was obtained.
              </p>
            </div>
          )}

          {/* Warning */}
          {!consentType && (
            <div className="mt-4 flex items-center gap-2 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Screening cannot proceed without documented consent.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
