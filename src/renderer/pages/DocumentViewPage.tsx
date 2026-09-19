import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Languages,
  Hash,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
  ArrowRight,
  ScanText,
  BookOpen,
  SpellCheck,
  PenLine,
  Award,
  ScrollText,
  AlignLeft,
  MessageCircleQuestion
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ANALYSIS_MODES } from '@shared/types'
import type { AnalysisMode, Deadline, DoziiDocument, FirstImpression } from '@shared/types'
import { isLikelyGarbled } from '@shared/text-validators'
import { DeadlineList } from '@/components/DeadlineList'

/** Modi, die hier zur Auswahl stehen - 'letter' gehoert bewusst nicht dazu. */
type PickableMode = (typeof ANALYSIS_MODES)[number]

const MODE_ICONS: Record<PickableMode, React.ReactNode> = {
  plain: <BookOpen size={16} aria-hidden="true" />,
  grammar: <SpellCheck size={16} aria-hidden="true" />,
  formulation: <PenLine size={16} aria-hidden="true" />,
  arbeitszeugnis: <Award size={16} aria-hidden="true" />,
  contract: <ScrollText size={16} aria-hidden="true" />,
  summary: <AlignLeft size={16} aria-hidden="true" />,
  freeform: <MessageCircleQuestion size={16} aria-hidden="true" />
}

function isPickableMode(mode: AnalysisMode): mode is PickableMode {
  return (ANALYSIS_MODES as readonly AnalysisMode[]).includes(mode)
}

