import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { PDFDocument } from 'pdf-lib'
import satori from 'satori'
import { buildParentScreeningReportPages, PARENT_SCREENING_REPORT_PAGE } from './templates/parent-screening-report'
import type { RenderLocale, TemplateData, TemplateName } from './types'

// resvg-wasm needs a one-time WASM init. The host (Worker / Node) supplies the
// module bytes via initResvg() before the first renderTemplate() call. Workers
// pre-warm this in the FEATURE_REPORT_PREWARM cron handler.
let resvgReady: Promise<void> | null = null

export async function initResvg(wasm: ArrayBuffer | Response | URL): Promise<void> {
  if (!resvgReady) resvgReady = initWasm(wasm as ArrayBuffer)
  await resvgReady
}

export interface RenderContext {
  fonts: Array<{ name: string; data: ArrayBuffer; weight?: 400 | 700; style?: 'normal' | 'italic' }>
}

export async function renderTemplate<T extends TemplateName>(
  templateName: T,
  data: TemplateData<T>,
  locale: RenderLocale,
  ctx: RenderContext,
): Promise<Uint8Array> {
  if (!resvgReady) {
    throw new Error('resvg-wasm not initialised — call initResvg(wasm) once at boot before renderTemplate()')
  }
  await resvgReady

  const pages = buildPages(templateName, data)
  const pdf = await PDFDocument.create()

  for (const page of pages) {
    const svg = await satori(page.body, {
      width: page.size.width,
      height: page.size.height,
      fonts: ctx.fonts.map(f => ({
        name: f.name,
        data: f.data,
        weight: f.weight ?? 400,
        style: f.style ?? 'normal',
      })),
    })
    const png = new Resvg(svg).render().asPng()
    const embedded = await pdf.embedPng(png)
    const pdfPage = pdf.addPage([page.size.width, page.size.height])
    pdfPage.drawImage(embedded, { x: 0, y: 0, width: page.size.width, height: page.size.height })
  }

  void locale // reserved for future per-locale font selection
  return await pdf.save()
}

interface BuiltPage {
  body: JSX.Element
  size: { width: number; height: number }
}

function buildPages<T extends TemplateName>(templateName: T, data: TemplateData<T>): BuiltPage[] {
  switch (templateName) {
    case 'parent-screening-report':
      return buildParentScreeningReportPages(data as TemplateData<'parent-screening-report'>).map(p => ({
        body: p.body,
        size: PARENT_SCREENING_REPORT_PAGE,
      }))
    default: {
      const _exhaustive: never = templateName
      throw new Error(`Unknown template: ${String(_exhaustive)}`)
    }
  }
}
