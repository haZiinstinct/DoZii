import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import i18n from 'i18next'
import { MainLayout } from './components/layout/MainLayout'
import { applyLanguageDirection } from './hooks/useLanguageDirection'
import { applyAppearance } from './hooks/useAppearance'
import { switchLanguage } from './i18n'
import { useSettings } from './stores/SettingsProvider'

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
      <Loader2
        size={24}
        className="animate-spin text-brand-cyan"
        aria-label={i18n.t('common.loading')}
      />
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
  const { settings, loadFailed } = useSettings()
  // Der Assistent meldet sein Ende auch direkt - die Einstellung kommt erst
  // mit der Antwort des Hauptprozesses.
  const [wizardDone, setWizardDone] = useState(false)
  // Einstellungen nicht lesbar: lieber die App zeigen als jemanden im
  // Assistenten festhalten.
  const firstLaunchDone: boolean | null = loadFailed
    ? true
    : settings
      ? settings.firstLaunchDone || wizardDone
      : null

  // Richtung fuer die Default-Sprache sofort setzen (vermeidet RTL-Flackern).
  useEffect(() => {
    applyLanguageDirection(i18n.language)
  }, [])

  // Persistierte UI-Sprache auf i18n + Schreibrichtung anwenden.
  const language = settings?.language
  useEffect(() => {
    if (!language) return
    if (language !== i18n.language) void switchLanguage(language)
    applyLanguageDirection(language)
  }, [language])

  // Schrift und Kontrast gelten in der ganzen App, nicht erst auf der
  // Einstellungsseite.
  const fontScale = settings?.fontScale
  const highContrast = settings?.highContrast
  useEffect(() => {
    if (fontScale !== undefined && highContrast !== undefined) {
      applyAppearance(fontScale, highContrast)
    }
  }, [fontScale, highContrast])

  if (firstLaunchDone === null) return <RouteFallback />

  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/welcome" element={<WelcomeWizard onDone={() => setWizardDone(true)} />} />
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
