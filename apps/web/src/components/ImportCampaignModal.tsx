import { useState, useRef, useCallback, type FormEvent } from 'react'
import {
  X,
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Users,
  MapPin,
} from 'lucide-react'
import type * as XLSXType from 'xlsx'
import { apiCall } from '../lib/api'

// Dynamic import for code splitting — xlsx is ~450KB
let XLSX: typeof XLSXType | null = null
async function getXLSX() {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}
import {
  CAMPAIGN_TEMPLATES,
  MODULE_CONFIGS,
  type CampaignType,
} from '@skids/shared'

// ── Column mapping config ──────────────────────

interface ColumnMapping {
  field: string
  label: string
  required: boolean
  patterns: RegExp[]
}

const COLUMN_MAPPINGS: ColumnMapping[] = [
  {
    field: 'name',
    label: 'Student Name',
    required: true,
    patterns: [/^name$/i, /student.?name/i, /child.?name/i, /full.?name/i, /^naam$/i],
  },
  {
    field: 'admissionNumber',
    label: 'Student / Admission ID',
    required: false,
    patterns: [/stud?ent.?id/i, /admission/i, /roll.?no/i, /enrol/i, /reg.?no/i, /^id$/i, /^sr\.?\s?no/i],
  },
  {
    field: 'dob',
    label: 'Date of Birth',
    required: false,
    patterns: [/dob/i, /date.?of.?birth/i, /birth.?date/i, /d\.?o\.?b/i, /^DOB/],
  },
  {
    field: 'gender',
    label: 'Gender',
    required: false,
    patterns: [/gender/i, /^sex$/i, /^m\/f$/i],
  },
  {
    field: 'class',
    label: 'Class / Grade',
    required: false,
    patterns: [/class/i, /grade/i, /standard/i, /^std$/i],
  },
  {
    field: 'section',
    label: 'Section',
    required: false,
    patterns: [/section/i, /division/i, /^div$/i, /^sec$/i],
  },
  {
    field: 'academicYear',
    label: 'Academic Year',
    required: false,
    patterns: [/academic/i, /year/i, /session/i],
  },
]

function autoMapColumn(header: string): string | null {
  const trimmed = header.trim()
  for (const mapping of COLUMN_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(trimmed)) return mapping.field
    }
  }
  return null
}

function normalizeGender(val: string): string | null {
  const v = val.trim().toLowerCase()
  if (['male', 'm', 'boy', 'b'].includes(v)) return 'male'
  if (['female', 'f', 'girl', 'g'].includes(v)) return 'female'
  return null
}

