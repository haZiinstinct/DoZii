import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Languages,
  Hash,
  FileSearch,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
  ArrowRight
} from 'lucide-react'
import type { DoziiDocument, FirstImpression } from '@shared/types'
import { isLikelyGarbled } from '@shared/text-validators'

const MODE_LABELS: Record<string, string> = {
  grammar: 'Rechtschreibung',
  formulation: 'Formulierungen',
  arbeitszeugnis: 'Zeugnis-Decoder',
  summary: 'Zusammenfassung',
  freeform: 'Freie Frage'
}

export function DocumentViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
      setReImportError(err instanceof Error ? err.message : 'Re-Import fehlgeschlagen')
    } finally {
      setReImporting(false)
    }
  }

  const handleAnalyze = (mode: string) => {
    navigate(`/analysis?doc=${id}&mode=${mode}`)
  }

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
        <p>Dokument nicht gefunden</p>
        <button onClick={() => navigate('/')} className="mt-4 text-brand-cyan hover:underline">
          Zurück
        </button>
      </div>
    )
  }

  const fileSizeStr =
    doc.fileSize > 1024 * 1024
      ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(doc.fileSize / 1024).toFixed(0)} KB`

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <ArrowLeft size={18} />
        </button>
        <FileText size={20} className="text-brand-cyan" />
        <h1 className="flex-1 truncate text-lg font-semibold text-brand-text-bright">
          {doc.filename}
        </h1>
        <button
          onClick={handleReImport}
          disabled={reImporting}
          title="Text neu einlesen (bei defekter Extraktion)"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text disabled:opacity-50"
        >
          {reImporting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
        <button
          onClick={handleDelete}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-red/10 hover:text-brand-red"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Garbage-warning banner */}
      {isGarbled && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-4">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-brand-amber" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-brand-amber">Text-Extraktion problematisch</p>
            <p className="mt-1 text-brand-text-dim">
              Der extrahierte Text enthält ungewöhnlich viele nicht-druckbare Zeichen. Die KI kann
              damit keine sinnvolle Analyse machen. Klick auf das{' '}
              <RefreshCw size={12} className="inline" /> Symbol oben um das Dokument neu einzulesen.
            </p>
            {reImportError && <p className="mt-2 text-xs text-brand-red">{reImportError}</p>}
            <button
              onClick={() => setGarbledDismissed(true)}
              className="mt-3 rounded-lg border border-brand-amber/30 px-3 py-1.5 text-xs text-brand-amber transition-colors hover:bg-brand-amber/10"
            >
              Trotzdem fortfahren - der Text sieht für mich in Ordnung aus
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
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">
                      Ersteindruck
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
                    {MODE_LABELS[firstImpression.recommendedMode] ??
                      firstImpression.recommendedMode}{' '}
                    starten
                    <ArrowRight size={12} />
                  </button>
                </div>
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="text-brand-text-dim hover:text-brand-text"
                  title="Ausblenden"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : firstImpressionLoading ? (
            <div className="rounded-xl border border-brand-border bg-brand-card/40 p-4">
              <div className="flex items-center gap-3 text-xs text-brand-text-dim">
                <Loader2 size={14} className="animate-spin text-brand-cyan" />
                Ersteindruck wird erstellt...
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="ml-auto text-brand-text-dim hover:text-brand-text"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-border bg-brand-card/40 p-4">
              <div className="flex items-center gap-3">
                <Sparkles size={14} className="text-brand-text-dim" />
                <span className="text-xs text-brand-text-dim flex-1">
                  Kein Ersteindruck vorhanden. Manuell generieren?
                </span>
                <button
                  onClick={handleGenerateFirstImpression}
                  className="rounded-lg border border-brand-border px-3 py-1 text-xs text-brand-text-dim hover:border-brand-cyan/30 hover:text-brand-cyan"
                >
                  Generieren
                </button>
                <button
                  onClick={() => setFirstImpressionDismissed(true)}
                  className="text-brand-text-dim hover:text-brand-text"
                >
                  <X size={12} />
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
            <Languages size={12} />
            {doc.detectedLanguage === 'de' ? 'Deutsch' : 'English'}
          </span>
        )}
        {doc.wordCount && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
            <Hash size={12} />
            {doc.wordCount.toLocaleString()} Wörter
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
          {fileSizeStr}
        </span>
        {doc.pageCount && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1 text-xs text-brand-text-dim">
            {doc.pageCount} {doc.pageCount === 1 ? 'Seite' : 'Seiten'}
          </span>
        )}
      </div>

      {/* Analyze buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { mode: 'grammar', label: 'Rechtschreibung' },
          { mode: 'formulation', label: 'Formulierungen' },
          { mode: 'arbeitszeugnis', label: 'Zeugnis-Decoder' },
          { mode: 'summary', label: 'Zusammenfassung' },
          { mode: 'freeform', label: 'Freie Frage' }
        ].map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => handleAnalyze(mode)}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:bg-brand-cyan/5 hover:text-brand-cyan"
          >
            <FileSearch size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Extracted text */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
          Extrahierter Text
        </p>
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-brand-text">
          {doc.extractedText || '(Kein Text extrahiert)'}
        </pre>
      </div>
    </div>
  )
}
