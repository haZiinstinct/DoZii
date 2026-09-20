import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import i18n from 'i18next'
import { MainLayout } from './components/layout/MainLayout'
import { applyLanguageDirection } from './hooks/useLanguageDirection'
import { applyAppearance } from './hooks/useAppearance'
import { switchLanguage } from './i18n'

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
  /*
   * Erststart-Weiche.
   *
   * Der Willkommens-Assistent existierte seit jeher, aber niemand navigierte
   * je dorthin - 216 Zeilen Onboarding, die kein Nutzer gesehen hat. Wer
   * DoZii zum ersten Mal oeffnete, landete direkt auf der Hochlade-Seite,
   * ohne Ollama und ohne Modell.
   *
   * null = noch nicht geprueft. Solange wird nichts gerendert, sonst blitzt
   * die Hochlade-Seite fuer einen Moment auf, bevor umgeleitet wird.
   */
  const [firstLaunchDone, setFirstLaunchDone] = useState<boolean | null>(null)

  // Persistierte UI-Sprache laden und auf i18n + Schreibrichtung anwenden.
  useEffect(() => {
    // Richtung fuer die Default-Sprache sofort setzen (vermeidet RTL-Flackern).
    applyLanguageDirection(i18n.language)
    window.api.settings
      .get()
      .then((s) => {
        if (s.language && s.language !== i18n.language) void switchLanguage(s.language)
        if (s.language) applyLanguageDirection(s.language)
        applyAppearance(s.fontScale, s.highContrast)
        setFirstLaunchDone(s.firstLaunchDone)
      })
      .catch(() => {
        // Einstellungen nicht lesbar: lieber die App zeigen als jemanden im
        // Assistenten festhalten.
        setFirstLaunchDone(true)
      })
  }, [])

  if (firstLaunchDone === null) return <RouteFallback />

  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/welcome"
            element={<WelcomeWizard onDone={() => setFirstLaunchDone(true)} />}
          />
          <Route element={<MainLayout />}>
            {/*
              Beim allerersten Start zuerst durch den Assistenten. Danach
              setzt er firstLaunchDone und meldet es hier hoch - sonst wuerde
              diese Weiche ihn sofort wieder zurueckwerfen.
            */}
            <Route
              path="/"
              element={firstLaunchDone ? <UploadPage /> : <Navigate to="/welcome" replace />}
            />
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