function normalizeDob(val: unknown, xlsxLib?: typeof XLSXType | null): string {
  if (!val) return '2015-01-01'
  // Excel date serial number
  if (typeof val === 'number' && xlsxLib) {
    const d = xlsxLib.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(val).trim()
  // Try ISO format first
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
  // MM/DD/YYYY
  const mdyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`
  // Try Date parse as fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return '2015-01-01'
}

// ── Types ──────────────────────────────────────

type Step = 'upload' | 'mapping' | 'details' | 'importing'

interface ParsedData {
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
}

// ── Component ──────────────────────────────────

export function ImportCampaignModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Campaign details
  const [campaignName, setCampaignName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [pincode, setPincode] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('school_health_4d')
  const [selectedModules, setSelectedModules] = useState<string[]>(
    CAMPAIGN_TEMPLATES[0].defaultModules,
  )

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ added: 0, total: 0, batch: 0, totalBatches: 0 })
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── File parsing ─────────────────────────────

  const handleFile = useCallback((file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const xlsx = await getXLSX()
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = xlsx.read(data, { type: 'array', cellDates: true })
        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]
        const json = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

        if (json.length === 0) {
          setError('The file appears to be empty.')
          return
        }

        const headers = Object.keys(json[0])

        // Auto-map columns
        const autoMap: Record<string, string> = {}
        const usedFields = new Set<string>()
        for (const header of headers) {
          const field = autoMapColumn(header)
          if (field && !usedFields.has(field)) {
            autoMap[header] = field
            usedFields.add(field)
          }
        }

        // Handle duplicate DOB columns — prefer the one that has data
        const dobHeaders = headers.filter(h => autoMap[h] === 'dob')
        if (dobHeaders.length > 1) {
          // Keep the one with most non-empty values
          let bestHeader = dobHeaders[0]
          let bestCount = 0
          for (const h of dobHeaders) {
            const count = json.filter(r => r[h] && String(r[h]).trim()).length
            if (count > bestCount) {
              bestCount = count
              bestHeader = h
            }
          }
          for (const h of dobHeaders) {
            if (h !== bestHeader) delete autoMap[h]
          }
        }

        setParsed({ headers, rows: json, fileName: file.name })
        setColumnMap(autoMap)

        // Auto-detect school name from data if possible
        const academicYears = new Set(json.map(r => String(r[headers.find(h => autoMap[h] === 'academicYear') || ''] || '').trim()).filter(Boolean))
        if (academicYears.size === 1) {
          // Could set default academic year
        }

        setStep('mapping')
      } catch (err) {
        setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Column mapping helpers ───────────────────

  function setMapping(header: string, field: string) {
    setColumnMap(prev => {
      const next = { ...prev }
      // Remove any existing mapping to this field
      if (field !== '_skip') {
        for (const [k, v] of Object.entries(next)) {
          if (v === field) delete next[k]
        }
      }
      if (field === '_skip') {
        delete next[header]
      } else {
        next[header] = field
      }
      return next
    })
  }

  const mappedFields = new Set(Object.values(columnMap))
  const hasNameMapping = mappedFields.has('name')

  // ── Import logic ─────────────────────────────

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!parsed || !hasNameMapping) return
    if (!campaignName.trim()) {
      setError('Campaign name is required.')
      return
    }

    setImporting(true)
    setStep('importing')
    setError(null)

    try {
      // 1. Create campaign
      const nameHeader = Object.entries(columnMap).find(([, v]) => v === 'name')![0]
      const createResp = await apiCall<{ code: string }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName.trim(),
          schoolName: schoolName.trim() || campaignName.trim(),
          campaignType,
          enabledModules: selectedModules,
          academicYear: '2025-26',
          totalChildren: parsed.rows.length,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          district: district.trim() || undefined,
          pincode: pincode.trim() || undefined,
        }),
      })

      const campaignCode = createResp.code

      // 2. Transform rows using column mapping
      const children = parsed.rows
        .filter(row => {
          const name = String(row[nameHeader] || '').trim()
          return name.length > 0
        })
        .map(row => {
          const child: Record<string, string | null> = {}

          for (const [header, field] of Object.entries(columnMap)) {
            const rawVal = row[header]
            if (field === 'name') {
              child.name = String(rawVal || '').trim()
            } else if (field === 'dob') {
              child.dob = normalizeDob(rawVal, XLSX)
            } else if (field === 'gender') {
              child.gender = normalizeGender(String(rawVal || ''))
            } else if (field === 'admissionNumber') {
              child.admissionNumber = String(rawVal || '').trim() || null
            } else if (field === 'class') {
              child.class = String(rawVal || '').trim() || null
            } else if (field === 'section') {
              child.section = String(rawVal || '').trim() || null
            } else if (field === 'academicYear') {
              child.academicYear = String(rawVal || '').trim() || null
            }
          }

          // Defaults
          if (!child.dob) child.dob = '2015-01-01'
          if (!child.academicYear) child.academicYear = '2025-26'
          if (schoolName.trim()) child.schoolName = schoolName.trim()

          return child
        })

      // 3. Upload in batches of 25
      const BATCH = 25
      let totalAdded = 0
      let totalSkipped = 0
      const allErrors: string[] = []
      const totalBatches = Math.ceil(children.length / BATCH)

      for (let i = 0; i < children.length; i += BATCH) {
        const batch = children.slice(i, i + BATCH)
        setImportProgress({ added: totalAdded, total: children.length, batch: Math.floor(i / BATCH) + 1, totalBatches })

        try {
          const resp = await apiCall<{ added: number; skipped: number; errors?: string[] }>(
            `/api/campaigns/${campaignCode}/children`,
            {
              method: 'POST',
              body: JSON.stringify({ children: batch }),
            },
          )
          totalAdded += resp.added
          totalSkipped += resp.skipped
          if (resp.errors) allErrors.push(...resp.errors)
        } catch (err) {
          allErrors.push(`Batch ${Math.floor(i / BATCH) + 1} failed: ${err instanceof Error ? err.message : 'unknown'}`)
        }
      }

      setImportResult({ added: totalAdded, skipped: totalSkipped, errors: allErrors })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Render ───────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            {step !== 'upload' && step !== 'importing' && (
              <button
                onClick={() => setStep(step === 'details' ? 'mapping' : 'upload')}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Import Campaign from Spreadsheet
              </h3>
              <p className="text-xs text-gray-500">
                {step === 'upload' && 'Upload an Excel (.xlsx) or CSV file with student data'}
                {step === 'mapping' && 'Review column mapping'}
                {step === 'details' && 'Set campaign details and modules'}
                {step === 'importing' && 'Importing...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3">
          {(['upload', 'mapping', 'details', 'importing'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  step === s
                    ? 'bg-blue-100 text-blue-700'
                    : i < ['upload', 'mapping', 'details', 'importing'].indexOf(step)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < ['upload', 'mapping', 'details', 'importing'].indexOf(step) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="font-bold">{i + 1}</span>
                )}
                {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Columns' : s === 'details' ? 'Campaign Details' : 'Import'}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <FileSpreadsheet className={`h-12 w-12 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="mt-4 text-sm font-medium text-gray-700">
                Drop your Excel or CSV file here
              </p>
              <p className="mt-1 text-xs text-gray-500">
                or click to browse — supports .xlsx, .xls, .csv
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm ring-1 ring-gray-200">
                <Upload className="h-4 w-4" />
                Choose File
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* ── Step 2: Column Mapping ── */}
          {step === 'mapping' && parsed && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    <FileSpreadsheet className="mr-1.5 inline h-4 w-4 text-green-600" />
                    {parsed.fileName} — {parsed.rows.length} students found
                  </p>
                </div>
                {!hasNameMapping && (
                  <p className="text-xs font-medium text-red-600">
                    Map the "Student Name" column to continue
                  </p>
                )}
              </div>

              {/* Mapping table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">EXCEL COLUMN</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">MAPS TO</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">SAMPLE DATA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsed.headers.filter(h => !h.startsWith('Unnamed')).map(header => {
                      const mapped = columnMap[header]
                      const mappingDef = COLUMN_MAPPINGS.find(m => m.field === mapped)
                      const sample = parsed.rows.slice(0, 3).map(r => String(r[header] || '').trim()).filter(Boolean)
                      return (
                        <tr key={header} className={mapped ? 'bg-blue-50/30' : ''}>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{header}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={mapped || '_skip'}
                              onChange={(e) => setMapping(header, e.target.value)}
                              className={`rounded-md border px-2 py-1 text-xs ${
                                mapped
                                  ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                                  : 'border-gray-200 text-gray-500'
                              }`}
                            >
                              <option value="_skip">— Skip —</option>
                              {COLUMN_MAPPINGS.map(m => (
                                <option
                                  key={m.field}
                                  value={m.field}
                                  disabled={mappedFields.has(m.field) && columnMap[header] !== m.field}
                                >
                                  {m.label}{m.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {sample.slice(0, 2).join(', ')}
                            {sample.length > 2 && '...'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-500">PREVIEW (first 5 rows)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {COLUMN_MAPPINGS.filter(m => mappedFields.has(m.field)).map(m => (
                          <th key={m.field} className="px-3 py-1.5 text-left font-medium text-gray-600">{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsed.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {COLUMN_MAPPINGS.filter(m => mappedFields.has(m.field)).map(m => {
                            const header = Object.entries(columnMap).find(([, v]) => v === m.field)?.[0]
                            const val = header ? row[header] : ''
                            let display = String(val || '—')
                            if (m.field === 'dob' && val) display = normalizeDob(val, XLSX)
                            if (m.field === 'gender' && val) display = normalizeGender(String(val)) || String(val)
                            return <td key={m.field} className="px-3 py-1.5 text-gray-700">{display}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep('details')}
                  disabled={!hasNameMapping}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next: Campaign Details
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Campaign Details ── */}
          {step === 'details' && parsed && (
            <form onSubmit={handleImport}>
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <Users className="h-4 w-4" />
                <span className="font-medium">{parsed.rows.length} students</span>
                <span className="text-blue-500">will be imported from {parsed.fileName}</span>
              </div>

              <div className="space-y-4">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Campaign Name *</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., Chakradharpur School Health Screening 2025-26"
                  />
                </div>

                {/* School Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">School / Facility Name</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., Kendriya Vidyalaya"
                  />
                </div>

                {/* Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g., Chakradharpur" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g., Jharkhand" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">District</label>
                    <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g., West Singhbhum" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pincode</label>
                    <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g., 833102" />
                  </div>
                </div>

                {/* Campaign Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Campaign Type</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {CAMPAIGN_TEMPLATES.map(t => (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => {
                          setCampaignType(t.type)
                          setSelectedModules([...t.defaultModules])
                        }}
                        className={`rounded-lg border-2 px-3 py-2 text-left text-xs transition-all ${
                          campaignType === t.type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-gray-500">{t.defaultModules.length} modules</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module chips */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Screening Modules ({selectedModules.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedModules.length === MODULE_CONFIGS.length) setSelectedModules([])
                        else setSelectedModules(MODULE_CONFIGS.map(m => m.type))
                      }}
                      className="text-xs font-medium text-blue-600"
                    >
                      {selectedModules.length === MODULE_CONFIGS.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MODULE_CONFIGS.map(mod => {
                      const sel = selectedModules.includes(mod.type)
                      return (
                        <button
                          key={mod.type}
                          type="button"
                          onClick={() => setSelectedModules(prev =>
                            sel ? prev.filter(m => m !== mod.type) : [...prev, mod.type]
                          )}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                            sel
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          {sel && <Check className="h-2.5 w-2.5" />}
                          {mod.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!campaignName.trim() || selectedModules.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Create Campaign & Import {parsed.rows.length} Students
                </button>
              </div>
            </form>
          )}

          {/* ── Step 4: Importing ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center py-8">
              {importing ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  <p className="mt-4 text-sm font-medium text-gray-700">
                    Importing students...
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Batch {importProgress.batch} of {importProgress.totalBatches} — {importProgress.added} added so far
                  </p>
                  <div className="mt-4 w-64">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${importProgress.totalBatches ? (importProgress.batch / importProgress.totalBatches) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : importResult ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="mt-4 text-lg font-semibold text-gray-900">Import Complete!</p>
                  <div className="mt-3 space-y-1 text-center text-sm text-gray-600">
                    <p><span className="font-semibold text-green-700">{importResult.added}</span> students added</p>
                    {importResult.skipped > 0 && (
                      <p><span className="font-semibold text-yellow-600">{importResult.skipped}</span> duplicates skipped</p>
                    )}
                    {importResult.errors.length > 0 && (
                      <p className="text-red-600">{importResult.errors.length} errors</p>
                    )}
                  </div>
                  <button
                    onClick={onImported}
                    className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <MapPin className="h-4 w-4" />
                    Go to Campaign
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
