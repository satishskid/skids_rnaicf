import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Wrench,
  Server,
  Database,
  Globe,
  Smartphone,
  Package,
  GitBranch,
  Cloud,
  Code2,
  Layers,
  Shield,
  Terminal,
  HardDrive,
  RefreshCw,
  ArrowUpRight,
  List,
  FileCode,
  Wifi,
  WifiOff,
  Settings,
  Rocket,
} from 'lucide-react'

// ── Table of Contents ──

const TOC_ITEMS = [
  { id: 'architecture', label: 'Architecture Overview' },
  { id: 'tech-stack', label: 'Tech Stack' },
  { id: 'project-structure', label: 'Project Structure' },
  { id: 'data-model', label: 'Data Model' },
  { id: 'core-libraries', label: 'Core Libraries' },
  { id: 'api-routes', label: 'API Routes' },
  { id: 'database-schema', label: 'Database Schema' },
  { id: 'offline-sync', label: 'Offline Sync' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'env-vars', label: 'Environment Variables' },
  { id: 'build-dev', label: 'Build & Development' },
]

// ── Tech Stack Table Data ──

const TECH_STACK = [
  { layer: 'API Framework', v2: 'Next.js API Routes', v3: 'Hono on Cloudflare Workers', note: 'Edge-first, faster cold starts' },
  { layer: 'Database', v2: 'Firebase Firestore', v3: 'Turso (libSQL)', note: 'SQLite-compatible, embedded replicas' },
  { layer: 'Authentication', v2: 'Firebase Auth', v3: 'Better Auth', note: 'Self-hosted, credential + session-based' },
  { layer: 'File Storage', v2: 'Firebase Storage', v3: 'Cloudflare R2', note: 'S3-compatible, zero egress fees' },
  { layer: 'Mobile App', v2: 'WebView wrapper', v3: 'Expo + React Native', note: 'Native modules, offline-first' },
  { layer: 'Web Frontend', v2: 'Next.js (Pages)', v3: 'Vite + React + Tailwind', note: 'SPA, Cloudflare Pages hosting' },
  { layer: 'Styling', v2: 'Tailwind CSS', v3: 'Tailwind CSS', note: 'Unchanged' },
  { layer: 'Icons', v2: 'Mixed (emoji + SVG)', v3: 'lucide-react', note: 'Consistent icon system' },
]

// ── API Routes Data ──

const API_ROUTES = [
  { method: 'GET', path: '/api/campaigns', description: 'List all campaigns with filtering and pagination' },
  { method: 'POST', path: '/api/campaigns', description: 'Create a new campaign with code generation' },
  { method: 'GET', path: '/api/campaigns/:code', description: 'Get campaign details by code' },
  { method: 'PUT', path: '/api/campaigns/:code', description: 'Update campaign settings and status' },
  { method: 'GET', path: '/api/campaigns/:code/status', description: 'Get campaign progress and screening stats' },
  { method: 'GET', path: '/api/campaigns/:code/children', description: 'List children enrolled in a campaign' },
  { method: 'POST', path: '/api/campaigns/:code/children', description: 'Enroll children (individual or bulk CSV)' },
  { method: 'PUT', path: '/api/campaigns/:code/absent', description: 'Mark children as absent' },
  { method: 'POST', path: '/api/campaigns/:code/archive', description: 'Archive a completed campaign' },
  { method: 'POST', path: '/api/campaigns/:code/welchallyn', description: 'Import Welch Allyn device data' },
  { method: 'GET', path: '/api/children/:id', description: 'Get child details by ID' },
  { method: 'PUT', path: '/api/children/:id', description: 'Update child information' },
  { method: 'GET', path: '/api/observations', description: 'List observations with campaign/child filters' },
  { method: 'POST', path: '/api/observations', description: 'Create a new observation with media' },
  { method: 'POST', path: '/api/observations/sync', description: 'Batch sync observations from mobile' },
  { method: 'GET', path: '/api/reviews', description: 'List reviews with status filtering' },
  { method: 'POST', path: '/api/reviews', description: 'Submit a doctor review decision' },
  { method: 'GET', path: '/api/training/samples', description: 'List training samples for AI model' },
  { method: 'POST', path: '/api/training/export', description: 'Export training data in ML format' },
  { method: 'POST', path: '/api/r2/presign', description: 'Generate presigned URLs for media upload' },
  { method: 'POST', path: '/api/ayusync/report', description: 'Receive AyuSync webhook reports' },
  { method: 'GET', path: '/api/ayusync/report', description: 'Query AyuSync report status' },
  { method: 'ALL', path: '/api/aws-proxy/*', description: 'CORS proxy for AWS AI services' },
  { method: 'GET', path: '/api/admin/users', description: 'List platform users (admin only)' },
  { method: 'POST', path: '/api/admin/password-reset', description: 'Reset user password (admin only)' },
  { method: 'ALL', path: '/api/auth/*', description: 'Better Auth endpoints (login, session, etc.)' },
]

