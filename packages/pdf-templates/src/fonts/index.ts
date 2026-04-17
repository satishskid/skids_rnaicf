import type { RenderLocale } from '../types'

export interface SatoriFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal' | 'italic'
}

/**
 * Read a font file relative to this module's directory.
 *
 * Node APIs (node:fs + node:url + node:path) are dynamically imported inside
 * this function so the module can be imported in the Cloudflare Workers
 * runtime without crashing at boot. In Workers, `fileURLToPath(import.meta.url)`
 * can return undefined (or throw), so we surface a clear error pointing at the
 * Phase 03 follow-up: switch to binary TTF imports via wrangler
 * `[[rules]] type = "Data"` to enable PDF rendering in Workers.
 *
 * Until that follow-up ships, PDF rendering in Workers is gated behind
 * FEATURE_REPORT_PREWARM=0 and the `/reports/render` route is unused — so this
 * function is not reached in production. Tests (run under Node via tsx) use
 * the readFileSync path normally.
 */
async function readFont(file: string): Promise<ArrayBuffer> {
  const fs = await import('node:fs')
  const url = await import('node:url')
  const path = await import('node:path')
  let moduleUrl: string
  try {
    moduleUrl = url.fileURLToPath(import.meta.url)
  } catch {
    throw new Error(
      '[pdf-templates/fonts] Cannot resolve font directory — likely running in ' +
      'Cloudflare Workers. PDF rendering here requires binary TTF imports via ' +
      'wrangler [[rules]] type = "Data" (Phase 03 follow-up). Until then, ' +
      'keep FEATURE_REPORT_PREWARM=0 and do not hit /reports/render.'
    )
  }
  const fontDir = path.dirname(moduleUrl)
  const buf = fs.readFileSync(path.join(fontDir, file))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

// Caches of resolved font stacks; populated on first call, then reused.
let cachedLatin: SatoriFont[] | null = null
let cachedDevanagari: SatoriFont[] | null = null

async function latin(): Promise<SatoriFont[]> {
  if (!cachedLatin) {
    cachedLatin = [
      { name: 'Inter', data: await readFont('NotoSans-Regular.subset.ttf'), weight: 400, style: 'normal' },
      { name: 'Inter', data: await readFont('NotoSans-Bold.subset.ttf'), weight: 700, style: 'normal' },
    ]
  }
  return cachedLatin
}

async function devanagari(): Promise<SatoriFont[]> {
  if (!cachedDevanagari) {
    cachedDevanagari = [
      { name: 'Inter', data: await readFont('NotoSansDevanagari-Regular.subset.ttf'), weight: 400, style: 'normal' },
      { name: 'Inter', data: await readFont('NotoSansDevanagari-Bold.subset.ttf'), weight: 700, style: 'normal' },
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
      return [...(await latin()), ...(await devanagari())]
    default:
      return latin()
  }
}
