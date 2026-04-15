# @skids/pdf-templates

JS-only PDF report renderer for the SKIDS worker. Runs entirely inside a
Cloudflare Worker request — PHI never leaves the Cloudflare APAC perimeter.

## Pipeline

```
JSX template (React)  →  satori  →  SVG  →  @resvg/resvg-wasm  →  PNG
                                                                    ↓
                                                                 pdf-lib
                                                                    ↓
                                                    multi-page A4 PDF (Uint8Array)
```

- **satori** — JSX → SVG. Does not handle paged CSS, so each page is built as a
  separate JSX subtree by `buildParentScreeningReportPages()`.
- **@resvg/resvg-wasm** — SVG → PNG. Requires a one-time `initResvg(wasm)` call
  at Worker boot (the wasm bytes ship as a Worker module asset).
- **pdf-lib** — embeds each PNG as a full-bleed A4 page and concatenates.

## Public API

```ts
import { renderTemplate, initResvg } from '@skids/pdf-templates'

await initResvg(wasmBytes) // once per isolate
const pdfBytes = await renderTemplate(
  'parent-screening-report',
  data,
  'en',
  { fonts: [{ name: 'Inter', data: interTtf, weight: 400 }] },
)
```

## What lives where

| Path | Contents |
|---|---|
| `src/index.ts` | Public API — `renderTemplate`, `TEMPLATE_VERSION`, types |
| `src/types.ts` | Typed contracts per template + `TEMPLATE_VERSION` (cache-key input) |
| `src/render.ts` | Private: satori + resvg + pdf-lib stitching |
| `src/templates/parent-screening-report.tsx` | First template — header / child block / findings table / disclaimer + QR placeholder / footer |
| `src/fonts/` | Subsetted font bytes — committed in commit 3b for review-in-isolation |

## Color palette

`FOUR_D_CATEGORY_COLORS` in `@skids/shared` is Tailwind class names; satori
cannot resolve those. The hex equivalents are mirrored at the top of
`templates/parent-screening-report.tsx`. Keep both in sync.

## Decision

Pivot from WeasyPrint-in-Sandbox to satori + resvg-wasm + pdf-lib is recorded
in `specs/decisions/2026-04-15-phase-03-sandbox-pdfs-plan.md` (addendum). The
stable HTTP contract `POST /api/reports/render` + `GET /api/reports/:id/pdf`
preserves the upgrade path back to a heavier renderer if needed.