// ── Database Tables ──

const DB_TABLES = [
  { name: 'campaigns', columns: 'code, name, status, location, modules, settings, createdBy, createdAt', description: 'Campaign definitions and configuration' },
  { name: 'children', columns: 'id, name, dob, gender, class, section, campaignCode, enrolledAt', description: 'Enrolled children within campaigns' },
  { name: 'observations', columns: 'id, moduleType, childId, campaignCode, mediaUrl, annotationData, aiAnnotations, screenedBy, timestamp', description: 'Individual screening observations per module' },
  { name: 'reviews', columns: 'id, observationId, decision, qualityRating, notes, reviewedBy, timestamp', description: 'Doctor review decisions on observations' },
  { name: 'sync_state', columns: 'id, deviceId, lastSyncAt, pendingCount, syncErrors', description: 'Mobile device sync tracking' },
  { name: 'ai_usage', columns: 'id, observationId, model, tokens, latency, timestamp', description: 'AI inference usage and cost tracking' },
  { name: 'absences', columns: 'id, childId, campaignCode, date, reason', description: 'Child absence records during screening' },
  { name: 'training_samples', columns: 'id, observationId, moduleType, label, verified, exportedAt', description: 'Verified samples for AI model training' },
  { name: 'ayusync_reports', columns: 'id, campaignCode, childId, reportData, receivedAt, status', description: 'External AyuSync integration reports' },
]

// ── Environment Variables ──

const ENV_VARS = [
  { name: 'DATABASE_URL', scope: 'Worker', description: 'Turso database connection URL' },
  { name: 'DATABASE_AUTH_TOKEN', scope: 'Worker', description: 'Turso authentication token' },
  { name: 'R2_BUCKET', scope: 'Worker', description: 'Cloudflare R2 bucket binding name' },
  { name: 'R2_PUBLIC_URL', scope: 'Worker', description: 'Public URL for R2 bucket assets' },
  { name: 'BETTER_AUTH_SECRET', scope: 'Worker', description: 'Secret key for Better Auth sessions' },
  { name: 'BETTER_AUTH_URL', scope: 'Worker', description: 'Base URL for auth callbacks' },
  { name: 'AWS_ACCESS_KEY_ID', scope: 'Worker', description: 'AWS credentials for AI proxy' },
  { name: 'AWS_SECRET_ACCESS_KEY', scope: 'Worker', description: 'AWS credentials for AI proxy' },
  { name: 'AWS_REGION', scope: 'Worker', description: 'AWS region for AI services' },
  { name: 'AYUSYNC_WEBHOOK_SECRET', scope: 'Worker', description: 'Shared secret for AyuSync webhooks' },
  { name: 'VITE_API_URL', scope: 'Web', description: 'API base URL for web frontend' },
  { name: 'VITE_R2_PUBLIC_URL', scope: 'Web', description: 'Public URL for media assets' },
  { name: 'EXPO_PUBLIC_API_URL', scope: 'Mobile', description: 'API base URL for mobile app' },
]

// ── Main Component ──

