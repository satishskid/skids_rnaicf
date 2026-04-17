#!/usr/bin/env node
// SKIDS Edge-Stack v1 release deck builder.
// Source of truth: docs/PRODUCT-SUMMARY-2026-04-17.md + docs/BLUEPRINT.md.
// Run:  node docs/decks/build.js
// Out:  docs/decks/edge-stack-v1-release.pptx

const path = require('path')
const NODE_MODULES = path.join(
  require('child_process').execSync('npm root -g').toString().trim()
)
require('module').globalPaths.unshift(NODE_MODULES)

const pptxgen = require('pptxgenjs')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const sharp = require('sharp')
const {
  FaLayerGroup, FaShieldAlt, FaBrain, FaChartBar, FaRocket,
  FaMicrochip, FaUserMd, FaBookMedical, FaLock, FaTachometerAlt,
  FaCodeBranch, FaCheckCircle, FaHeartbeat, FaCalendarCheck, FaMapSigns,
  FaNotesMedical, FaClipboardList, FaFlask,
} = require('react-icons/fa')

// ── Palette (Ocean Gradient, content-informed) ─────────────────────
const C = {
  navy: '065A82',
  navyDark: '0A2540',
  teal: '1C7293',
  midnight: '21295C',
  green: '10B981',
  amber: 'F59E0B',
  rose: 'EF4444',
  white: 'FFFFFF',
  cream: 'F8FAFC',
  slate900: '0F172A',
  slate700: '334155',
  slate500: '64748B',
  slate300: 'CBD5E1',
  slate100: 'F1F5F9',
  accent: '14B8A6',
}

async function iconToPng(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  )
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + buf.toString('base64')
}

