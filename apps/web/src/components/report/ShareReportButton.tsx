/**
 * Share Report Button — Generates a parent report token and displays shareable link + QR code.
 * Uses the report-tokens API to create a time-limited token.
 * QR code via public API (zero-dependency, real scannable QR).
 */

import { useState } from 'react'
import { Share2, Copy, Check, X, Loader2, AlertCircle } from 'lucide-react'
import { apiCall } from '../../lib/api'

interface ShareReportButtonProps {
  childId: string
  campaignCode: string
  childName: string
  /** Optional: smaller button variant for table rows */
  compact?: boolean
}

export function ShareReportButton({ childId, campaignCode, childName, compact }: ShareReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateLink() {
    setLoading(true)
    setError(null)
    try {
      const result = await apiCall<{ token: string; expiresAt: string }>('/api/report-tokens', {
        method: 'POST',
        body: JSON.stringify({ childId, campaignCode, expiresInDays: 30 }),
      })
      setToken(result.token)
      setIsOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link')
    } finally {
      setLoading(false)
    }
  }

  function getReportUrl() {
    const base = window.location.origin
    return `${base}/report/${token}`
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getReportUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — fallback
      const textArea = document.createElement('textarea')
      textArea.value = getReportUrl()
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function getWhatsAppUrl() {
    const text = `Health screening report for ${childName}: ${getReportUrl()}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  return (
    <>
      <button
        onClick={generateLink}
        disabled={loading}
        className={
          compact
            ? 'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-50'
            : 'flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
        }
        title="Share report with parent"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        {!compact && 'Share with Parent'}
      </button>

      {error && !isOpen && (
        <span className="ml-2 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </span>
      )}

      {isOpen && token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Share Report</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">
                Share this link with <span className="font-medium text-gray-700">{childName}</span>'s parent/guardian.
                Valid for 30 days, no login required.
              </p>

              {/* Real QR Code via public API */}
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-white border border-gray-200 rounded-lg flex items-center justify-center p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(getReportUrl())}&format=svg`}
                    alt={`QR code for ${childName}'s report`}
                    width={176}
                    height={176}
                    className="rounded"
                  />
                </div>
              </div>

              {/* Link copy */}
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={getReportUrl()}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 bg-gray-50"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyLink}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* WhatsApp share */}
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-3 py-2.5 text-xs font-medium text-white hover:bg-green-600 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share via WhatsApp
              </a>

              <p className="text-[10px] text-gray-400 text-center">
                Scan the QR code or share the link. No login required.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
