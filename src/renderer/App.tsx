import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import i18n from 'i18next'
import { MainLayout } from './components/layout/MainLayout'
import { applyLanguageDirection } from './hooks/useLanguageDirection'
import './i18n'

// Route-basiertes Code-Splitting: jede Seite wird erst beim Navigieren geladen,
// statt alles in einen Renderer-Chunk zu packen. Named exports -> default mappen.
const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })))
const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
)
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const DocumentViewPage = lazy(() =>
  import('./pages/DocumentViewPage').then((m) => ({ default: m.DocumentViewPage }))
)
const WelcomeWizard = lazy(() =>
  import('./pages/WelcomeWizard').then((m) => ({ default: m.WelcomeWizard }))
)

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 size={24} className="animate-spin text-brand-cyan" aria-label="Lädt" />
    </div>
  )
}

export function App() {
  // Persistierte UI-Sprache laden und auf i18n + Schreibrichtung anwenden.
  useEffect(() => {
    // Richtung fuer die Default-Sprache sofort setzen (vermeidet RTL-Flackern).
    applyLanguageDirection(i18n.language)
    window.api.settings
      .get()
      .then((s) => {
        if (s.language && s.language !== i18n.language) i18n.changeLanguage(s.language)
        if (s.language) applyLanguageDirection(s.language)
      })
      .catch(() => {
        /* Default-Sprache bleibt aktiv */
      })
  }, [])

  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </HashRouter>
  )
}