/** Heutiges Datum als 'YYYY-MM-DD' in lokaler Zeit - toISOString waere UTC. */
function todayIsoLocal(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function DocumentViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // Zahlen folgen der UI-Sprache: 12.345 (de) vs 12,345 (en) vs ١٢٬٣٤٥ (ar).
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const [doc, setDoc] = useState<DoziiDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [reImporting, setReImporting] = useState(false)
  const [reImportError, setReImportError] = useState<string | null>(null)
  const [firstImpression, setFirstImpression] = useState<FirstImpression | null>(null)
  const [firstImpressionDismissed, setFirstImpressionDismissed] = useState(false)
  const [firstImpressionLoading, setFirstImpressionLoading] = useState(false)
  // Heuristik kann falsch-positiv sein (z.B. exotische Encodings) - Nutzer
  // kann die Warnung wegklicken und normal weiterarbeiten.
  const [garbledDismissed, setGarbledDismissed] = useState(false)
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(false)
  const [icsError, setIcsError] = useState<string | null>(null)
  const [icsSavedPath, setIcsSavedPath] = useState<string | null>(null)

  const todayIso = useMemo(() => todayIsoLocal(), [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    window.api.documents.getById(id).then((d) => {
      if (cancelled) return
      setDoc(d ?? null)
      setLoading(false)
    })
    setFirstImpressionDismissed(false)
    setGarbledDismissed(false)
    setFirstImpression(null)
    window.api.documents.getFirstImpression(id).then((fi) => {
      if (cancelled) return
      setFirstImpression(fi)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Fristen laden und aktuell halten: die Fristensuche laeuft nach einer
  // Analyse im Hintergrund weiter und meldet sich ueber `onUpdated`.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = (): void => {
      window.api.deadlines.forDocument(id).then((found) => {
        if (cancelled) return
        setDeadlines(found)
      })
    }
    setIcsError(null)
    setIcsSavedPath(null)
    load()
    const unsubscribe = window.api.deadlines.onUpdated(({ documentId }) => {
      if (documentId !== id) return
      load()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [id])

  const handleGenerateFirstImpression = async () => {
    if (!id) return
    setFirstImpressionLoading(true)
    const fi = await window.api.documents.generateFirstImpression(id)
    setFirstImpression(fi)
    setFirstImpressionLoading(false)
  }

  const isGarbled = useMemo(
    () => (doc ? isLikelyGarbled(doc.extractedText) : false) && !garbledDismissed,
    [doc, garbledDismissed]
  )

  const handleDelete = async () => {
    if (!id) return
    await window.api.documents.delete(id)
    navigate('/')
  }

  const handleReImport = async () => {
    if (!id) return
    setReImporting(true)
    setReImportError(null)
    try {
      const result = await window.api.documents.reImport(id)
      if (result.ok) {
        setDoc(result.doc)
      } else {
        setReImportError(result.error)
      }
    } catch (err) {
      setReImportError(err instanceof Error ? err.message : t('document.reimportFailed'))
    } finally {
      setReImporting(false)
    }
  }

  const handleAnalyze = (mode: AnalysisMode) => {
    navigate(`/analysis?doc=${id}&mode=${mode}`)
  }

  const handleScanDeadlines = useCallback(async () => {
    if (!id) return
    setDeadlinesLoading(true)
    try {
      const found = await window.api.deadlines.scan(id)
      setDeadlines(found)
    } finally {
      setDeadlinesLoading(false)
    }
  }, [id])

  // Die .ics enthaelt alle Fristen des Dokuments - welche Karte den Klick
  // ausgeloest hat, spielt darum keine Rolle.
  const handleAddToCalendar = useCallback(async () => {
    if (!id) return
    setIcsError(null)
    setIcsSavedPath(null)
    const result = await window.api.deadlines.exportIcs(id)
    if (result.ok) {
      setIcsSavedPath(result.path ?? null)
    } else {
      setIcsError(result.error ?? '')
    }
  }, [id])

  const recommendedMode = useMemo(() => {
    const mode = firstImpression?.recommendedMode
    return mode && isPickableMode(mode) ? mode : null
  }, [firstImpression])

  // Empfohlener Modus nach oben - sonst bleibt die feste UI-Reihenfolge.
  const orderedModes = useMemo<readonly PickableMode[]>(() => {
    if (!recommendedMode) return ANALYSIS_MODES
    return [recommendedMode, ...ANALYSIS_MODES.filter((mode) => mode !== recommendedMode)]
  }, [recommendedMode])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-brand-text-dim">
        <p>{t('document.notFound')}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-brand-cyan hover:underline">
          {t('document.back')}
        </button>
      </div>
    )
  }

  const fileSizeStr =
    doc.fileSize > 1024 * 1024
      ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(doc.fileSize / 1024).toFixed(0)} KB`

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          aria-label={t('document.back')}
          title={t('document.back')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <ArrowLeft size={18} className="rtl-flip" aria-hidden="true" />
        </button>
        <FileText size={20} className="text-brand-cyan" aria-hidden="true" />
        <h1 className="flex-1 truncate text-lg font-semibold text-brand-text-bright">
          {doc.filename}
        </h1>
        <button
          onClick={handleReImport}
          disabled={reImporting}
          title={t('document.reimport')}
          aria-label={t('document.reimport')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text disabled:opacity-50"
        >
          {reImporting ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={16} aria-hidden="true" />
          )}
        </button>
        <button
          onClick={handleDelete}
          aria-label={t('document.delete')}
          title={t('document.delete')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-red/10 hover:text-brand-red"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Scan-Hinweis: OCR verwechselt Ziffern, bei einem Bescheid haengt daran viel Geld. */}
      {doc.ocrUsed && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-4">
          <ScanText
            size={16}
            className="mt-0.5 flex-shrink-0 text-brand-amber"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-brand-text">{t('document.ocrUsed')}</p>
        </div>
      )}

      {/*
        Unvollstaendiger Import (uebersprungene Seiten, Seiten-Deckel). Stand
        frueher nur im Logfile - der Nutzer sah ein scheinbar vollstaendiges
        Dokument, dem in Wahrheit Seiten fehlten.
      */}
      {doc.importWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <AlertTriangle
            size={16}
            className="mt-0.5 flex-shrink-0 text-brand-red"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-brand-text">
            {t('document.importIncomplete', { warning: doc.importWarning })}
          </p>
        </div>
      )}

      {/* Garbage-warning banner */}
      {isGarbled && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-4">
          <AlertTriangle
            size={16}
            className="mt-0.5 flex-shrink-0 text-brand-amber"
            aria-hidden="true"
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-brand-amber">{t('document.garbledTitle')}</p>
            <p className="mt-1 text-brand-text-dim">{t('document.garbledDesc')}</p>
            {reImportError && <p className="mt-2 text-xs text-brand-red">{reImportError}</p>}
            <button
              onClick={() => setGarbledDismissed(true)}
              className="mt-3 rounded-lg border border-brand-amber/30 px-3 py-1.5 text-xs text-brand-amber transition-colors hover:bg-brand-amber/10"
            >
              {t('document.garbledProceed')}
            </button>
          </div>
        </div>
      )}

      {reImportError && !isGarbled && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-3">
          <p className="text-xs text-brand-red">{reImportError}</p>
        </div>
      )}

      {/* First Impression Card */}
      {!firstImpressionDismissed && !isGarbled && (
        <>
          {firstImpression ? (
            <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/20 text-brand-cyan">
                  <Sparkles size={14} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">
                      {t('document.firstImpression')}
                    </span>
                    <span className="rounded-md border border-brand-border bg-brand-darker/60 px-1.5 py-0.5 text-[10px] uppercase text-brand-text-dim">
                      {firstImpression.documentType}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-brand-text">{firstImpression.firstImpression}</p>
                  <button
                    onClick={() => handleAnalyze(firstImpression.recommendedMode)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-brand-dark transition-all hover:bg-brand-cyan-dim"
                  >
                    {t(`analysis.modesShort.${firstImpression.recommendedMode}`)}{' '}
                    {t('document.startSuffix')}
                    <ArrowRight size={12} className="rtl-flip" aria-hidden="true" />
                  </button>
                </div>
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="text-brand-text-dim hover:text-brand-text"
                  title={t('document.hide')}
                  aria-label={t('document.hide')}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : firstImpressionLoading ? (
            <div className="rounded-xl border border-brand-border bg-brand-card/40 p-4">
              <div className="flex items-center gap-3 text-xs text-brand-text-dim">
                <Loader2 size={14} className="animate-spin text-brand-cyan" aria-hidden="true" />
                {t('document.firstImpressionGenerating')}
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="ms-auto text-brand-text-dim hover:text-brand-text"
                  aria-label={t('document.hide')}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-border bg-brand-card/40 p-4">
              <div className="flex items-center gap-3">
                <Sparkles size={14} className="text-brand-text-dim" aria-hidden="true" />
                <span className="text-xs text-brand-text-dim flex-1">
                  {t('document.firstImpressionNone')}
                </span>
                <button
                  onClick={handleGenerateFirstImpression}
                  className="rounded-lg border border-brand-border px-3 py-1 text-xs text-brand-text-dim hover:border-brand-cyan/30 hover:text-brand-cyan"
                >
                  {t('document.generate')}
                </button>
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="text-brand-text-dim hover:text-brand-text"
                  aria-label={t('document.hide')}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {doc.detectedLanguage && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
            <Languages size={12} aria-hidden="true" />
            {doc.detectedLanguage === 'de' ? t('document.german') : t('document.english')}
          </span>
        )}
        {doc.wordCount && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
            <Hash size={12} aria-hidden="true" />
            {numberFormat.format(doc.wordCount)} {t('common.words')}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
          {fileSizeStr}
        </span>
        {doc.pageCount && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
            {t('document.pages', { count: doc.pageCount })}
          </span>
        )}
      </div>

      {/* Modus-Auswahl: Titel plus Beschreibung, damit die Wahl ohne Vorwissen klappt. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('document.modePickerTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {orderedModes.map((mode) => {
            const isRecommended = mode === recommendedMode
            return (
              <li key={mode}>
                <button
                  type="button"
                  onClick={() => handleAnalyze(mode)}
                  className={`flex h-full w-full items-start gap-3 rounded-2xl border p-4 text-start transition-all ${
                    isRecommended
                      ? 'border-brand-cyan/50 bg-brand-cyan/10 hover:bg-brand-cyan/20'
                      : 'border-brand-border bg-brand-card/40 hover:border-brand-cyan/30 hover:bg-brand-cyan/5'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      isRecommended
                        ? 'bg-brand-cyan/20 text-brand-cyan'
                        : 'bg-brand-darker/60 text-brand-text-dim'
                    }`}
                  >
                    {MODE_ICONS[mode]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-brand-text-bright">
                        {t(`analysis.modes.${mode}`)}
                      </span>
                      {isRecommended && (
                        <span className="rounded-md border border-brand-cyan/40 bg-brand-cyan/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-cyan">
                          {t('document.modeRecommended')}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-brand-text-dim">
                      {t(`analysis.modeDesc.${mode}`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Fristen */}
      <DeadlineList
        deadlines={deadlines}
        todayIso={todayIso}
        loading={deadlinesLoading}
        onScan={handleScanDeadlines}
        onAddToCalendar={handleAddToCalendar}
      />

      {icsSavedPath && (
        <p className="text-xs text-brand-green">
          {t('analysis.exportDone', { path: icsSavedPath })}
        </p>
      )}
      {icsError && <p className="text-xs text-brand-red">{icsError}</p>}

      {/* Extracted text */}
      <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('document.extractedText')}
        </p>
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-brand-text">
          {doc.extractedText || t('document.noText')}
        </pre>
      </div>
    </div>
  )
}
