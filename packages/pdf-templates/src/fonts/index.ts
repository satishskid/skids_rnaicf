import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { RenderLocale } from '../types'

export interface SatoriFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal' | 'italic'
}

const FONT_DIR = dirname(fileURLToPath(import.meta.url))

function readFont(file: string): ArrayBuffer {
  const buf = readFileSync(join(FONT_DIR, file))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

let cachedLatin: SatoriFont[] | null = null
let cachedDevanagari: SatoriFont[] | null = null

function latin(): SatoriFont[] {
  if (!cachedLatin) {
    cachedLatin = [
      { name: 'Inter', data: readFont('NotoSans-Regular.subset.ttf'), weight: 400, style: 'normal' },
      { name: 'Inter', data: readFont('NotoSans-Bold.subset.ttf'), weight: 700, style: 'normal' },
    ]
  }
  return cachedLatin
}

function devanagari(): SatoriFont[] {
  if (!cachedDevanagari) {
    cachedDevanagari = [
      { name: 'Inter', data: readFont('NotoSansDevanagari-Regular.subset.ttf'), weight: 400, style: 'normal' },
      { name: 'Inter', data: readFont('NotoSansDevanagari-Bold.subset.ttf'), weight: 700, style: 'normal' },
    ]
  }
  return cachedDevanagari
}

// Locale → font stack. Latin fonts always come first so mixed-script strings
// fall back to Devanagari only for codepoints the Latin font does not cover.
// Marathi (mr) shares the Devanagari script with Hindi.
//
// Other Indian scripts (bn, ta, te, kn, ml, gu, pa) currently fall back to
// Latin only — their dedicated subsets ship in commit 3c+ once rollout order
// is finalised.
export async function loadFonts(locale: RenderLocale): Promise<SatoriFont[]> {
  switch (locale) {
    case 'hi':
    case 'mr':
      return [...latin(), ...devanagari()]
    default:
      return latin()
  }
}