async function main() {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_16x9'  // 10" × 5.625"
  pres.title = 'SKIDS Edge-Stack v1 Release'
  pres.author = 'SKIDS Platform'

  // Pre-render icons (white for dark backgrounds, navy for light).
  const ICONS = {
    layerWhite: await iconToPng(FaLayerGroup, '#' + C.white),
    shieldWhite: await iconToPng(FaShieldAlt, '#' + C.white),
    brainNavy: await iconToPng(FaBrain, '#' + C.navy),
    chartNavy: await iconToPng(FaChartBar, '#' + C.navy),
    rocketWhite: await iconToPng(FaRocket, '#' + C.white),
    chipNavy: await iconToPng(FaMicrochip, '#' + C.navy),
    doctorNavy: await iconToPng(FaUserMd, '#' + C.navy),
    bookNavy: await iconToPng(FaBookMedical, '#' + C.navy),
    lockTeal: await iconToPng(FaLock, '#' + C.teal),
    gaugeTeal: await iconToPng(FaTachometerAlt, '#' + C.teal),
    branchTeal: await iconToPng(FaCodeBranch, '#' + C.teal),
    checkGreen: await iconToPng(FaCheckCircle, '#' + C.green),
    heartTeal: await iconToPng(FaHeartbeat, '#' + C.teal),
    calTeal: await iconToPng(FaCalendarCheck, '#' + C.teal),
    mapTeal: await iconToPng(FaMapSigns, '#' + C.teal),
    notesNavy: await iconToPng(FaNotesMedical, '#' + C.navy),
    clipNavy: await iconToPng(FaClipboardList, '#' + C.navy),
    flaskWhite: await iconToPng(FaFlask, '#' + C.white),
  }

  // ── Helper: consistent footer ────────────────────────────────────
  const addFooter = (slide, pageNum, total) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.4, w: 10, h: 0.225, fill: { color: C.navy }, line: { color: C.navy },
    })
    slide.addText('SKIDS Edge-Stack v1 · 2026-04-17', {
      x: 0.35, y: 5.4, w: 5, h: 0.225, fontSize: 9, color: C.white, fontFace: 'Calibri',
      valign: 'middle', margin: 0,
    })
    slide.addText(`${pageNum} / ${total}`, {
      x: 8.6, y: 5.4, w: 1.05, h: 0.225, fontSize: 9, color: C.white, fontFace: 'Calibri',
      align: 'right', valign: 'middle', margin: 0,
    })
  }

  const TOTAL = 12

  // ═══════════════════════════════════════════════════════════════
  // Slide 1 · Cover (dark)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.navyDark }
    // Large accent bar on the left
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: C.accent }, line: { color: C.accent },
    })
    // Subtle cover motif — stacked rectangles top-right
    for (let i = 0; i < 3; i++) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 7.3 + i * 0.15, y: 0.4 + i * 0.15, w: 2.3, h: 2.3,
        fill: { color: C.teal, transparency: 70 + i * 5 },
        line: { color: C.teal, transparency: 80 },
      })
    }
    s.addImage({
      data: ICONS.layerWhite, x: 0.6, y: 1.0, w: 0.7, h: 0.7,
    })
    s.addText('SKIDS Edge-Stack', {
      x: 0.6, y: 1.85, w: 8.5, h: 0.9, fontSize: 44, bold: true,
      fontFace: 'Georgia', color: C.white, margin: 0,
    })
    s.addText('v1 Release', {
      x: 0.6, y: 2.7, w: 8.5, h: 0.5, fontSize: 28,
      fontFace: 'Georgia', color: C.accent, margin: 0,
    })
    s.addText('Closed-loop clinical decision support for pediatric screening', {
      x: 0.6, y: 3.3, w: 8.5, h: 0.4, fontSize: 16,
      fontFace: 'Calibri', color: C.slate300, margin: 0, italic: true,
    })
    s.addText([
      { text: 'Released  ', options: { color: C.slate500 } },
      { text: '2026-04-17', options: { bold: true, color: C.white } },
    ], {
      x: 0.6, y: 4.5, w: 6, h: 0.4, fontSize: 14,
      fontFace: 'Calibri', margin: 0,
    })
    s.addText('Audience: clinical · ops · tech · business', {
      x: 0.6, y: 4.85, w: 6, h: 0.3, fontSize: 11,
      fontFace: 'Calibri', color: C.slate500, margin: 0,
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 2 · Executive summary (light)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
    })
    s.addText('Executive summary', {
      x: 0.35, y: 0, w: 9.3, h: 0.65, fontSize: 22, bold: true,
      fontFace: 'Georgia', color: C.white, valign: 'middle', margin: 0,
    })

    const points = [
      {
        icon: ICONS.heartTeal,
        title: 'From capture to decision-support',
        body: 'Five new capabilities turn SKIDS Screen from a data-capture platform into a closed-loop clinical decision-support system.',
      },
      {
        icon: ICONS.doctorNavy,
        title: 'Doctors gain context, not clicks',
        body: 'Every observation surfaces top-5 relevant clinical evidence snippets + top-5 similar past cases in one expand, in under 500ms.',
      },
      {
        icon: ICONS.gaugeTeal,
        title: 'Nothing is lost in transit',
        body: 'Durable workflow records 5 steps per observation; queue DLQs catch every poison message; every AI decision is auditable.',
      },
      {
        icon: ICONS.chartNavy,
        title: 'Ops + research unblocked',
        body: 'All 5 canonical analytics tiles (Q1-Q5) live; nightly de-identified Parquet layer ready for external researchers.',
      },
    ]
    points.forEach((p, i) => {
      const y = 1.0 + i * 1.0
      // Icon circle
      s.addShape(pres.shapes.OVAL, {
        x: 0.5, y, w: 0.7, h: 0.7, fill: { color: C.slate100 }, line: { color: C.slate100 },
      })
      s.addImage({ data: p.icon, x: 0.62, y: y + 0.12, w: 0.46, h: 0.46 })
      s.addText(p.title, {
        x: 1.4, y, w: 8, h: 0.4, fontSize: 16, bold: true,
        fontFace: 'Calibri', color: C.slate900, margin: 0,
      })
      s.addText(p.body, {
        x: 1.4, y: y + 0.38, w: 8, h: 0.5, fontSize: 12,
        fontFace: 'Calibri', color: C.slate700, margin: 0,
      })
    })
    addFooter(s, 2, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 3 · What's new at a glance (table)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
    })
    s.addText('What shipped — at a glance', {
      x: 0.35, y: 0, w: 9.3, h: 0.65, fontSize: 22, bold: true,
      fontFace: 'Georgia', color: C.white, valign: 'middle', margin: 0,
    })

    const header = (t) => ({ text: t, options: {
      bold: true, color: C.white, fill: { color: C.teal },
      fontSize: 12, fontFace: 'Calibri', valign: 'middle', align: 'left',
      margin: 6,
    }})
    const cell = (t, { statusColor } = {}) => ({ text: t, options: {
      fontSize: 11, fontFace: 'Calibri', color: C.slate900,
      fill: { color: C.white }, valign: 'middle', align: 'left',
      margin: 6,
      ...(statusColor ? { color: statusColor, bold: true } : {}),
    }})

    const rows = [
      [header('#'), header('Feature'), header('Who benefits'), header('Status')],
      [
        cell('1'),
        cell('Durable screening workflow — 5-step trace per observation'),
        cell('Nurses · Ops'),
        cell('Live', { statusColor: C.green }),
      ],
      [
        cell('2'),
        cell('Sandbox second opinion — budget-capped ONNX re-analysis'),
        cell('Doctors · QA'),
        cell('DB + UI live; container deferred', { statusColor: C.amber }),
      ],
      [
        cell('3'),
        cell('Evidence RAG + similar cases — 147 chunks, <500ms P95'),
        cell('Doctors'),
        cell('Live', { statusColor: C.green }),
      ],
      [
        cell('4'),
        cell('Population health Q1–Q5 + de-identified Parquet'),
        cell('Ops · Leadership · Researchers'),
        cell('Live', { statusColor: C.green }),
      ],
      [
        cell('5'),
        cell('On-device Liquid AI — zero cloud egress, OPFS cached'),
        cell('Nurses · Doctors'),
        cell('Infra live; weights pending', { statusColor: C.amber }),
      ],
    ]
    s.addTable(rows, {
      x: 0.35, y: 0.95, w: 9.3,
      colW: [0.45, 4.85, 2.0, 2.0],
      border: { pt: 0.5, color: C.slate300 },
    })
    s.addText([
      { text: 'Live', options: { color: C.green, bold: true } },
      { text: '  =  ready for clinical use today.   ', options: { color: C.slate700 } },
      { text: 'Amber', options: { color: C.amber, bold: true } },
      { text: '  =  one known unblocker before promotion.', options: { color: C.slate700 } },
    ], {
      x: 0.35, y: 4.95, w: 9.3, h: 0.3, fontSize: 10,
      fontFace: 'Calibri', italic: true, margin: 0,
    })
    addFooter(s, 3, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 4 · Feature 1 — Durable workflow (two-column)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    // Left accent bar with number
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.6, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
    })
    s.addText('1', {
      x: 0, y: 0.3, w: 0.6, h: 0.7, fontSize: 40, bold: true,
      fontFace: 'Georgia', color: C.white, align: 'center', margin: 0,
    })
    s.addText('Feature 1', {
      x: 0, y: 1.0, w: 0.6, h: 0.3, fontSize: 9, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    })

    s.addText('Durable screening workflow', {
      x: 1.0, y: 0.4, w: 8.7, h: 0.55, fontSize: 26, bold: true,
      fontFace: 'Georgia', color: C.slate900, margin: 0,
    })
    s.addText('ScreeningObservationWorkflow  ·  Cloudflare Workflows + Queues', {
      x: 1.0, y: 0.95, w: 8.7, h: 0.3, fontSize: 12, italic: true,
      fontFace: 'Calibri', color: C.teal, margin: 0,
    })

    // Left column — 5-step flow
    s.addText('The 5 recorded steps', {
      x: 1.0, y: 1.5, w: 4.3, h: 0.3, fontSize: 12, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0,
    })
    const steps = [
      { n: '1', label: 'persist', hint: 'INSERT OR REPLACE into Turso' },
      { n: '2', label: 'quality-gate', hint: 'confidence · risk · routing' },
      { n: '3', label: 'embed', hint: 'bge-small-en-v1.5 via Workers AI' },
      { n: '4', label: 'enqueue 2nd opinion', hint: 'cond-based fan-out to queue' },
      { n: '5', label: 'await-review → notify', hint: '72h timeout · doctor-review event' },
    ]
    steps.forEach((step, i) => {
      const y = 1.9 + i * 0.55
      s.addShape(pres.shapes.OVAL, {
        x: 1.0, y, w: 0.45, h: 0.45,
        fill: { color: C.navy }, line: { color: C.navy },
      })
      s.addText(step.n, {
        x: 1.0, y, w: 0.45, h: 0.45, fontSize: 13, bold: true,
        fontFace: 'Calibri', color: C.white, align: 'center', valign: 'middle', margin: 0,
      })
      s.addText(step.label, {
        x: 1.6, y, w: 3.6, h: 0.23, fontSize: 13, bold: true,
        fontFace: 'Calibri', color: C.slate900, margin: 0,
      })
      s.addText(step.hint, {
        x: 1.6, y: y + 0.22, w: 3.6, h: 0.23, fontSize: 10,
        fontFace: 'Calibri', color: C.slate500, margin: 0, italic: true,
      })
    })

    // Right column — impact card
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.7, y: 1.5, w: 4.0, h: 3.5, fill: { color: C.white }, line: { color: C.slate300 },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 135, opacity: 0.1 },
    })
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.7, y: 1.5, w: 0.08, h: 3.5, fill: { color: C.accent }, line: { color: C.accent },
    })
    s.addText('Impact', {
      x: 5.95, y: 1.65, w: 3.6, h: 0.35, fontSize: 13, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0,
    })
    s.addText([
      { text: 'Before: ', options: { bold: true, color: C.rose } },
      { text: 'any transient error mid-flow silently lost the observation\'s downstream work.', options: { color: C.slate700 } },
      { text: '\n\nAfter: ', options: { bold: true, color: C.green, breakLine: false } },
      { text: 'every step records to workflow_events. Ops can reconstruct any screening\'s full trajectory.', options: { color: C.slate700 } },
    ], {
      x: 5.95, y: 2.05, w: 3.6, h: 1.9, fontSize: 11,
      fontFace: 'Calibri', margin: 0, paraSpaceAfter: 6,
    })
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.95, y: 3.95, w: 3.6, h: 0.03, fill: { color: C.slate300 }, line: { color: C.slate300 },
    })
    s.addText([
      { text: 'Rollback: ', options: { bold: true, color: C.navy } },
      { text: 'FEATURE_USE_WORKFLOW=0 → redeploy. Inline path resumes; in-flight workflows still drain.', options: { color: C.slate700 } },
    ], {
      x: 5.95, y: 4.05, w: 3.6, h: 0.85, fontSize: 10,
      fontFace: 'Calibri', margin: 0, italic: true,
    })
    addFooter(s, 4, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 5 · Feature 2 — Sandbox second opinion (trigger rules + cost)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.6, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
    })
    s.addText('2', {
      x: 0, y: 0.3, w: 0.6, h: 0.7, fontSize: 40, bold: true,
      fontFace: 'Georgia', color: C.white, align: 'center', margin: 0,
    })
    s.addText('Feature 2', {
      x: 0, y: 1.0, w: 0.6, h: 0.3, fontSize: 9, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    })
    s.addText('Sandbox second opinion', {
      x: 1.0, y: 0.4, w: 8.7, h: 0.55, fontSize: 26, bold: true,
      fontFace: 'Georgia', color: C.slate900, margin: 0,
    })
    s.addText('Doctor-initiated ONNX re-analysis  ·  budget-capped per session', {
      x: 1.0, y: 0.95, w: 8.7, h: 0.3, fontSize: 12, italic: true,
      fontFace: 'Calibri', color: C.teal, margin: 0,
    })

    // Left — 4 trigger rules
    s.addText('Triggers', {
      x: 1.0, y: 1.5, w: 4.2, h: 0.3, fontSize: 12, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0,
    })
    const triggers = [
      'AI confidence < 0.75',
      'Moderate-risk finding with confidence < 0.9',
      'Any vision / ear / skin / dental observation',
      'Doctor manual click in the inbox',
    ]
    triggers.forEach((t, i) => {
      const y = 1.85 + i * 0.42
      s.addShape(pres.shapes.RECTANGLE, {
        x: 1.0, y, w: 0.08, h: 0.3, fill: { color: C.accent }, line: { color: C.accent },
      })
      s.addText(t, {
        x: 1.25, y, w: 4.0, h: 0.3, fontSize: 11,
        fontFace: 'Calibri', color: C.slate700, valign: 'middle', margin: 0,
      })
    })

    // Right — stat callouts
    const statCard = (x, y, w, value, label, color) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h: 1.5, fill: { color: C.white }, line: { color: C.slate300 },
        shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 135, opacity: 0.1 },
      })
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: y + 1.42, w, h: 0.08, fill: { color }, line: { color },
      })
      s.addText(value, {
        x, y: y + 0.15, w, h: 0.7, fontSize: 36, bold: true,
        fontFace: 'Georgia', color, align: 'center', margin: 0,
      })
      s.addText(label, {
        x, y: y + 0.85, w, h: 0.5, fontSize: 10,
        fontFace: 'Calibri', color: C.slate700, align: 'center', margin: 0,
      })
    }
    statCard(5.7, 1.5, 1.95, '5', 'Max second-opinions per session (hard cap)', C.navy)
    statCard(7.75, 1.5, 1.95, '≥0.80', 'Target agreement score vs. doctor', C.green)
    statCard(5.7, 3.1, 1.95, '60s', 'P95 budget for queue → ONNX → DB', C.teal)
    statCard(7.75, 3.1, 1.95, 'paired', 'accuracy_metrics row on every opinion', C.accent)

    s.addText('What\'s deferred', {
      x: 1.0, y: 3.65, w: 4.2, h: 0.3, fontSize: 12, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0,
    })
    s.addText('Only the ONNX Docker image. DB schema, queue infra, UI button, session budget — all live. One container deploy enables inference end-to-end.', {
      x: 1.0, y: 4.0, w: 4.2, h: 1.0, fontSize: 11, italic: true,
      fontFace: 'Calibri', color: C.slate700, margin: 0,
    })
    addFooter(s, 5, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 6 · Feature 3 — Evidence RAG (stat-heavy)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.6, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
    })
    s.addText('3', {
      x: 0, y: 0.3, w: 0.6, h: 0.7, fontSize: 40, bold: true,
      fontFace: 'Georgia', color: C.white, align: 'center', margin: 0,
    })
    s.addText('Feature 3', {
      x: 0, y: 1.0, w: 0.6, h: 0.3, fontSize: 9, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    })
    s.addText('Evidence RAG + similar cases', {
      x: 1.0, y: 0.4, w: 8.7, h: 0.55, fontSize: 26, bold: true,
      fontFace: 'Georgia', color: C.slate900, margin: 0,
    })
    s.addText('GET /api/reviews/:id/context  ·  evidence + similar cases in one fan-out', {
      x: 1.0, y: 0.95, w: 8.7, h: 0.3, fontSize: 12, italic: true,
      fontFace: 'Calibri', color: C.teal, margin: 0,
    })

    // Big headline stats row
    const bigStat = (x, y, w, value, unit, label, color) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h: 1.4, fill: { color: C.white }, line: { color: C.slate300 },
      })
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 1.4, fill: { color }, line: { color },
      })
      s.addText([
        { text: value, options: { bold: true, fontSize: 36, color, fontFace: 'Georgia' } },
        { text: ' ' + unit, options: { fontSize: 14, color: C.slate500, fontFace: 'Calibri' } },
      ], {
        x: x + 0.2, y: y + 0.15, w: w - 0.25, h: 0.7, margin: 0, valign: 'middle',
      })
      s.addText(label, {
        x: x + 0.2, y: y + 0.85, w: w - 0.25, h: 0.5, fontSize: 11,
        fontFace: 'Calibri', color: C.slate700, margin: 0,
      })
    }
    bigStat(1.0, 1.55, 2.75, '147', 'chunks', 'Cloudflare Vectorize index  ·  384-dim cosine', C.navy)
    bigStat(3.95, 1.55, 2.75, '<500', 'ms P95', 'Unified /context endpoint (evidence + similar)', C.teal)
    bigStat(6.9, 1.55, 2.75, 'top-5', 'each', 'Evidence snippets + similar past cases per obs', C.accent)

    // Contents + privacy row
    s.addShape(pres.shapes.RECTANGLE, {
      x: 1.0, y: 3.15, w: 4.25, h: 1.8, fill: { color: C.white }, line: { color: C.slate300 },
    })
    s.addImage({ data: ICONS.bookNavy, x: 1.2, y: 3.3, w: 0.45, h: 0.45 })
    s.addText('What\'s indexed today', {
      x: 1.75, y: 3.3, w: 3.4, h: 0.3, fontSize: 13, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0, valign: 'middle',
    })
    s.addText([
      { text: '52 4D condition descriptions', options: { bullet: true, breakLine: true } },
      { text: '20 M-CHAT items with domain + criticality', options: { bullet: true, breakLine: true } },
      { text: 'Per-module parent-education intros', options: { bullet: true, breakLine: true } },
      { text: 'Condition-level parent guidance', options: { bullet: true } },
    ], {
      x: 1.2, y: 3.85, w: 3.95, h: 1.1, fontSize: 10.5,
      fontFace: 'Calibri', color: C.slate700, margin: 0, paraSpaceAfter: 3,
    })

    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.45, y: 3.15, w: 4.25, h: 1.8, fill: { color: C.white }, line: { color: C.slate300 },
    })
    s.addImage({ data: ICONS.lockTeal, x: 5.65, y: 3.3, w: 0.45, h: 0.45 })
    s.addText('Privacy posture', {
      x: 6.2, y: 3.3, w: 3.4, h: 0.3, fontSize: 13, bold: true,
      fontFace: 'Calibri', color: C.slate900, margin: 0, valign: 'middle',
    })
    s.addText([
      { text: 'Only curated, pre-approved educational content', options: { bullet: true, breakLine: true } },
      { text: '280-char previews in metadata, no full text', options: { bullet: true, breakLine: true } },
      { text: 'No PHI, no patient-record free text', options: { bullet: true, breakLine: true } },
      { text: 'Index versioned in evidence_index_version', options: { bullet: true } },
    ], {
      x: 5.65, y: 3.85, w: 3.95, h: 1.1, fontSize: 10.5,
      fontFace: 'Calibri', color: C.slate700, margin: 0, paraSpaceAfter: 3,
    })
    addFooter(s, 6, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 7 · Feature 4 — Population Health Q1-Q5 (tile grid)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.6, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
    })
    s.addText('4', {
      x: 0, y: 0.3, w: 0.6, h: 0.7, fontSize: 40, bold: true,
      fontFace: 'Georgia', color: C.white, align: 'center', margin: 0,
    })
    s.addText('Feature 4', {
      x: 0, y: 1.0, w: 0.6, h: 0.3, fontSize: 9, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    })
    s.addText('Population health analytics', {
      x: 1.0, y: 0.4, w: 8.7, h: 0.55, fontSize: 26, bold: true,
      fontFace: 'Georgia', color: C.slate900, margin: 0,
    })
    s.addText('Five canonical tiles live on /population-health  ·  Turso hot path + nightly Parquet', {
      x: 1.0, y: 0.95, w: 8.7, h: 0.3, fontSize: 12, italic: true,
      fontFace: 'Calibri', color: C.teal, margin: 0,
    })

    const tile = (x, y, w, h, q, title, useCase, color) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h, fill: { color: C.white }, line: { color: C.slate300 },
        shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 135, opacity: 0.08 },
      })
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h, fill: { color }, line: { color },
      })
      s.addText(q, {
        x: x + 0.2, y: y + 0.1, w: 0.6, h: 0.35, fontSize: 18, bold: true,
        fontFace: 'Georgia', color, margin: 0,
      })
      s.addText(title, {
        x: x + 0.75, y: y + 0.12, w: w - 0.85, h: 0.35, fontSize: 11.5, bold: true,
        fontFace: 'Calibri', color: C.slate900, margin: 0, valign: 'middle',
      })
      s.addText(useCase, {
        x: x + 0.2, y: y + 0.5, w: w - 0.3, h: h - 0.6, fontSize: 10,
        fontFace: 'Calibri', color: C.slate700, margin: 0, italic: true,
      })
    }
    // Row 1 — 3 tiles
    const R1Y = 1.5, R1H = 1.55
    const T1W = (10 - 1.0 - 0.35 - 0.25 * 2) / 3
    tile(1.0, R1Y, T1W, R1H, 'Q1', 'AI ↔ clinician agreement',
      'Catch miscalibration per module × age band early', C.navy)
    tile(1.0 + T1W + 0.25, R1Y, T1W, R1H, 'Q2', 'AI spend breakdown',
      'Detect cost regressions from a model swap within 7 days', C.teal)
    tile(1.0 + (T1W + 0.25) * 2, R1Y, T1W, R1H, 'Q3', 'Red-flag prevalence',
      'Flag unusual campaign × age × gender clusters for follow-up', C.rose)

    // Row 2 — 2 wider tiles
    const R2Y = 3.2, R2H = 1.55
    const T2W = (10 - 1.0 - 0.35 - 0.25) / 2
    tile(1.0, R2Y, T2W, R2H, 'Q4', 'Screener throughput',
      'Identify training opportunities or tool friction per nurse', C.accent)
    tile(1.0 + T2W + 0.25, R2Y, T2W, R2H, 'Q5', 'Time-to-review SLA',
      'P50 / P95 / P99 minutes by decision — SLA monitoring', C.amber)

    s.addText('Analysts can also query the nightly de-identified Parquet directly — no PHI, safe for research.', {
      x: 1.0, y: 4.92, w: 8.7, h: 0.35, fontSize: 10, italic: true,
      fontFace: 'Calibri', color: C.slate500, margin: 0,
    })
    addFooter(s, 7, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 8 · Feature 5 — Liquid AI
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.6, h: 5.625, fill: { color: C.teal }, line: { color: C.teal },
    })
    s.addText('5', {
      x: 0, y: 0.3, w: 0.6, h: 0.7, fontSize: 40, bold: true,
      fontFace: 'Georgia', color: C.white, align: 'center', margin: 0,
    })
    s.addText('Feature 5', {
      x: 0, y: 1.0, w: 0.6, h: 0.3, fontSize: 9, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    })
    s.addText('On-device Liquid AI — LFM2.5-VL-450M', {
      x: 1.0, y: 0.4, w: 8.7, h: 0.55, fontSize: 24, bold: true,
      fontFace: 'Georgia', color: C.slate900, margin: 0,
    })
    s.addText('Zero cloud egress  ·  OPFS cached  ·  per-shard SHA-256 verified', {
      x: 1.0, y: 0.95, w: 8.7, h: 0.3, fontSize: 12, italic: true,
      fontFace: 'Calibri', color: C.teal, margin: 0,
    })

    // Two columns: what's live, what's pending
    const card = (x, title, headerColor, items, titleColor) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.5, w: 4.1, h: 3.55, fill: { color: C.white }, line: { color: C.slate300 },
        shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 135, opacity: 0.1 },
      })
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.5, w: 4.1, h: 0.55, fill: { color: headerColor }, line: { color: headerColor },
      })
      s.addText(title, {
        x: x + 0.2, y: 1.5, w: 3.8, h: 0.55, fontSize: 14, bold: true,
        fontFace: 'Calibri', color: C.white, valign: 'middle', margin: 0,
      })
      const bulletTexts = items.flatMap((t, i) => [
        { text: t, options: { bullet: true, breakLine: i < items.length - 1 } },
      ])
      s.addText(bulletTexts, {
        x: x + 0.3, y: 2.25, w: 3.7, h: 2.65, fontSize: 11,
        fontFace: 'Calibri', color: C.slate700, margin: 0, paraSpaceAfter: 5,
      })
    }
    card(1.0, 'LIVE IN PRODUCTION', C.green, [
      'Same-origin shard proxy /api/models/:id/:version/:shard',
      'OPFS cache with per-shard SHA-256 verification',
      'WebLLM + WebGPU runtime handoff',
      'HITL outcome audit (suggested/accepted/rejected/edited)',
      'Pinned manifest — no silent model upgrades',
    ], C.green)
    card(5.5, 'PENDING DEV-TEAM', C.amber, [
      'LFM2.5-VL-450M weight shards not yet uploaded',
      'MODEL_MANIFEST still PENDING-PIN placeholder',
      'Mobile track (React Native runtime) not started',
      'Est. 2–4 engineering days to complete',
      'docs/HANDOVER-LIQUID-AI.md is self-contained plan',
    ], C.amber)
    addFooter(s, 8, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 9 · Safety & governance
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
    })
    s.addText('Safety & governance — shipped alongside', {
      x: 0.35, y: 0, w: 9.3, h: 0.65, fontSize: 22, bold: true,
      fontFace: 'Georgia', color: C.white, valign: 'middle', margin: 0,
    })

    const items = [
      { icon: ICONS.clipNavy, title: 'Audit everywhere', body: 'audit_log captures every write, AI decision, model-shard fetch, queue message, and failure.' },
      { icon: ICONS.shieldWhite, title: 'DLQ on every queue', body: '3 retries → dead letter → audit row + optional Langfuse trace. No poison message is silent.', iconOnDark: true },
      { icon: ICONS.gaugeTeal, title: 'Budget caps', body: 'session_ai_budget (per-session) + ai_usage (rollup). Q2 tile surfaces this on the dashboard.' },
      { icon: ICONS.branchTeal, title: 'Rollback on every flag', body: 'Every new capability is flag-gated in wrangler.toml. Flip to "0" + redeploy = instant revert.' },
      { icon: ICONS.lockTeal, title: 'PHI residency', body: 'Media stays in R2 APAC. Vectorize holds only curated text. Parent PDFs are HMAC-signed URLs, 30-day TTL.' },
      { icon: ICONS.checkGreen, title: 'Every PR verified', body: 'Typecheck + tests + /api/health smoke before merge. No deploy without a clean pipeline.' },
    ]
    items.forEach((it, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 0.4 + col * 4.75
      const y = 0.95 + row * 1.4
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.65, h: 1.2, fill: { color: C.white }, line: { color: C.slate300 },
      })
      // Icon
      if (it.iconOnDark) {
        s.addShape(pres.shapes.OVAL, {
          x: x + 0.15, y: y + 0.15, w: 0.65, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
        })
        s.addImage({ data: it.icon, x: x + 0.28, y: y + 0.28, w: 0.4, h: 0.4 })
      } else {
        s.addShape(pres.shapes.OVAL, {
          x: x + 0.15, y: y + 0.15, w: 0.65, h: 0.65, fill: { color: C.slate100 }, line: { color: C.slate100 },
        })
        s.addImage({ data: it.icon, x: x + 0.28, y: y + 0.28, w: 0.4, h: 0.4 })
      }
      s.addText(it.title, {
        x: x + 0.95, y: y + 0.12, w: 3.55, h: 0.35, fontSize: 13, bold: true,
        fontFace: 'Calibri', color: C.slate900, margin: 0,
      })
      s.addText(it.body, {
        x: x + 0.95, y: y + 0.45, w: 3.55, h: 0.75, fontSize: 10,
        fontFace: 'Calibri', color: C.slate700, margin: 0,
      })
    })
    addFooter(s, 9, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 10 · Metrics to watch
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
    })
    s.addText('Metrics to watch post-launch', {
      x: 0.35, y: 0, w: 9.3, h: 0.65, fontSize: 22, bold: true,
      fontFace: 'Georgia', color: C.white, valign: 'middle', margin: 0,
    })

    const header = (t) => ({ text: t, options: {
      bold: true, color: C.white, fill: { color: C.teal },
      fontSize: 11.5, fontFace: 'Calibri', valign: 'middle', align: 'left', margin: 6,
    }})
    const cell = (t, opts = {}) => ({ text: t, options: {
      fontSize: 10.5, fontFace: 'Calibri', color: C.slate900,
      fill: { color: C.white }, valign: 'middle', align: 'left', margin: 6, ...opts,
    }})

    const rows = [
      [header('Metric'), header('Source'), header('Target')],
      [cell('Observation P95 write latency'), cell('AI Gateway · Langfuse'), cell('< 200 ms', { bold: true, color: C.green })],
      [cell('Workflow success rate'), cell('workflow_events table'), cell('> 99%', { bold: true, color: C.green })],
      [cell('Second-opinion ↔ doctor agreement'), cell('accuracy_metrics.agreement_score'), cell('> 0.80 rolling', { bold: true, color: C.green })],
      [cell('Evidence search P95'), cell('/api/evidence/search Langfuse span'), cell('< 200 ms', { bold: true, color: C.green })],
      [cell('/context unified endpoint P95'), cell('/api/reviews/:id/context'), cell('< 500 ms', { bold: true, color: C.green })],
      [cell('DLQ depth per queue'), cell('wrangler queues consumer get'), cell('always 0   (alarm > 5)', { bold: true, color: C.rose })],
      [cell('Publishable Parquet freshness'), cell('R2 publishable/dt=…'), cell('one partition per day', { bold: true, color: C.green })],
    ]
    s.addTable(rows, {
      x: 0.35, y: 0.9, w: 9.3,
      colW: [3.7, 3.1, 2.5],
      border: { pt: 0.5, color: C.slate300 },
    })
    addFooter(s, 10, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 11 · Roadmap
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.cream }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.65, fill: { color: C.navy }, line: { color: C.navy },
    })
    s.addText('What\'s next — prioritised', {
      x: 0.35, y: 0, w: 9.3, h: 0.65, fontSize: 22, bold: true,
      fontFace: 'Georgia', color: C.white, valign: 'middle', margin: 0,
    })

    const roadItems = [
      { pri: 'P0', title: 'Liquid AI weights upload', owner: 'Dev team (handover doc ready)', eta: '2–4 eng days', color: C.rose },
      { pri: 'P1', title: 'Sandbox AI container image', owner: 'Ops + platform', eta: 'After container beta stable', color: C.amber },
      { pri: 'P1', title: 'Doctor-inbox 2nd-opinion badge in row header', owner: 'Frontend', eta: '1 sprint', color: C.amber },
      { pri: 'P2', title: 'Parent SMS / WhatsApp delivery adapter', owner: 'Integrations', eta: 'Q2', color: C.teal },
      { pri: 'P3', title: 'scripts/duckdb-repl.sh for researchers', owner: 'Ops', eta: 'Nice-to-have', color: C.slate500 },
    ]
    roadItems.forEach((r, i) => {
      const y = 1.0 + i * 0.75
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.4, y, w: 9.2, h: 0.6, fill: { color: C.white }, line: { color: C.slate300 },
      })
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.4, y, w: 0.75, h: 0.6, fill: { color: r.color }, line: { color: r.color },
      })
      s.addText(r.pri, {
        x: 0.4, y, w: 0.75, h: 0.6, fontSize: 14, bold: true,
        fontFace: 'Calibri', color: C.white, align: 'center', valign: 'middle', margin: 0,
      })
      s.addText(r.title, {
        x: 1.3, y: y + 0.06, w: 5.5, h: 0.3, fontSize: 12, bold: true,
        fontFace: 'Calibri', color: C.slate900, margin: 0,
      })
      s.addText(r.owner, {
        x: 1.3, y: y + 0.34, w: 5.5, h: 0.24, fontSize: 10,
        fontFace: 'Calibri', color: C.slate500, margin: 0,
      })
      s.addText(r.eta, {
        x: 6.9, y, w: 2.6, h: 0.6, fontSize: 11, italic: true,
        fontFace: 'Calibri', color: C.slate700, align: 'right', valign: 'middle', margin: 0,
      })
    })
    s.addText('Explicitly deferred: DuckDB in-Worker (Phase 08 / MotherDuck). Architectural decision, not a bug.', {
      x: 0.4, y: 4.9, w: 9.2, h: 0.35, fontSize: 10, italic: true,
      fontFace: 'Calibri', color: C.slate500, margin: 0,
    })
    addFooter(s, 11, TOTAL)
  }

  // ═══════════════════════════════════════════════════════════════
  // Slide 12 · How this was built (dark closing)
  // ═══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide()
    s.background = { color: C.navyDark }
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: C.accent }, line: { color: C.accent },
    })
    s.addText('How this was built', {
      x: 0.6, y: 0.4, w: 9, h: 0.6, fontSize: 30, bold: true,
      fontFace: 'Georgia', color: C.white, margin: 0,
    })
    s.addText('One engineering day — surfaced, fixed, and documented end-to-end.', {
      x: 0.6, y: 1.0, w: 9, h: 0.35, fontSize: 13, italic: true,
      fontFace: 'Calibri', color: C.slate300, margin: 0,
    })

    // Big stats row
    const dStat = (x, y, w, value, label) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h: 1.4, fill: { color: C.navy, transparency: 30 }, line: { color: C.teal },
      })
      s.addText(value, {
        x, y: y + 0.15, w, h: 0.7, fontSize: 40, bold: true,
        fontFace: 'Georgia', color: C.accent, align: 'center', margin: 0,
      })
      s.addText(label, {
        x, y: y + 0.85, w, h: 0.5, fontSize: 11,
        fontFace: 'Calibri', color: C.slate300, align: 'center', margin: 0,
      })
    }
    dStat(0.6, 1.7, 2.15, '13', 'PRs merged today')
    dStat(2.95, 1.7, 2.15, '7', 'feature PRs (#22–29)')
    dStat(5.3, 1.7, 2.15, '6', 'fix PRs (#30–36)')
    dStat(7.65, 1.7, 2.15, '100%', 'auto-squash + verified')

    // Three-line how bullets
    s.addText([
      { text: 'Typecheck + tests before every merge', options: { bullet: true, breakLine: true } },
      { text: '/api/health + canonical-query smoke after every deploy', options: { bullet: true, breakLine: true } },
      { text: 'Feature flags on every capability — instant rollback path', options: { bullet: true, breakLine: true } },
      { text: 'Full blueprint + deferred-items register in docs/BLUEPRINT.md', options: { bullet: true } },
    ], {
      x: 0.6, y: 3.4, w: 9, h: 1.6, fontSize: 13,
      fontFace: 'Calibri', color: C.white, margin: 0, paraSpaceAfter: 6,
    })

    // Closing tagline
    s.addText('Shipped · Auditable · Rollbackable', {
      x: 0.6, y: 5.05, w: 9, h: 0.35, fontSize: 11, bold: true, italic: true,
      fontFace: 'Calibri', color: C.accent, align: 'right', margin: 0,
      charSpacing: 4,
    })
  }

  const outPath = path.join(__dirname, 'edge-stack-v1-release.pptx')
  await pres.writeFile({ fileName: outPath })
  console.log('✓ wrote', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
