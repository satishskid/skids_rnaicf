import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { CampaignsPage } from './pages/Campaigns'
import { CampaignDetailPage } from './pages/CampaignDetail'
import { AnalyticsPage } from './pages/Analytics'
import { SettingsPage } from './pages/Settings'
import { DoctorInboxPage } from './pages/DoctorInbox'
import { AuthorityDashboardPage } from './pages/AuthorityDashboard'
import { FourDReportPage } from './pages/FourDReport'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with sidebar layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:code" element={<CampaignDetailPage />} />
            <Route path="/campaigns/:code/children/:childId/report" element={<FourDReportPage />} />
            <Route path="/doctor-inbox" element={<DoctorInboxPage />} />
            <Route path="/authority" element={<AuthorityDashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
