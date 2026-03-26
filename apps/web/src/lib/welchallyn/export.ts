// ============================================
// Welch Allyn Spot Vision Screener — CSV Export
// Generates SpotSubjects.csv for loading onto device via USB
//
// Welch Allyn SpotSubjects.csv format:
//   First Name, Last Name, Date of Birth, Gender, ID, Eyewear Prescription
//
// Date of Birth: MM/DD/YYYY
// Gender: M or F
// Eyewear Prescription: None, Glasses, or Contacts
// ============================================

import type { Child } from '@skids/shared'

// ── Column headers (must match exactly) ─────────────────────────────

const SPOT_CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Date of Birth',
  'Gender',
  'ID',
  'Eyewear Prescription',
] as const

// ── Types ───────────────────────────────────────────────────────────

export interface SpotSubjectRow {
  firstName: string
  lastName: string
  dateOfBirth: string   // MM/DD/YYYY
  gender: 'M' | 'F'
  id: string
  eyewearPrescription: 'None' | 'Glasses' | 'Contacts'
}

// ── Convert SKIDS Child → Spot Subject row ──────────────────────────

export function childToSpotSubject(child: Child): SpotSubjectRow {
  // Split name into first + last
  const nameParts = child.name.trim().split(/\s+/)
  const firstName = nameParts[0] || child.name
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  // Convert DOB from YYYY-MM-DD → MM/DD/YYYY
  let dateOfBirth = ''
  if (child.dob) {
    const parts = child.dob.split('-')
    if (parts.length === 3) {
      dateOfBirth = `${parts[1]}/${parts[2]}/${parts[0]}`
    }
  }

  // If no DOB, calculate approximate from age
  if (!dateOfBirth) {
    // Default to ~10 years old if no DOB
    const approxYear = new Date().getFullYear() - 10
    dateOfBirth = `01/01/${approxYear}`
  }

  // Map gender
  const gender: 'M' | 'F' = child.gender === 'female' ? 'F' : 'M'

  // Use admission number as ID if available, fallback to child.id
  const id = child.admissionNumber || child.id

  return {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    id,
    eyewearPrescription: 'None',
  }
}

// ── Generate SpotSubjects.csv content ───────────────────────────────

export function generateSpotSubjectsCSV(children: Child[]): string {
  const rows: string[] = [SPOT_CSV_HEADERS.join(',')]

  for (const child of children) {
    const subject = childToSpotSubject(child)
    // Escape any commas in names
    const escapedFirst = subject.firstName.includes(',')
      ? `"${subject.firstName}"` : subject.firstName
    const escapedLast = subject.lastName.includes(',')
      ? `"${subject.lastName}"` : subject.lastName

    rows.push([
      escapedFirst,
      escapedLast,
      subject.dateOfBirth,
      subject.gender,
      subject.id,
      subject.eyewearPrescription,
    ].join(','))
  }

  return rows.join('\n')
}

// ── Download CSV file ───────────────────────────────────────────────

/**
 * Generate and download SpotSubjects.csv for a list of children.
 * File can be placed on USB drive root for Welch Allyn device import.
 *
 * @param children - Array of SKIDS children to export
 * @param fileName - Optional custom filename (default: SpotSubjects.csv)
 * @returns Number of children exported
 */
export function downloadSpotSubjectsCSV(
  children: Child[],
  fileName = 'SpotSubjects.csv'
): number {
  if (children.length === 0) return 0

  const csv = generateSpotSubjectsCSV(children)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
  return children.length
}
