import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from 'sonner'

// Lazy-loaded screening & AI pages (large bundles, code-split)
const ScreeningPage = lazy(() => import('./pages/ScreeningPage'))
const ModuleScreen = lazy(() => import('./pages/ModuleScreen'))
const LocalAIPage = lazy(() => import('./pages/LocalAIPage'))
import { Layout } from './components/Layout'
import { DocsLayout } from './components/DocsLayout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { CampaignsPage } from './pages/Campaigns'
import { CampaignDetailPage } from './pages/CampaignDetail'
import { AnalyticsPage } from './pages/Analytics'
import { SettingsPage } from './pages/Settings'
import { UserManagementPage } from './pages/UserManagement'
import { DoctorInboxPage } from './pages/DoctorInbox'
import { AuthorityDashboardPage } from './pages/AuthorityDashboard'
import { FourDReportPage } from './pages/FourDReport'
import { ChildReportPage } from './pages/ChildReport'
import { ParentReportPage } from './pages/ParentReport'
import { ParentPortalPage } from './pages/ParentPortal'
import { DocsHubPage } from './pages/docs/DocsHub'
import { QuickStartPage } from './pages/docs/QuickStart'
import { FieldGuidePage } from './pages/docs/FieldGuide'
import { OpsManualPage } from './pages/docs/OpsManual'
import { ClinicalReferencePage } from './pages/docs/ClinicalReference'
import { TechManualPage } from './pages/docs/TechManual'
import { ConsentManagementPage } from './pages/ConsentManagement'
import { InstrumentBuilderPage } from './pages/InstrumentBuilder'
import { StudiesPage } from './pages/Studies'
import { StudyDetailPage } from './pages/StudyDetail'
import { PopulationHealthPage } from './pages/PopulationHealth'

export function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/report/:token" element={<ParentReportPage />} />
          <Route path="/parent" element={<ParentPortalPage />} />

          {/* Protected routes with sidebar layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:code" element={<CampaignDetailPage />} />
            <Route path="/campaigns/:code/children/:childId/report" element={<FourDReportPage />} />
            <Route path="/campaigns/:code/children/:childId/child-report" element={<ChildReportPage />} />
            <Route path="/doctor-inbox" element={<DoctorInboxPage />} />
            <Route path="/authority" element={<AuthorityDashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/consents" element={<ConsentManagementPage />} />
            <Route path="/instruments" element={<InstrumentBuilderPage />} />
            <Route path="/studies" element={<StudiesPage />} />
            <Route path="/studies/:id" element={<StudyDetailPage />} />
            <Route path="/population-health" element={<PopulationHealthPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Screening routes (lazy-loaded) */}
            <Route path="/screen/:code" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><ScreeningPage /></Suspense>} />
            <Route path="/screen/:code/:childId/:module" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><ModuleScreen /></Suspense>} />
          </Route>

          {/* Local AI demo (public, lazy-loaded) */}
          <Route path="/local-ai" element={<Suspense fallback={<div className="p-8 text-center">Loading AI...</div>}><LocalAIPage /></Suspense>} />

          {/* Documentation pages with docs layout */}
          <Route element={<DocsLayout />}>
            <Route path="/docs" element={<DocsHubPage />} />
            <Route path="/docs/quick-start" element={<QuickStartPage />} />
            <Route path="/docs/field-guide" element={<FieldGuidePage />} />
            <Route path="/docs/ops-manual" element={<OpsManualPage />} />
            <Route path="/docs/clinical-reference" element={<ClinicalReferencePage />} />
            <Route path="/docs/tech-manual" element={<TechManualPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
