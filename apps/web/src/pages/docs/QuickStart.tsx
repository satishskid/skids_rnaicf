import { Link } from 'react-router-dom'
import {
  Rocket,
  Layers,
  Shield,
  ArrowRightLeft,
  UserCog,
  Stethoscope,
  Cpu,
  Server,
  Lock,
  HelpCircle,
  Smartphone,
  Cloud,
  Database,
  Brain,
  ClipboardList,
  Users,
  Megaphone,
  Settings,
  BarChart3,
  Eye,
  Inbox,
  CheckCircle2,
  Save,
  RefreshCw,
  FileText,
  Activity,
  Camera,
  Scan,
  Globe,
  Key,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Table of Contents                                                  */
/* ------------------------------------------------------------------ */

const TOC = [
  { id: 'architecture', label: 'Architecture Overview' },
  { id: 'auth', label: 'Access & Authentication' },
  { id: 'data-flow', label: 'Data Flow' },
  { id: 'getting-started', label: 'Getting Started by Role' },
  { id: 'ai', label: 'AI Capabilities' },
  { id: 'backend', label: 'Backend Services' },
  { id: 'security', label: 'Security & Access Control' },
  { id: 'faq', label: 'FAQ' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function SectionHeading({
  id,
  icon: Icon,
  title,
}: {
  id: string
  icon: React.ElementType
  title: string
}) {
  return (
    <div id={id} className="flex scroll-mt-20 items-center gap-2 pt-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  )
}

function StepItem({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        {step}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Architecture layers                                                */
/* ------------------------------------------------------------------ */

const ARCH_LAYERS = [
  {
    icon: Smartphone,
    title: 'Mobile App (React Native + Expo)',
    desc: 'Offline-first screening app with camera, AI modules, and local SQLite storage.',
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: Cloud,
    title: 'Worker API (Cloudflare Workers)',
    desc: 'Edge-deployed REST API handling auth, sync, reports, and business logic.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Database,
    title: 'Turso DB (libSQL)',
    desc: 'Distributed SQLite database for campaigns, children, observations, and user data.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: Brain,
    title: 'AI Pipeline',
    desc: 'Hybrid on-device and cloud analysis: rPPG vitals, red reflex, skin conditions, and more.',
    color: 'bg-orange-100 text-orange-600',
  },
]

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */

const ROLES = [
  { role: 'admin', label: 'Admin', desc: 'Full platform access, user & campaign management.' },
  { role: 'ops_manager', label: 'Ops Manager', desc: 'Campaign setup, nurse assignment, reporting.' },
  { role: 'nurse', label: 'Nurse', desc: 'Field screening, child registration, data capture.' },
  { role: 'doctor', label: 'Doctor', desc: 'Review observations, accept/refer/reject decisions.' },
  { role: 'authority', label: 'Authority', desc: 'Read-only dashboards and aggregate population data.' },
]

/* ------------------------------------------------------------------ */
/*  Data flows                                                         */
/* ------------------------------------------------------------------ */

const DATA_FLOWS = [
  {
    title: 'Screening Flow',
    steps: [
      'Nurse captures observation on device',
      'Data stored locally in SQLite',
      'Background sync uploads to Worker API',
      'Worker validates & stores in Turso DB',
    ],
  },
  {
    title: 'Doctor Review Flow',
    steps: [
      'Doctor opens inbox in web dashboard',
      'Observations grouped by child & module',
      'Doctor reviews data, images, AI results',
      'Decision: Accept / Refer / Reject per observation',
    ],
  },
  {
    title: '4D Report Flow',
    steps: [
      'All observations for a child collected',
      'Server computes module-level grades & flags',
      'Cross-module aggregation into 4D categories',
      'Final report generated with recommendations',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */

const FAQ_ITEMS = [
  {
    q: 'What is SKIDS Screen?',
    a: 'SKIDS Screen is a population-level pediatric screening platform that enables field teams to capture multi-domain health and developmental observations for school-age children.',
  },
  {
    q: 'Does the mobile app work offline?',
    a: 'Yes. The React Native app stores all data locally in SQLite and syncs to the cloud when connectivity is available. Screening can continue without any internet connection.',
  },
  {
    q: 'What screening modules are available?',
    a: 'The platform includes 27+ modules across 7 categories: growth, vision, dental, skin, vitals, behavior, and development. Each module has structured observation fields and grading logic.',
  },
  {
    q: 'How does AI analysis work?',
    a: 'AI runs in a hybrid mode. Lightweight models (rPPG, red reflex) execute on-device in real-time. Complex analyses (skin classification, growth percentiles) are processed server-side via the AI pipeline.',
  },
  {
    q: 'Who reviews the screening results?',
    a: 'Doctors review observations in the web-based Doctor Inbox. They can accept normal findings, refer abnormal cases, or reject poor-quality data for re-screening.',
  },
  {
    q: 'What is a 4D Report?',
    a: 'The 4D Report is a comprehensive child health summary that aggregates observations across all modules into four developmental dimensions, providing a holistic view with grades and recommendations.',
  },
  {
    q: 'How is data secured?',
    a: 'All API calls use bearer token authentication via Better Auth. Role-based access control restricts data visibility. Data is encrypted in transit (TLS) and at rest in Turso DB.',
  },
  {
    q: 'Can I add custom screening modules?',
    a: 'Module definitions are managed through the shared package. Admins can configure which modules are active per campaign. Adding entirely new modules requires a code change in the shared schema.',
  },
]

/* ------------------------------------------------------------------ */
/*  Admin steps                                                        */
/* ------------------------------------------------------------------ */

const ADMIN_STEPS = [
  {
    icon: Megaphone,
    title: 'Create a Campaign',
    description:
      'Navigate to Campaigns and create a new screening campaign with school name, location, and target dates.',
  },
  {
    icon: Settings,
    title: 'Configure Modules',
    description:
      'Select which screening modules (vision, dental, growth, etc.) are active for this campaign.',
  },
  {
    icon: Users,
    title: 'Add Children',
    description:
      'Import or manually register the children to be screened. Assign unique identifiers and demographic data.',
  },
  {
    icon: ClipboardList,
    title: 'Assign Nurses',
    description:
      'Add nurse users to the campaign so they can access the child list and begin screening on their devices.',
  },
  {
    icon: BarChart3,
    title: 'Monitor Progress',
    description:
      'Use the dashboard and analytics views to track screening completion rates, sync status, and flagged observations.',
  },
]

/* ------------------------------------------------------------------ */
/*  Nurse steps                                                        */
/* ------------------------------------------------------------------ */

const NURSE_STEPS = [
  {
    icon: Key,
    title: 'Log In to the App',
    description:
      'Open the SKIDS Screen mobile app and sign in with your credentials. The app will sync campaign data.',
  },
  {
    icon: Megaphone,
    title: 'Select Your Campaign',
    description:
      'Choose the active campaign assigned to you. The child roster and module list will load automatically.',
  },
  {
    icon: Users,
    title: 'Register or Select a Child',
    description:
      'Pick a child from the roster or register a new child with name, age, gender, and school details.',
  },
  {
    icon: Eye,
    title: 'Screen Each Module',
    description:
      'Work through assigned modules (vision, dental, skin, etc.). Capture observations, photos, and measurements.',
  },
  {
    icon: RefreshCw,
    title: 'Sync Data',
    description:
      'Data syncs automatically when online. You can also manually trigger a sync from the app settings.',
  },
]

/* ------------------------------------------------------------------ */
/*  Doctor steps                                                       */
/* ------------------------------------------------------------------ */

const DOCTOR_STEPS = [
  {
    icon: Key,
    title: 'Log In to the Dashboard',
    description:
      'Access the SKIDS Screen web dashboard at the provided URL and sign in with your doctor credentials.',
  },
  {
    icon: Inbox,
    title: 'Open Doctor Inbox',
    description:
      'Navigate to the Doctor Inbox to see pending observations grouped by child and screening module.',
  },
  {
    icon: Eye,
    title: 'Review Observations',
    description:
      'Examine each observation: view captured data, images, AI analysis results, and nurse notes.',
  },
  {
    icon: CheckCircle2,
    title: 'Make Decisions',
    description:
      'For each observation, choose Accept (normal), Refer (needs follow-up), or Reject (re-screen needed).',
  },
  {
    icon: Save,
    title: 'Bulk Save',
    description:
      'Save all your decisions at once. The system records your review timestamp and updates the child report.',
  },
]

/* ------------------------------------------------------------------ */
/*  AI capabilities                                                    */
/* ------------------------------------------------------------------ */

const AI_CAPABILITIES = [
  {
    icon: Activity,
    title: 'rPPG Vital Signs',
    desc: 'Contactless heart rate and SpO2 estimation using the front camera and remote photoplethysmography.',
    mode: 'On-device',
  },
  {
    icon: Eye,
    title: 'Red Reflex Detection',
    desc: 'Automated analysis of pupil reflex images to flag asymmetry or abnormal coloring indicating eye conditions.',
    mode: 'On-device',
  },
  {
    icon: Scan,
    title: 'Skin Condition Analysis',
    desc: 'Cloud-based image classification for common pediatric skin conditions including rashes, lesions, and infections.',
    mode: 'Cloud',
  },
  {
    icon: Camera,
    title: 'Dental Image Analysis',
    desc: 'AI-assisted detection of visible dental caries, plaque, and gum conditions from intra-oral photographs.',
    mode: 'Cloud',
  },
]

/* ------------------------------------------------------------------ */
/*  Backend services                                                   */
/* ------------------------------------------------------------------ */

const BACKEND_SERVICES = [
  {
    icon: Globe,
    title: 'Cloudflare Workers',
    desc: 'Edge-deployed serverless API with global low-latency access. Handles authentication, CRUD operations, sync, and report generation.',
  },
  {
    icon: Database,
    title: 'Turso DB (libSQL)',
    desc: 'Distributed SQLite-compatible database with embedded replicas. Stores campaigns, children, observations, and user accounts.',
  },
  {
    icon: Cloud,
    title: 'R2 Object Storage',
    desc: 'Cloudflare R2 for image and media storage. Screening photos, AI analysis artifacts, and exported reports.',
  },
  {
    icon: Shield,
    title: 'Better Auth',
    desc: 'Authentication framework providing email/password login, session management, bearer tokens, and role-based access control.',
  },
]

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */

export function QuickStartPage() {
  return (
    <div className="flex gap-8">
      {/* Sticky Table of Contents - desktop only */}
      <aside className="sticky top-20 hidden h-fit shrink-0 xl:block">
        <nav className="w-48 space-y-0.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            On this page
          </p>
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-10">
        {/* Page header */}
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-orange-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              Quick Start & User Manual
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Everything you need to understand and use the SKIDS Screen platform
            &mdash; from system architecture to role-specific workflows.
          </p>
        </div>

        {/* -------------------------------------------------------- */}
        {/*  1. Architecture Overview                                 */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="architecture" icon={Layers} title="Architecture Overview" />
          <p className="mt-2 text-sm text-gray-500">
            SKIDS Screen is built on a four-layer architecture designed for
            offline-first field operations with cloud synchronization.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ARCH_LAYERS.map((layer, i) => (
              <Card key={i}>
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${layer.color}`}>
                    <layer.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{layer.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{layer.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs font-medium">
              <span className="shrink-0 rounded bg-green-50 px-2 py-1 text-green-700">
                Mobile App
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-blue-700">
                Worker API
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              <span className="shrink-0 rounded bg-purple-50 px-2 py-1 text-purple-700">
                Turso DB
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              <span className="shrink-0 rounded bg-orange-50 px-2 py-1 text-orange-700">
                AI Pipeline
              </span>
            </div>
          </Card>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  2. Access & Authentication                               */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="auth" icon={Shield} title="Access & Authentication" />
          <p className="mt-2 text-sm text-gray-500">
            SKIDS Screen uses Better Auth for session-based authentication with
            bearer tokens. Access is controlled by role-based permissions.
          </p>

          <Card className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900">Authentication Flow</h3>
            <ol className="mt-3 space-y-2 text-xs text-gray-600">
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">1.</span>
                User signs in with email and password via the login page or mobile app.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">2.</span>
                Better Auth validates credentials and issues a session with a bearer token.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">3.</span>
                All subsequent API requests include the bearer token in the Authorization header.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600">4.</span>
                The Worker API middleware verifies the token and attaches the user context to each request.
              </li>
            </ol>
          </Card>

          <Card className="mt-3">
            <h3 className="text-sm font-semibold text-gray-900">User Roles</h3>
            <div className="mt-3 space-y-2">
              {ROLES.map((r) => (
                <div key={r.role} className="flex items-start gap-2">
                  <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {r.label}
                  </span>
                  <span className="text-xs text-gray-500">{r.desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  3. Data Flow                                             */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="data-flow" icon={ArrowRightLeft} title="Data Flow" />
          <p className="mt-2 text-sm text-gray-500">
            Three primary data flows drive the platform from field capture
            through medical review to comprehensive reporting.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DATA_FLOWS.map((flow, i) => (
              <Card key={i}>
                <h3 className="text-sm font-semibold text-gray-900">{flow.title}</h3>
                <ol className="mt-3 space-y-1.5">
                  {flow.steps.map((step, j) => (
                    <li key={j} className="flex gap-2 text-xs text-gray-500">
                      <span className="shrink-0 font-bold text-blue-600">{j + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  4. Getting Started by Role                               */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="getting-started" icon={UserCog} title="Getting Started by Role" />
          <p className="mt-2 text-sm text-gray-500">
            Follow the guide for your role to get up and running quickly.
          </p>

          {/* Admin Guide */}
          <Card className="mt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Admin Guide</h3>
            </div>
            <div className="mt-4 space-y-4">
              {ADMIN_STEPS.map((s, i) => (
                <StepItem
                  key={i}
                  step={i + 1}
                  icon={s.icon}
                  title={s.title}
                  description={s.description}
                />
              ))}
            </div>
          </Card>

          {/* Nurse Guide */}
          <Card className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-100">
                <ClipboardList className="h-3.5 w-3.5 text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Nurse Guide</h3>
            </div>
            <div className="mt-4 space-y-4">
              {NURSE_STEPS.map((s, i) => (
                <StepItem
                  key={i}
                  step={i + 1}
                  icon={s.icon}
                  title={s.title}
                  description={s.description}
                />
              ))}
            </div>
          </Card>

          {/* Doctor Guide */}
          <Card className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100">
                <Stethoscope className="h-3.5 w-3.5 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Doctor Guide</h3>
            </div>
            <div className="mt-4 space-y-4">
              {DOCTOR_STEPS.map((s, i) => (
                <StepItem
                  key={i}
                  step={i + 1}
                  icon={s.icon}
                  title={s.title}
                  description={s.description}
                />
              ))}
            </div>
          </Card>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  5. AI Capabilities                                       */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="ai" icon={Cpu} title="AI Capabilities" />
          <p className="mt-2 text-sm text-gray-500">
            SKIDS Screen uses a hybrid AI architecture combining on-device
            inference for real-time feedback with cloud-based models for complex
            analysis.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {AI_CAPABILITIES.map((cap, i) => (
              <Card key={i}>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
                    <cap.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{cap.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          cap.mode === 'On-device'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {cap.mode}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{cap.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  6. Backend Services                                      */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="backend" icon={Server} title="Backend Services" />
          <p className="mt-2 text-sm text-gray-500">
            The backend runs entirely on Cloudflare&apos;s edge infrastructure
            for global low-latency performance.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BACKEND_SERVICES.map((svc, i) => (
              <Card key={i}>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                    <svc.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{svc.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{svc.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  7. Security & Access Control                             */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="security" icon={Lock} title="Security & Access Control" />
          <p className="mt-2 text-sm text-gray-500">
            Multiple layers of security protect patient data throughout the
            platform.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">RBAC</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Role-based access control ensures each user only sees data and
                actions relevant to their role. API endpoints enforce
                permissions server-side.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Bearer Tokens</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Every API request is authenticated with a bearer token issued
                by Better Auth. Tokens are validated on every request at the
                edge with automatic expiry and refresh.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Data Encryption</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                All data is encrypted in transit via TLS. Turso DB provides
                encryption at rest. Media files in R2 are stored with
                server-side encryption enabled.
              </p>
            </Card>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  8. FAQ                                                   */}
        {/* -------------------------------------------------------- */}
        <section>
          <SectionHeading id="faq" icon={HelpCircle} title="Frequently Asked Questions" />
          <div className="mt-4 space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <Card key={i}>
                <h3 className="text-sm font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Bottom nav */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <Link
            to="/docs"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            &larr; Documentation Hub
          </Link>
          <Link
            to="/docs/field-guide"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Field Team Guide &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
