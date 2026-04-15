import type { FourDCategory } from '@skids/shared'
import type { ParentScreeningReportData, ParentScreeningReportFinding } from '../types'

// Hex equivalents of FOUR_D_CATEGORY_COLORS (Tailwind tokens) — satori cannot
// resolve Tailwind classes, so the palette is mirrored as raw CSS values.
// Source of truth: packages/shared/src/four-d-mapping.ts:126.
const CATEGORY_HEX: Record<FourDCategory, { bg: string; text: string; border: string }> = {
  defects: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  delay: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  disability: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  deficiency: { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
  behavioral: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  immunization: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  learning: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
}

const PAGE_WIDTH = 595 // A4 @ 72dpi
const PAGE_HEIGHT = 842
const FINDINGS_PER_PAGE = 8

export interface PageDef {
  pageNumber: number
  pageCount: number
  body: JSX.Element
}

export function buildParentScreeningReportPages(data: ParentScreeningReportData): PageDef[] {
  const chunks: ParentScreeningReportFinding[][] = []
  for (let i = 0; i < data.findings.length; i += FINDINGS_PER_PAGE) {
    chunks.push(data.findings.slice(i, i + FINDINGS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const pageCount = chunks.length
  return chunks.map((chunk, idx) => ({
    pageNumber: idx + 1,
    pageCount,
    body: <Page data={data} findings={chunk} pageNumber={idx + 1} pageCount={pageCount} isFirst={idx === 0} isLast={idx === pageCount - 1} />,
  }))
}

interface PageProps {
  data: ParentScreeningReportData
  findings: ParentScreeningReportFinding[]
  pageNumber: number
  pageCount: number
  isFirst: boolean
  isLast: boolean
}

function Page({ data, findings, pageNumber, pageCount, isFirst, isLast }: PageProps) {
  return (
    <div
      style={{
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: 'Inter',
        display: 'flex',
        flexDirection: 'column',
        padding: '36px 40px',
      }}
    >
      <Header />
      {isFirst && <ChildBlock data={data} />}
      <FindingsTable findings={findings} />
      <div style={{ flexGrow: 1 }} />
      {isLast && <Disclaimer text={data.disclaimer} qrPayload={data.qrPayload} />}
      <Footer pageNumber={pageNumber} pageCount={pageCount} />
    </div>
  )
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0ea5e9', paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>S</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>SKIDS Health</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>Childhood screening summary</span>
        </div>
      </div>
      <span style={{ fontSize: 10, color: '#64748b' }}>Confidential — for parent</span>
    </div>
  )
}

function ChildBlock({ data }: { data: ParentScreeningReportData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 700 }}>{data.child.name}</span>
      <div style={{ display: 'flex', marginTop: 6, fontSize: 11, color: '#475569' }}>
        <span>DOB: {data.child.dob}</span>
        <span style={{ marginLeft: 16 }}>Sex: {data.child.sex}</span>
        <span style={{ marginLeft: 16 }}>Campaign: {data.child.campaignCode}</span>
      </div>
      <div style={{ display: 'flex', marginTop: 4, fontSize: 11, color: '#475569' }}>
        <span>Screened: {data.screenedAt}</span>
        <span style={{ marginLeft: 16 }}>By: {data.screenerName}</span>
      </div>
    </div>
  )
}

function FindingsTable({ findings }: { findings: ParentScreeningReportFinding[] }) {
  if (findings.length === 0) {
    return (
      <div style={{ marginTop: 16, padding: 24, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
        No findings recorded for this section.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
      <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Findings</span>
      {findings.map((f, i) => (
        <FindingRow key={i} finding={f} />
      ))}
    </div>
  )
}

function FindingRow({ finding }: { finding: ParentScreeningReportFinding }) {
  const colors = CATEGORY_HEX[finding.category]
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderLeft: `3px solid ${colors.border}`, backgroundColor: colors.bg, marginBottom: 6, borderRadius: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: colors.text, textTransform: 'uppercase', minWidth: 90 }}>{finding.category}</span>
      <span style={{ fontSize: 11, color: '#0f172a', flexGrow: 1 }}>{finding.label}</span>
      <span style={{ fontSize: 10, color: colors.text, fontWeight: 600 }}>{finding.severity}</span>
    </div>
  )
}

function Disclaimer({ text, qrPayload }: { text: string; qrPayload: string }) {
  return (
    <div style={{ display: 'flex', marginTop: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, paddingRight: 12 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Disclaimer</span>
        <span style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{text}</span>
      </div>
      <div style={{ width: 64, height: 64, backgroundColor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>
        {qrPayload.slice(0, 12)}
      </div>
    </div>
  )
}

function Footer({ pageNumber, pageCount }: { pageNumber: number; pageCount: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 9, color: '#94a3b8' }}>
      <span>SKIDS Health — childhood screening</span>
      <span>Page {pageNumber} of {pageCount}</span>
    </div>
  )
}

export const PARENT_SCREENING_REPORT_PAGE = { width: PAGE_WIDTH, height: PAGE_HEIGHT }
