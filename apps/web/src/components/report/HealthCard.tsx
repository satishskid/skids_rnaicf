/**
 * QR Health Card — Printable card for each child (front + back).
 *
 * Front: SKIDS logo + School name + child QR code + child name/class
 * Back:  Healthy habits acronym (FRESH, SMART, HABITS, etc.)
 *
 * Card size: standard ID card (85.6mm x 54mm / 3.375" x 2.125")
 * Print layout: 4 cards per A4 page, duplex printing
 *
 * QR encodes: https://<domain>/parent?code=XXXXXXXX
 * When scanned with any phone camera → opens parent portal with code pre-filled.
 */

import { HEALTHY_HABIT_WORKSHOPS, type HealthyHabitWorkshop } from '@skids/shared'

interface ChildCardData {
  name: string
  class?: string
  section?: string
  qrCode: string
  schoolName?: string
  campaignName?: string
}

interface HealthCardProps {
  children: ChildCardData[]
  schoolName?: string
  campaignName?: string
  /** Which healthy habit to show on back (default: cycles through workshops) */
  workshopId?: string
  /** Base URL for QR code (default: current origin) */
  baseUrl?: string
}

/** Full-page printable view with multiple cards (4 per page, front then back) */
export function HealthCardPrintView({ children, schoolName, campaignName, workshopId, baseUrl }: HealthCardProps) {
  const base = baseUrl || window.location.origin
  const workshops = HEALTHY_HABIT_WORKSHOPS.filter(w => w.audience.includes('Parent') || w.audience.includes('Kids'))

  return (
    <div className="health-card-print">
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .health-card-print { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
        .card-grid {
          display: grid;
          grid-template-columns: repeat(2, 85.6mm);
          grid-template-rows: repeat(2, 54mm);
          gap: 4mm;
          justify-content: center;
          page-break-after: always;
        }
        .card-front, .card-back {
          width: 85.6mm;
          height: 54mm;
          border: 0.5px solid #e5e7eb;
          border-radius: 3mm;
          overflow: hidden;
          box-sizing: border-box;
        }
      `}</style>

      {/* Control bar — screen only */}
      <div className="no-print bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">QR Health Cards</h2>
          <p className="text-sm text-gray-500">{children.length} cards ready to print</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">Use duplex (double-sided) printing</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Cards
          </button>
        </div>
      </div>

      {/* Cards — 4 per page */}
      {chunkArray(children, 4).map((batch, pageIdx) => (
        <div key={pageIdx}>
          {/* Front sides */}
          <div className="card-grid" style={{ padding: '10mm', pageBreakAfter: 'always' }}>
            {batch.map((child, idx) => (
              <CardFront
                key={`front-${pageIdx}-${idx}`}
                child={child}
                schoolName={child.schoolName || schoolName}
                baseUrl={base}
              />
            ))}
            {/* Fill empty slots to maintain grid */}
            {Array.from({ length: 4 - batch.length }).map((_, idx) => (
              <div key={`empty-front-${idx}`} className="card-front" style={{ border: 'none' }} />
            ))}
          </div>

          {/* Back sides (reversed order for duplex printing) */}
          <div className="card-grid" style={{ padding: '10mm', pageBreakAfter: 'always' }}>
            {batch.map((_, idx) => {
              const workshop = workshopId
                ? HEALTHY_HABIT_WORKSHOPS.find(w => w.id === workshopId) || workshops[0]
                : workshops[(pageIdx * 4 + idx) % workshops.length]
              return (
                <CardBack
                  key={`back-${pageIdx}-${idx}`}
                  workshop={workshop}
                />
              )
            })}
            {Array.from({ length: 4 - batch.length }).map((_, idx) => (
              <div key={`empty-back-${idx}`} className="card-back" style={{ border: 'none' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Single card front — SKIDS branding + QR code + child info */
function CardFront({ child, schoolName, baseUrl }: { child: ChildCardData; schoolName?: string; baseUrl: string }) {
  // QR points to parent app's report page (not the admin portal)
  const parentBase = 'https://parent.skids.clinic'
  const qrUrl = `${parentBase}/report?code=${child.qrCode}`
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}&format=svg&qzone=1`

  return (
    <div className="card-front bg-white" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top bar with logos */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2mm 3mm', backgroundColor: '#2563eb', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
          <div style={{
            width: '6mm', height: '6mm', borderRadius: '1.5mm',
            backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '3.5mm', fontWeight: 'bold'
          }}>S</div>
          <span style={{ fontSize: '3mm', fontWeight: 700, letterSpacing: '0.3mm' }}>SKIDS</span>
        </div>
        {schoolName && (
          <span style={{ fontSize: '2.2mm', opacity: 0.9, maxWidth: '35mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {schoolName}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', padding: '2mm 3mm', gap: '3mm'
      }}>
        {/* QR Code */}
        <div style={{
          width: '30mm', height: '30mm', border: '0.5px solid #e5e7eb',
          borderRadius: '2mm', overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1mm'
        }}>
          <img
            src={qrImgUrl}
            alt={`QR: ${child.qrCode}`}
            style={{ width: '28mm', height: '28mm' }}
          />
        </div>

        {/* Child info */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p style={{ fontSize: '3.5mm', fontWeight: 700, color: '#111827', marginBottom: '1mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {child.name}
          </p>
          {child.class && (
            <p style={{ fontSize: '2.5mm', color: '#6b7280', marginBottom: '0.5mm' }}>
              Class {child.class}{child.section ? ` - ${child.section}` : ''}
            </p>
          )}
          <div style={{
            marginTop: '2mm', padding: '1mm 2mm', backgroundColor: '#f0f9ff',
            borderRadius: '1mm', display: 'inline-block'
          }}>
            <p style={{ fontSize: '2mm', color: '#2563eb', fontWeight: 600, letterSpacing: '0.5mm' }}>
              {child.qrCode}
            </p>
          </div>
          <p style={{ fontSize: '1.8mm', color: '#9ca3af', marginTop: '1.5mm' }}>
            Scan QR for health report
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '1mm 3mm', backgroundColor: '#f9fafb', borderTop: '0.5px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '1.6mm', color: '#9ca3af' }}>
          Health Screening Card
        </span>
        <span style={{ fontSize: '1.6mm', color: '#9ca3af' }}>
          skids.clinic
        </span>
      </div>
    </div>
  )
}

/** Single card back — Healthy habits acronym */
function CardBack({ workshop }: { workshop: HealthyHabitWorkshop }) {
  return (
    <div className="card-back bg-white" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '1.5mm 3mm', backgroundColor: '#059669', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '2.8mm', fontWeight: 700, letterSpacing: '0.5mm' }}>
          {workshop.acronym}
        </span>
        <span style={{ fontSize: '2mm', opacity: 0.85 }}>{workshop.name}</span>
      </div>

      {/* Letters */}
      <div style={{ flex: 1, padding: '1.5mm 3mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.8mm' }}>
        {workshop.letters.map((item) => (
          <div key={item.letter} style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5mm' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '4mm', height: '4mm', borderRadius: '1mm',
              backgroundColor: '#059669', color: 'white',
              fontSize: '2.5mm', fontWeight: 800, flexShrink: 0
            }}>
              {item.letter}
            </span>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: '2.2mm', fontWeight: 600, color: '#111827' }}>
                {item.title}
              </span>
              <span style={{ fontSize: '2mm', color: '#6b7280', marginLeft: '1mm' }}>
                — {item.subtitle}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '1mm 3mm', borderTop: '0.5px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#f0fdf4'
      }}>
        <span style={{ fontSize: '1.6mm', color: '#059669', fontWeight: 500 }}>
          Building Healthy Habits
        </span>
        <span style={{ fontSize: '1.6mm', color: '#6b7280' }}>
          SKIDS Health
        </span>
      </div>
    </div>
  )
}

/** Preview a single card (for admin to see what will print) */
export function HealthCardPreview({ child, schoolName, workshopId }: {
  child: ChildCardData
  schoolName?: string
  workshopId?: string
}) {
  const base = window.location.origin
  const workshop = workshopId
    ? HEALTHY_HABIT_WORKSHOPS.find(w => w.id === workshopId) || HEALTHY_HABIT_WORKSHOPS[0]
    : HEALTHY_HABIT_WORKSHOPS[0]

  return (
    <div className="space-y-4">
      <div className="flex gap-4 justify-center flex-wrap">
        <div>
          <p className="text-xs text-gray-500 mb-1 text-center">Front</p>
          <div style={{ transform: 'scale(1.5)', transformOrigin: 'top center' }}>
            <CardFront child={child} schoolName={schoolName} baseUrl={base} />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1 text-center">Back</p>
          <div style={{ transform: 'scale(1.5)', transformOrigin: 'top center' }}>
            <CardBack workshop={workshop} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