export function TechManualPage() {
  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link
        to="/docs"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Documentation
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-purple-100 p-3">
            <Wrench className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Technical Manual</h1>
            <p className="mt-1 text-sm text-gray-500">
              SKIDS Screen V3 &mdash; For Engineers & DevOps
            </p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="mb-3 flex items-center gap-2">
          <List className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900">Table of Contents</h2>
        </div>
        <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {TOC_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white hover:text-blue-600"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* 1. Architecture Overview */}
      <section id="architecture" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Architecture Overview</h2>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          SKIDS Screen V3 is a monorepo built with pnpm workspaces. The
          architecture follows an edge-first approach with Cloudflare Workers
          for the API, a Vite SPA for the web dashboard, and Expo React Native
          for the mobile screening app.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ArchCard
            icon={Server}
            title="apps/worker"
            subtitle="API Server"
            description="Hono framework on Cloudflare Workers. RESTful API with Better Auth, Turso DB, and R2 storage."
            color="bg-orange-100 text-orange-600"
          />
          <ArchCard
            icon={Globe}
            title="apps/web"
            subtitle="Web Dashboard"
            description="Vite + React + Tailwind CSS SPA. Campaign management, doctor review inbox, analytics, and docs."
            color="bg-blue-100 text-blue-600"
          />
          <ArchCard
            icon={Smartphone}
            title="apps/mobile"
            subtitle="Screening App"
            description="Expo + React Native with offline-first sync. Camera capture, annotation, and field screening."
            color="bg-green-100 text-green-600"
          />
          <ArchCard
            icon={Package}
            title="packages/shared"
            subtitle="Shared Logic"
            description="TypeScript types, module configs, annotation chips, 4D mapping, quality scoring, and lifecycle."
            color="bg-purple-100 text-purple-600"
          />
          <ArchCard
            icon={Database}
            title="packages/db"
            subtitle="Database Layer"
            description="Turso/libSQL schema definitions, migrations, and connection utilities."
            color="bg-yellow-100 text-yellow-600"
          />
        </div>
      </section>

      {/* 2. Tech Stack */}
      <section id="tech-stack" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Code2 className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Tech Stack</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          V3 migrated from Firebase/Next.js to an edge-native stack for
          improved performance, cost efficiency, and offline capabilities.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-4 font-semibold text-gray-900">Layer</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">V2 (Legacy)</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">V3 (Current)</th>
                <th className="pb-3 font-semibold text-gray-900">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TECH_STACK.map((row) => (
                <tr key={row.layer}>
                  <td className="py-3 pr-4 font-medium text-gray-900">{row.layer}</td>
                  <td className="py-3 pr-4 text-gray-400 line-through">{row.v2}</td>
                  <td className="py-3 pr-4 font-medium text-purple-700">{row.v3}</td>
                  <td className="py-3 text-xs text-gray-500">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Project Structure */}
      <section id="project-structure" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Project Structure</h2>
        </div>
        <div className="overflow-x-auto rounded-lg bg-gray-900 p-5">
          <pre className="text-xs leading-relaxed text-green-400 font-mono">
{`skids-screen-v3/
|-- apps/
|   |-- worker/                # Cloudflare Worker API
|   |   |-- src/
|   |   |   |-- routes/        # Hono route handlers
|   |   |   |   |-- campaigns.ts
|   |   |   |   |-- children.ts
|   |   |   |   |-- observations.ts
|   |   |   |   |-- reviews.ts
|   |   |   |   |-- training.ts
|   |   |   |   |-- r2.ts
|   |   |   |   |-- admin.ts
|   |   |   |   |-- ayusync.ts
|   |   |   |   \`-- auth.ts
|   |   |   |-- middleware/    # Auth, CORS, logging
|   |   |   \`-- index.ts       # Hono app entry
|   |   |-- wrangler.toml      # Cloudflare config
|   |   \`-- package.json
|   |
|   |-- web/                   # Vite + React SPA
|   |   |-- src/
|   |   |   |-- pages/         # Route pages
|   |   |   |-- components/    # Shared UI components
|   |   |   |-- lib/           # Hooks, API client, utils
|   |   |   \`-- main.tsx       # App entry
|   |   |-- index.html
|   |   \`-- vite.config.ts
|   |
|   \`-- mobile/                # Expo React Native
|       |-- app/               # File-based routing
|       |-- components/        # Native UI components
|       |-- lib/               # Sync engine, storage
|       \`-- app.json           # Expo config
|
|-- packages/
|   |-- shared/                # Shared TypeScript logic
|   |   \`-- src/
|   |       |-- types.ts       # Core type definitions
|   |       |-- modules.ts     # 27+ module configs
|   |       |-- annotations.ts # 300+ annotation chips
|   |       |-- four-d-mapping.ts  # 52 conditions, 4D report
|   |       |-- quality-scoring.ts # Observation quality
|   |       |-- screening-lifecycle.ts  # Status computation
|   |       \`-- campaigns.ts   # Templates, sync, codes
|   |
|   \`-- db/                    # Database package
|       \`-- src/
|           |-- schema.ts      # Turso/libSQL schema
|           |-- migrations/    # SQL migration files
|           \`-- connection.ts  # DB connection factory
|
|-- pnpm-workspace.yaml
|-- turbo.json                 # Turborepo pipeline
\`-- package.json`}
          </pre>
        </div>
      </section>

      {/* 4. Data Model */}
      <section id="data-model" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileCode className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Data Model</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Key TypeScript interfaces from <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">packages/shared/src/types.ts</code>.
        </p>
        <div className="space-y-4">
          <CodeBlock title="Campaign" code={
`interface Campaign {
  code: string          // Unique 6-char campaign code
  name: string          // Human-readable campaign name
  status: 'draft' | 'active' | 'completed' | 'archived'
  modules: ModuleType[] // Enabled screening modules
  location: {
    state: string
    district: string
    school: string
  }
  settings: {
    ageGroup: AgeGroup
    enableAI: boolean
    requireReview: boolean
  }
  createdBy: string
  createdAt: string     // ISO timestamp
}`} />
          <CodeBlock title="Child" code={
`interface Child {
  id: string            // UUID
  name: string
  dob: string           // ISO date (YYYY-MM-DD)
  gender: 'male' | 'female' | 'other'
  class: string         // Grade/class (e.g., "3", "UKG")
  section?: string      // Section (e.g., "A", "B")
  campaignCode: string  // FK to campaign
  enrolledAt: string    // ISO timestamp
}`} />
          <CodeBlock title="Observation" code={
`interface Observation {
  id: string            // UUID
  moduleType: ModuleType
  childId: string       // FK to child
  campaignCode: string  // FK to campaign
  mediaUrl?: string     // R2 presigned URL
  annotationData: {
    selectedChips: string[]
    chipSeverities: Record<string, Severity>
    notes?: string
  }
  aiAnnotations?: Array<{
    riskCategory: RiskCategory
    summaryText: string
    confidence: number  // 0-1
  }>
  screenedBy: string
  timestamp: string     // ISO timestamp
}`} />
          <CodeBlock title="Review" code={
`interface Review {
  id: string            // UUID
  observationId: string // FK to observation
  decision: 'agree' | 'modify' | 'reject'
  qualityRating: 1 | 2 | 3 | 4 | 5
  notes?: string
  modifiedChips?: string[]
  reviewedBy: string
  timestamp: string     // ISO timestamp
}`} />
        </div>
      </section>

      {/* 5. Core Libraries */}
      <section id="core-libraries" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Core Libraries</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Shared business logic in <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">packages/shared/src/</code>.
        </p>
        <div className="space-y-3">
          <LibraryCard
            file="modules.ts"
            description="27+ module configurations defining each screening module (dental, vision, hearing, skin, posture, etc.) with metadata, age group eligibility, and capture instructions."
            exports={['MODULE_CONFIGS', 'getModuleName()', 'getModulesForAgeGroup()']}
          />
          <LibraryCard
            file="annotations.ts"
            description="300+ clinical annotation chips organized by module. Each chip has an ID, label, severity options, and category mapping for the 4D report."
            exports={['ANNOTATION_CHIPS', 'getChipsForModule()', 'getChipById()']}
          />
          <LibraryCard
            file="four-d-mapping.ts"
            description="52 clinical conditions mapped across 7 categories. Computes the complete 4D report from observations, determining condition status, severity, and overall risk."
            exports={['FOUR_D_CONDITIONS', 'computeFourDReport()', 'FOUR_D_CATEGORY_LABELS', 'FOUR_D_CATEGORY_COLORS']}
          />
          <LibraryCard
            file="quality-scoring.ts"
            description="Observation quality computation based on image clarity, annotation completeness, and capture conditions. Used for training data selection and field team feedback."
            exports={['computeObservationQuality()', 'QUALITY_THRESHOLDS']}
          />
          <LibraryCard
            file="screening-lifecycle.ts"
            description="Status computation for children and campaigns. Determines screening progress, completion percentage, and pending review counts."
            exports={['computeChildStatus()', 'computeCampaignProgress()', 'SCREENING_STATES']}
          />
          <LibraryCard
            file="campaigns.ts"
            description="Campaign templates, sync payload builders, and code generation utilities. Handles offline sync payloads and campaign initialization."
            exports={['CAMPAIGN_TEMPLATES', 'buildSyncPayload()', 'generateCampaignCode()']}
          />
        </div>
      </section>

      {/* 6. API Routes */}
      <section id="api-routes" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">API Routes</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          All endpoints are served by Hono on Cloudflare Workers. Authentication
          via Better Auth session cookies. Base URL configurable via environment variables.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-3 font-semibold text-gray-900">Method</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Path</th>
                <th className="pb-3 font-semibold text-gray-900">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {API_ROUTES.map((route) => (
                <tr key={`${route.method}-${route.path}`}>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold font-mono ${
                        route.method === 'GET'
                          ? 'bg-green-100 text-green-800'
                          : route.method === 'POST'
                            ? 'bg-blue-100 text-blue-800'
                            : route.method === 'PUT'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {route.method}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <code className="text-xs font-mono text-purple-700">{route.path}</code>
                  </td>
                  <td className="py-2.5 text-xs text-gray-500">{route.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Database Schema */}
      <section id="database-schema" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Database Schema</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Turso (libSQL) with 9 core tables. Schema defined in{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">packages/db/src/schema.ts</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-4 font-semibold text-gray-900">Table</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Key Columns</th>
                <th className="pb-3 font-semibold text-gray-900">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {DB_TABLES.map((table) => (
                <tr key={table.name}>
                  <td className="py-3 pr-4">
                    <code className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-mono font-semibold text-purple-700">
                      {table.name}
                    </code>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-gray-500 font-mono">{table.columns}</span>
                  </td>
                  <td className="py-3 text-xs text-gray-600">{table.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Offline Sync */}
      <section id="offline-sync" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Offline Sync</h2>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          The mobile app operates fully offline during field screening.
          Observations are stored locally in AsyncStorage and synchronized when
          connectivity is available.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-bold text-gray-900">Offline Mode</h3>
            </div>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Observations saved to AsyncStorage queue
              </li>
              <li className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Media files cached in local filesystem
              </li>
              <li className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Campaign data pre-loaded for offline access
              </li>
              <li className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Queue persists across app restarts
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-bold text-gray-900">Sync Engine</h3>
            </div>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Batch sync with configurable batch size
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Exponential backoff on failure (1s, 2s, 4s, 8s...)
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Auto-retry when connectivity restored
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                Conflict resolution: last-write-wins per observation
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4">
          <pre className="text-xs leading-relaxed text-green-400 font-mono">
{`// Sync lifecycle (simplified)
async function syncPendingObservations() {
  const queue = await AsyncStorage.getItem('sync_queue')
  const pending = JSON.parse(queue || '[]')

  for (const batch of chunk(pending, BATCH_SIZE)) {
    try {
      // 1. Upload media to R2 via presigned URLs
      const mediaUrls = await uploadMedia(batch)

      // 2. Sync observation data to API
      await api.post('/observations/sync', {
        observations: batch.map((obs, i) => ({
          ...obs, mediaUrl: mediaUrls[i]
        }))
      })

      // 3. Remove synced items from queue
      await removeFromQueue(batch.map(b => b.id))
    } catch (err) {
      await exponentialBackoff(retryCount++)
    }
  }
}`}
          </pre>
        </div>
      </section>

      {/* 9. Deployment */}
      <section id="deployment" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Deployment</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Server className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-bold text-gray-900">API (Worker)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Cloudflare Workers</p>
            <div className="rounded bg-gray-900 p-2.5">
              <code className="text-xs text-green-400 font-mono">
                cd apps/worker<br />
                pnpm run deploy<br />
                <span className="text-gray-500"># runs: wrangler deploy</span>
              </code>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Web (SPA)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Cloudflare Pages</p>
            <div className="rounded bg-gray-900 p-2.5">
              <code className="text-xs text-green-400 font-mono">
                cd apps/web<br />
                pnpm run build<br />
                <span className="text-gray-500"># auto-deployed via Pages</span>
              </code>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-bold text-gray-900">Mobile (Native)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Expo EAS Build</p>
            <div className="rounded bg-gray-900 p-2.5">
              <code className="text-xs text-green-400 font-mono">
                cd apps/mobile<br />
                eas build --platform all<br />
                <span className="text-gray-500"># submit: eas submit</span>
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Environment Variables */}
      <section id="env-vars" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Environment Variables</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          All required secrets and configuration values. Worker secrets are set
          via <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">wrangler secret put</code>.
          Web/mobile values use their respective env prefixes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 pr-4 font-semibold text-gray-900">Variable</th>
                <th className="pb-3 pr-4 font-semibold text-gray-900">Scope</th>
                <th className="pb-3 font-semibold text-gray-900">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ENV_VARS.map((v) => (
                <tr key={v.name}>
                  <td className="py-2.5 pr-4">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-gray-800">
                      {v.name}
                    </code>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.scope === 'Worker'
                          ? 'bg-orange-100 text-orange-800'
                          : v.scope === 'Web'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {v.scope}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-gray-500">{v.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 11. Build & Development */}
      <section id="build-dev" className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Terminal className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Build & Development</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          The project uses pnpm workspaces with Turborepo for build orchestration.
        </p>
        <div className="space-y-3">
          <CommandBlock title="Install dependencies" command="pnpm install" />
          <CommandBlock title="Start all dev servers" command="pnpm dev" />
          <CommandBlock title="Start web only" command="pnpm --filter web dev" />
          <CommandBlock title="Start worker only" command="pnpm --filter worker dev" />
          <CommandBlock title="Start mobile only" command="cd apps/mobile && npx expo start" />
          <CommandBlock title="Build all packages" command="pnpm build" />
          <CommandBlock title="Run type checking" command="pnpm typecheck" />
          <CommandBlock title="Run linter" command="pnpm lint" />
          <CommandBlock title="Deploy worker" command="pnpm --filter worker deploy" />
          <CommandBlock title="Run database migrations" command="pnpm --filter db migrate" />
        </div>
        <div className="mt-5 rounded-lg bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-start gap-2">
            <Rocket className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="text-sm text-purple-800">
              <strong>Quick Start:</strong> Clone the repo, run{' '}
              <code className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-mono">pnpm install</code>,
              copy <code className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-mono">.env.example</code> to{' '}
              <code className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-mono">.env</code> in each app,
              then run <code className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-mono">pnpm dev</code> to
              start all services.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-center">
        <p className="text-xs text-gray-500">
          SKIDS Screen V3 Technical Manual &mdash; Last updated March 2026
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            to="/docs"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Documentation Hub
          </Link>
          <Link
            to="/docs/clinical-reference"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Clinical Reference
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Helper Components ──

function ArchCard({
  icon: Icon,
  title,
  subtitle,
  description,
  color,
}: {
  icon: typeof Server
  title: string
  subtitle: string
  description: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-gray-600">{description}</p>
    </div>
  )
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <FileCode className="h-3.5 w-3.5 text-purple-600" />
        <span className="text-xs font-bold text-gray-700">{title}</span>
      </div>
      <div className="overflow-x-auto bg-gray-900 p-4">
        <pre className="text-xs leading-relaxed text-green-400 font-mono">{code}</pre>
      </div>
    </div>
  )
}

function LibraryCard({
  file,
  description,
  exports,
}: {
  file: string
  description: string
  exports: string[]
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-purple-600" />
        <code className="text-sm font-bold font-mono text-purple-700">{file}</code>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {exports.map((exp) => (
          <span
            key={exp}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600"
          >
            {exp}
          </span>
        ))}
      </div>
    </div>
  )
}

function CommandBlock({ title, command }: { title: string; command: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 px-4 py-3">
      <Terminal className="h-4 w-4 flex-shrink-0 text-gray-400" />
      <div className="flex-1">
        <p className="text-xs text-gray-500">{title}</p>
        <code className="text-sm font-mono font-semibold text-gray-800">{command}</code>
      </div>
    </div>
  )
}
