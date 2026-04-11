import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { UploadPage } from './pages/UploadPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { DocumentViewPage } from './pages/DocumentViewPage'
import { WelcomeWizard } from './pages/WelcomeWizard'
import './i18n'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<WelcomeWizard />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<UploadPage />} />
          <Route path="/document/:id" element={<DocumentViewPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
