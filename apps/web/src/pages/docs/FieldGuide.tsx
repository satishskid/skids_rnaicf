import { Link } from 'react-router-dom'
import {
  BookOpen,
  Smartphone,
  ClipboardCheck,
  Brain,
  Eye,
  Heart,
  Stethoscope,
  Shield,
  BarChart3,
  RefreshCw,
  HelpCircle,
  CreditCard,
  Camera,
  Wifi,
  WifiOff,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Users,
  UserCog,
  FileText,
  Upload,
  Monitor,
  Tag,
  Gauge,
  Save,
  ArrowRight,
  Inbox,
  Search,
  ListChecks,
  Settings,
  Globe,
  BatteryWarning,
  RotateCcw,
  Trash2,
  LogIn,
} from 'lucide-react'
import type { ReactNode } from 'react'

// ── Internal Components ──

interface SectionProps {
  id: string
  icon: ReactNode
  title: string
  borderColor: string
  children: ReactNode
}

function Section({ id, icon, title, borderColor, children }: SectionProps) {
  return (
    <section id={id} className={`border-l-4 ${borderColor} bg-white rounded-lg shadow-sm p-6 mb-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-gray-700">{icon}</div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="text-gray-700 space-y-3">{children}</div>
    </section>
  )
}

interface StepListProps {
  steps: { title: string; description: string }[]
}

function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-3 mt-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
            {i + 1}
          </span>
          <div>
            <span className="font-semibold text-gray-900">{step.title}</span>
            <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function QuickRefTable() {
  const rows = [
    { role: 'Nurse', actions: 'Login, Select Campaign, Find Child, Screen Modules, Annotate, Save, Sync' },
    { role: 'Doctor', actions: 'Open Inbox, Select Campaign, Review by Risk, Decide (Approve/Refer/Follow-up), Save' },
    { role: 'Admin', actions: 'Create Campaign, Configure Modules, Import Children, Assign Team, Monitor' },
    { role: 'Ops Manager', actions: 'View Progress, Manage Teams, Export Data, Resolve Issues' },
    { role: 'Authority', actions: 'View Dashboard, Select Campaigns, Read Prevalence Data, Download Reports' },
  ]

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-3 border border-gray-200 font-semibold text-gray-700">Role</th>
            <th className="text-left p-3 border border-gray-200 font-semibold text-gray-700">Key Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.role} className="hover:bg-gray-50">
              <td className="p-3 border border-gray-200 font-medium text-gray-900">{row.role}</td>
              <td className="p-3 border border-gray-200 text-gray-600">{row.actions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FaqItemProps {
  question: string
  answer: string
  icon: ReactNode
}

function FaqItem({ question, answer, icon }: FaqItemProps) {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0 text-amber-600 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-gray-900">{question}</p>
        <p className="text-sm text-gray-600 mt-1">{answer}</p>
      </div>
    </div>
  )
}

// ── Main Page ──

export function FieldGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Field Team Guide</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-2">
        {/* Table of Contents */}
        <nav className="bg-white rounded-lg shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-600" />
            Contents
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { href: '#intro', label: 'What is SKIDS Screen' },
              { href: '#open-app', label: 'How to Open the App' },
              { href: '#nurse-workflow', label: 'Nurse: Screening Workflow' },
              { href: '#ai-screening', label: 'AI-Assisted Screening' },
              { href: '#welch-allyn', label: 'Welch Allyn Vision Screener' },
              { href: '#ayusynk', label: 'AyuSynk Digital Stethoscope' },
              { href: '#doctor-workflow', label: 'Doctor: Review Workflow' },
              { href: '#admin-workflow', label: 'Admin: Campaign Setup' },
              { href: '#authority-reports', label: 'Authority: Population Reports' },
              { href: '#syncing', label: 'Syncing Data' },
              { href: '#troubleshooting', label: 'Troubleshooting' },
              { href: '#quick-ref', label: 'Quick Reference Card' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline py-0.5"
              >
                <ChevronRight className="w-3 h-3" />
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* 1. What is SKIDS Screen */}
        <Section
          id="intro"
          icon={<BookOpen className="w-5 h-5" />}
          title="What is SKIDS Screen"
          borderColor="border-indigo-500"
        >
          <p>
            SKIDS Screen is a comprehensive pediatric health screening platform designed for
            school-based health programs. It enables field teams to conduct systematic screenings
            across 27+ health modules covering vision, hearing, dental, skin, cardiac, respiratory,
            and developmental assessments.
          </p>
          <p>
            The platform supports an end-to-end workflow: nurses capture screening data in the field,
            AI assists with clinical annotations, doctors review flagged cases remotely, and health
            authorities access population-level prevalence reports. All data is structured with ICD
            codes for clinical interoperability.
          </p>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-2">
            <p className="text-sm font-medium text-indigo-800">
              The app works offline-first, so screenings can continue even without an internet
              connection. Data automatically syncs when connectivity is restored.
            </p>
          </div>
        </Section>

        {/* 2. How to Open the App */}
        <Section
          id="open-app"
          icon={<Smartphone className="w-5 h-5" />}
          title="How to Open the App"
          borderColor="border-blue-500"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4" />
                Mobile App (Field Screening)
              </h4>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  Open the SKIDS Screen app on your tablet or phone (Expo-based)
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  If not installed, scan the QR code provided by your admin
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  Login with your credentials (email + password)
                </li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4" />
                Web Dashboard (Review & Admin)
              </h4>
              <ul className="text-sm text-green-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  Open Chrome or Safari on your computer
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  Navigate to your organization's SKIDS Screen URL
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 flex-shrink-0" />
                  Login with the same credentials used on mobile
                </li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 3. Nurse: Screening Workflow */}
        <Section
          id="nurse-workflow"
          icon={<ClipboardCheck className="w-5 h-5" />}
          title="For Nurses: Screening Workflow"
          borderColor="border-emerald-500"
        >
          <p>
            Follow these steps for each child's screening session. The app guides you through each
            module in order, capturing images, videos, or measurements as required.
          </p>
          <StepList
            steps={[
              {
                title: 'Login',
                description:
                  'Open the app and sign in with your nurse credentials. Your assigned campaigns will appear on the home screen.',
              },
              {
                title: 'Select Campaign',
                description:
                  'Tap the active campaign you are working on. The campaign shows the school name, date, and progress indicator.',
              },
              {
                title: 'Find or Register Child',
                description:
                  'Search for the child by name, class, or section. If the child is not pre-registered, tap "Add Child" and enter their details (name, DOB, gender, class, section).',
              },
              {
                title: 'Select Module',
                description:
                  'Choose the screening module to begin (e.g., Vision, Dental, Skin). Completed modules show a green checkmark. Modules with issues show an amber warning.',
              },
              {
                title: 'Capture Image or Video',
                description:
                  'Follow the on-screen guide to position the camera. Tap the capture button for photos, or hold for video. Ensure good lighting and focus. You can retake if the image is unclear.',
              },
              {
                title: 'Add Annotation Chips',
                description:
                  'Select clinical findings from the chip list. Each chip represents a specific condition (e.g., "Dental Caries", "Pallor"). AI may pre-suggest chips based on the captured image.',
              },
              {
                title: 'Rate Severity',
                description:
                  'For each finding, rate the severity: Normal (green), Mild (yellow), Moderate (orange), or Severe (red). This determines the child\'s risk level for doctor review.',
              },
              {
                title: 'Save Observation',
                description:
                  'Tap "Save" to store the observation locally on the device. The data is saved even if you are offline.',
              },
              {
                title: 'Continue to Next Module',
                description:
                  'Move to the next screening module. Repeat steps 4-8 until all required modules for the campaign are completed.',
              },
              {
                title: 'Sync Data',
                description:
                  'When you have internet connectivity, open the Sync screen and tap "Sync Now". All saved observations will upload to the cloud for doctor review.',
              },
            ]}
          />
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">Tip:</span> Complete all modules for one child before
              moving to the next. This ensures a complete screening record and makes doctor review
              more efficient.
            </p>
          </div>
        </Section>

        {/* 4. AI-Assisted Screening */}
        <Section
          id="ai-screening"
          icon={<Brain className="w-5 h-5" />}
          title="AI-Assisted Screening"
          borderColor="border-purple-500"
        >
          <p>
            SKIDS Screen includes an AI engine that assists nurses during the annotation step.
            After an image is captured, the AI analyzes it and suggests relevant clinical findings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 text-sm mb-1">Suggested Chips</h4>
              <p className="text-xs text-purple-700">
                AI highlights annotation chips it detects in the image. Suggested chips appear with a
                sparkle icon and a confidence percentage.
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 text-sm mb-1">Confidence Scores</h4>
              <p className="text-xs text-purple-700">
                Each suggestion shows a confidence score (e.g., 85%). Higher scores indicate stronger
                AI certainty. Scores above 70% are shown in green.
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 text-sm mb-1">Nurse Confirmation</h4>
              <p className="text-xs text-purple-700">
                The nurse always has the final say. Accept, reject, or modify AI suggestions. You can
                also add chips that the AI did not suggest.
              </p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
            <p className="text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Important:</span> AI suggestions are assistive only.
                Clinical judgment must always guide the final annotation. Never rely solely on AI
                output for diagnosis.
              </span>
            </p>
          </div>
        </Section>

        {/* 5. Welch Allyn Vision Screener */}
        <Section
          id="welch-allyn"
          icon={<Eye className="w-5 h-5" />}
          title="Welch Allyn Vision Screener"
          borderColor="border-sky-500"
        >
          <p>
            The Welch Allyn Spot Vision Screener integrates with SKIDS Screen for automated
            objective vision assessments. Results are imported directly into the child's record.
          </p>
          <StepList
            steps={[
              {
                title: 'Power on the Welch Allyn device',
                description:
                  'Ensure the device is charged and ready. Verify the device firmware is up to date for compatibility.',
              },
              {
                title: 'Connect to the app',
                description:
                  'Open the Vision module in SKIDS Screen. Tap "Connect Device" and follow the pairing instructions. The app will detect the screener via Bluetooth or Wi-Fi.',
              },
              {
                title: 'Position the child',
                description:
                  'Seat the child 1 meter from the screener. Ensure the room has controlled lighting. The child should look directly at the device.',
              },
              {
                title: 'Capture screening',
                description:
                  'Press the capture button on the Welch Allyn device. Wait for the measurement to complete (approximately 2-3 seconds).',
              },
              {
                title: 'Import results',
                description:
                  'Results (sphere, cylinder, axis for each eye) are automatically imported into the app. Review the values and confirm. The app maps results to appropriate annotation chips.',
              },
            ]}
          />
        </Section>

        {/* 6. AyuSynk Digital Stethoscope */}
        <Section
          id="ayusynk"
          icon={<Heart className="w-5 h-5" />}
          title="AyuSynk Digital Stethoscope"
          borderColor="border-rose-500"
        >
          <p>
            The AyuSynk digital stethoscope captures heart and lung sounds for cardiac and
            pulmonary screening modules. Recordings are analyzed and results returned to SKIDS
            Screen via webhook integration.
          </p>
          <StepList
            steps={[
              {
                title: 'Open the Cardiac or Pulmonary module',
                description:
                  'Navigate to the relevant module in the child\'s screening. Tap "Connect Stethoscope" to initiate the integration.',
              },
              {
                title: 'Launch AyuShare companion app',
                description:
                  'The AyuShare app opens automatically on the device. If prompted, grant the necessary permissions for microphone and Bluetooth access.',
              },
              {
                title: 'Record heart or lung sounds',
                description:
                  'Place the stethoscope on the appropriate auscultation point. Record for the recommended duration (15-30 seconds). The AyuShare app shows a live waveform during recording.',
              },
              {
                title: 'Submit for analysis',
                description:
                  'Tap "Analyze" in AyuShare. The recording is sent to the AyuSynk cloud for AI-based analysis of murmurs, crackles, wheezes, and other abnormal sounds.',
              },
              {
                title: 'Results returned via webhook',
                description:
                  'Analysis results automatically appear in SKIDS Screen within 30-60 seconds. Detected findings are pre-populated as annotation chips. The nurse reviews and confirms.',
              },
            ]}
          />
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mt-3">
            <p className="text-sm text-rose-800">
              <span className="font-semibold">Note:</span> Ensure the environment is quiet during
              recording. Background noise can affect analysis accuracy. The stethoscope must be
              firmly placed against the skin without clothing in between.
            </p>
          </div>
        </Section>

        {/* 7. Doctor: Review Workflow */}
        <Section
          id="doctor-workflow"
          icon={<Stethoscope className="w-5 h-5" />}
          title="For Doctors: Review Workflow"
          borderColor="border-teal-500"
        >
          <p>
            Doctors review screening observations submitted by nurses. The review workflow
            prioritizes children by risk level, presenting the most urgent cases first.
          </p>
          <StepList
            steps={[
              {
                title: 'Open Doctor Inbox',
                description:
                  'Navigate to the Doctor Inbox from the main menu or dashboard. The inbox shows pending reviews grouped by campaign.',
              },
              {
                title: 'Select Campaign',
                description:
                  'Choose the campaign to review. The campaign card shows total pending reviews, breakdown by risk level, and completion percentage.',
              },
              {
                title: 'Review by Risk Level',
                description:
                  'Children are sorted by risk: Severe (red) at the top, followed by Moderate (orange), Mild (yellow), and Normal (green). Click a child to open their full screening record.',
              },
              {
                title: 'Review Observation Details',
                description:
                  'For each module, review the captured image/video, nurse annotations, AI suggestions, and severity ratings. Zoom into images for closer inspection.',
              },
              {
                title: 'Make Decision',
                description:
                  'Select one of five actions: Approve (confirm findings), Refer (send to specialist), Follow-up (schedule re-check), Discharge (no action needed), or Retake (request new capture from nurse).',
              },
              {
                title: 'Rate Quality',
                description:
                  'Rate the observation quality (Good, Acceptable, Poor). This feedback helps improve nurse training and AI model calibration.',
              },
              {
                title: 'Add Clinical Notes',
                description:
                  'Add any clinical notes or recommendations. These notes are included in the child\'s 4D report and shared with parents if applicable.',
              },
              {
                title: 'Save Review',
                description:
                  'Save the review decision. The child\'s status updates immediately. Move to the next child in the queue.',
              },
            ]}
          />
        </Section>

        {/* 8. Admin: Campaign Setup */}
        <Section
          id="admin-workflow"
          icon={<UserCog className="w-5 h-5" />}
          title="For Admins: Campaign Setup"
          borderColor="border-orange-500"
        >
          <p>
            Administrators create and configure screening campaigns. Each campaign represents a
            screening event at a specific school or location.
          </p>
          <StepList
            steps={[
              {
                title: 'Create Campaign',
                description:
                  'Navigate to Campaigns and tap "New Campaign". Enter the campaign name, school name, location, and scheduled dates.',
              },
              {
                title: 'Select Template or Custom Configuration',
                description:
                  'Choose a pre-built screening template (e.g., "Full Screening", "Vision Only", "Head-to-Toe") or create a custom module selection.',
              },
              {
                title: 'Configure Modules',
                description:
                  'Select which screening modules to include. Enable or disable AI assistance per module. Set mandatory vs optional modules.',
              },
              {
                title: 'Import Children via CSV',
                description:
                  'Upload a CSV file with child data (name, DOB, gender, class, section). The system validates the data and shows import results with any errors highlighted.',
              },
              {
                title: 'Assign Team Members',
                description:
                  'Assign nurses and doctors to the campaign. Nurses will see the campaign on their mobile app. Doctors will receive the campaign in their review inbox.',
              },
              {
                title: 'Monitor Progress',
                description:
                  'Track campaign progress in real-time: children screened, modules completed, sync status, and review progress. Use the analytics dashboard for detailed breakdowns.',
              },
            ]}
          />
        </Section>

        {/* 9. Authority: Population Reports */}
        <Section
          id="authority-reports"
          icon={<BarChart3 className="w-5 h-5" />}
          title="For Authorities: Population Reports"
          borderColor="border-violet-500"
        >
          <p>
            Health authorities access population-level screening data through the Authority
            Dashboard. This provides aggregated prevalence data across campaigns, schools, and
            regions.
          </p>
          <div className="space-y-3 mt-3">
            <div className="flex gap-3 p-3 bg-violet-50 rounded-lg">
              <Globe className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Access the Authority Dashboard</p>
                <p className="text-xs text-gray-600">
                  Navigate to the Authority Dashboard from the sidebar menu. This view is available only
                  to users with the Authority role.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-violet-50 rounded-lg">
              <Search className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Select Campaigns</p>
                <p className="text-xs text-gray-600">
                  Filter by campaign, date range, school, or region. Select one or multiple campaigns
                  to aggregate data across screening events.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-violet-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Read Prevalence Data</p>
                <p className="text-xs text-gray-600">
                  View condition prevalence rates organized by the 4D report categories: Defects,
                  Delay, Disability, Deficiency, Behavioral, Immunization, and Learning. Data is
                  displayed as charts, tables, and exportable reports.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* 10. Syncing Data */}
        <Section
          id="syncing"
          icon={<RefreshCw className="w-5 h-5" />}
          title="Syncing Data"
          borderColor="border-cyan-500"
        >
          <p>
            SKIDS Screen operates offline-first. All screening data is stored locally on the device
            and syncs to the cloud when internet connectivity is available.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <Wifi className="w-5 h-5 text-green-600 mb-2" />
              <h4 className="font-semibold text-green-900 text-sm">Online</h4>
              <p className="text-xs text-green-700 mt-1">
                Data syncs automatically in the background. A green sync indicator shows the last
                successful sync time. New observations upload within seconds.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <WifiOff className="w-5 h-5 text-amber-600 mb-2" />
              <h4 className="font-semibold text-amber-900 text-sm">Offline</h4>
              <p className="text-xs text-amber-700 mt-1">
                All features continue to work. Data is saved to local storage. An amber indicator shows
                unsynced items count. You can screen without interruption.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <RotateCcw className="w-5 h-5 text-blue-600 mb-2" />
              <h4 className="font-semibold text-blue-900 text-sm">Auto-Retry</h4>
              <p className="text-xs text-blue-700 mt-1">
                When connectivity returns, the app automatically retries syncing. Failed syncs are
                retried with exponential backoff. Manual sync is also available.
              </p>
            </div>
          </div>
        </Section>

        {/* 11. Troubleshooting */}
        <Section
          id="troubleshooting"
          icon={<HelpCircle className="w-5 h-5" />}
          title="Troubleshooting"
          borderColor="border-amber-500"
        >
          <p className="mb-3">Common issues and how to resolve them:</p>
          <div className="space-y-2">
            <FaqItem
              icon={<Monitor className="w-4 h-4" />}
              question="App won't load or shows a blank screen"
              answer="Clear the app cache and restart. On mobile, force-close and reopen. On web, clear browser cache (Ctrl+Shift+R) and try again. Ensure you are using a supported browser (Chrome, Safari, Edge)."
            />
            <FaqItem
              icon={<Camera className="w-4 h-4" />}
              question="Camera is not working"
              answer="Check that camera permissions are granted in your device settings. On web, click the camera icon in the address bar to allow access. Ensure no other app is using the camera."
            />
            <FaqItem
              icon={<RefreshCw className="w-4 h-4" />}
              question="Sync failed or stuck"
              answer="Check your internet connection. Try tapping 'Sync Now' manually. If the issue persists, check the sync queue for errors. Large files (videos) may need a stronger Wi-Fi connection."
            />
            <FaqItem
              icon={<LogIn className="w-4 h-4" />}
              question="Cannot login"
              answer="Verify your email and password. Check if your account is active with your admin. If you forgot your password, use the 'Forgot Password' link on the login screen."
            />
            <FaqItem
              icon={<Upload className="w-4 h-4" />}
              question="CSV import shows errors"
              answer="Ensure your CSV file matches the required format: columns for name, dob (YYYY-MM-DD), gender (M/F), class, section. Remove any special characters or extra columns."
            />
            <FaqItem
              icon={<Tag className="w-4 h-4" />}
              question="AI suggestions not appearing"
              answer="AI requires an active internet connection to analyze images. If offline, annotations must be done manually. AI is only enabled for modules where the admin has activated it."
            />
            <FaqItem
              icon={<BatteryWarning className="w-4 h-4" />}
              question="App is slow or freezing"
              answer="Close other apps to free memory. If screening many children, sync periodically to reduce local storage usage. Restart the device if performance does not improve."
            />
            <FaqItem
              icon={<Trash2 className="w-4 h-4" />}
              question="Data appears to be missing"
              answer="Check if data has been synced (look for the sync status indicator). Unsynced data is stored locally and may not appear on the web dashboard until synced. Contact support if data is lost after a sync."
            />
            <FaqItem
              icon={<Settings className="w-4 h-4" />}
              question="Welch Allyn or AyuSynk won't connect"
              answer="Ensure Bluetooth is enabled on your device. Restart both the peripheral device and the app. Check that the device firmware is compatible. Contact your admin if the issue persists."
            />
          </div>
        </Section>

        {/* 12. Quick Reference Card */}
        <Section
          id="quick-ref"
          icon={<CreditCard className="w-5 h-5" />}
          title="Quick Reference Card"
          borderColor="border-gray-500"
        >
          <p>A compact reference of key actions by role for quick lookup in the field:</p>
          <QuickRefTable />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-green-900">Normal</p>
              <p className="text-xs text-green-700">No action needed</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-yellow-900">Mild</p>
              <p className="text-xs text-yellow-700">Monitor / Follow-up</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-orange-900">Moderate</p>
              <p className="text-xs text-orange-700">Refer to specialist</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-red-900">Severe</p>
              <p className="text-xs text-red-700">Urgent referral</p>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-6">
          <p>SKIDS Screen V3 Field Team Guide</p>
          <p className="mt-1">
            For additional help, contact your campaign administrator or{' '}
            <Link to="/docs/ops-manual" className="text-indigo-600 hover:underline">
              view the Operations Manual
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
