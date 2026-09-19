import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  FileSearch,
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  User,
  Sparkles,
  Trash2,
  Square,
  CircleSlash,
  FileDown,
  Volume2,
  VolumeX,
  ScanText,
  PenLine,
  Wand2
} from 'lucide-react'
import type {
  AnalysisExtra,
  AnalysisMode,
  AnalysisNotice,
  AnalysisPhaseEvent,
  AnalysisRunResult,
  ChatMessage,
  DoziiDocument,
  ExportFormat,
  LetterKind
} from '@shared/types'
import { MarkdownView } from '@/components/analysis/MarkdownView'
import { GrammarResults } from '@/components/analysis/GrammarResults'
import { FormulationSuggestions } from '@/components/analysis/FormulationSuggestions'
import { ArbeitszeugnisDecoder } from '@/components/analysis/ArbeitszeugnisDecoder'
import { SummaryView } from '@/components/analysis/SummaryView'
import { PlainLanguageView } from '@/components/analysis/PlainLanguageView'
import { ContractCheck } from '@/components/analysis/ContractCheck'
import { LetterView } from '@/components/analysis/LetterView'
import { LetterKindPicker } from '@/components/analysis/LetterKindPicker'
import { HighlightedDocument } from '@/components/analysis/HighlightedDocument'
import { useStreamingInvocation } from '@/hooks/useStreamingInvocation'
import { useSpeech } from '@/hooks/useSpeech'
import {
  parseGrammar,
  parseFormulation,
  parseSummary,
  parseArbeitszeugnis,
  stripTrailingJsonBlock
} from '@/lib/parse-analysis'
import { parsePlainLanguage } from '@/lib/parse-plain-language'
import { parseContractCheck } from '@/lib/parse-contract'
import { parseLetter } from '@/lib/parse-letter'
import type { HighlightQuery } from '@/lib/highlight'
import { DEFAULT_MODEL, isHeavyModeCapable } from '@shared/model-catalog'
import { useTranslation } from 'react-i18next'

// ============================================================================
// State machine: discriminated union prevents invalid boolean combinations
// ============================================================================

type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'streaming'; text: string; phase: AnalysisPhaseEvent }
  | { kind: 'done'; text: string; result: AnalysisRunResult | null }
  | { kind: 'aborted'; text: string }
  | { kind: 'error'; message: string; partial: string }

/** Modi, deren JSON-Ergebnis Zitate enthaelt - dort lohnt der Blick ins Original. */
const EVIDENCE_MODES: ReadonlySet<AnalysisMode> = new Set<AnalysisMode>([
  'arbeitszeugnis',
  'contract'
])

const EXPORT_FORMATS: { format: ExportFormat; labelKey: string }[] = [
  { format: 'pdf', labelKey: 'analysis.exportPdf' },
  { format: 'rtf', labelKey: 'analysis.exportRtf' },
  { format: 'markdown', labelKey: 'analysis.exportMarkdown' },
  { format: 'txt', labelKey: 'analysis.exportTxt' }
]

/**
 * Menschlich lesbarer Fortschritt - bei langen Dokumenten laeuft das minutenlang,
 * und "Analysiere..." ohne Zaehler fuehlt sich dann wie ein Haenger an.
 * Liefert Schluessel + Platzhalter, damit der Aufrufer uebersetzt.
 */
function phaseLabel(phase: AnalysisPhaseEvent): {
  key: string
  params?: Record<string, number>
} {
  switch (phase.kind) {
    case 'verifying':
      return { key: 'analysis.phaseVerifying' }
    case 'chunk':
      return {
        key: 'analysis.phaseChunk',
        params: { current: phase.current, total: phase.total }
      }
    case 'merging':
      return { key: 'analysis.phaseMerging' }
    case 'deadlines':
      return { key: 'analysis.phaseDeadlines' }
    default:
      return { key: 'analysis.phaseAnalyzing' }
  }
}

type ChatState =
  | { kind: 'idle' }
  | { kind: 'streaming'; buffer: string }
  | { kind: 'error'; message: string }

export function AnalysisPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const docId = params.get('doc')
  const mode = (params.get('mode') || 'plain') as AnalysisMode
  /** Kam der Nutzer ueber den Ein-Klick-Flow hierher? Dann erklaeren wir das kurz. */
  const autoStarted = params.get('auto') === '1'
  const sourceAnalysisId = params.get('from') ?? undefined

  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: 'idle' })
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chat, setChat] = useState<ChatState>({ kind: 'idle' })
  const [chatInput, setChatInput] = useState('')
  const [freeQuestion, setFreeQuestion] = useState('')
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [redactOnExport, setRedactOnExport] = useState(false)
  const [doc, setDoc] = useState<DoziiDocument | null>(null)
  const [documentType, setDocumentType] = useState<string | null>(null)
  /** Aktuell gewaehltes Modell - fuer die Warnung bei zu kleinen Modellen. */
  const [selectedModel, setSelectedModel] = useState('')
  const [letterNotes, setLetterNotes] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const speech = useSpeech()

  const responseRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Streaming hooks - these centralize listener lifecycle so listeners
  // are always removed on unmount and before re-registering for a new run.
  const analysisStream = useStreamingInvocation<AnalysisRunResult>(window.api.analysis)
  const chatStream = useStreamingInvocation<ChatMessage>(window.api.chat)

  // Auto-scroll during analysis streaming
  useEffect(() => {
    if (responseRef.current && analysis.kind === 'streaming') {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [analysis])

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chat])

  // Load chat history when docId changes
  useEffect(() => {
    if (!docId) return
    window.api.chat
      .getHistory(docId)
      .then(setChatMessages)
      .catch(() => {
        // silent - chat history load error is non-critical
      })
    // Also load the document so parsers can validate evidence quotes against it
    window.api.documents.getById(docId).then((d) => {
      if (d) setDoc(d)
    })
    window.api.documents
      .getFirstImpression(docId)
      .then((fi) => setDocumentType(fi?.documentType ?? null))
      .catch(() => setDocumentType(null))
  }, [docId])

  /**
   * Passende Briefart zur Dokumentart vorschlagen. Der Nutzer kann jede andere
   * waehlen - der Vorschlag spart nur den Denkschritt.
   */
  const suggestedLetterKind = useMemo<LetterKind | undefined>(() => {
    switch (documentType) {
      case 'bescheid':
        return 'widerspruch'
      case 'rechnung':
        return 'mahnung-antwort'
      case 'arbeitszeugnis':
        return 'zeugnis-nachbesserung'
      case 'vertrag':
        return 'kuendigung'
      default:
        return undefined
    }
  }, [documentType])

  // Vorbelegung der Schwaerzen-Option aus den Einstellungen.
  useEffect(() => {
    window.api.settings
      .get()
      .then((s) => {
        setRedactOnExport(s.redactOnExport)
        setSelectedModel(s.selectedModel)
      })
      .catch(() => {
        /* Default false */
      })
  }, [])

  // Subscribe to analysis:phase events.
  // Beim Wechsel auf "verifizieren" oder "zusammenfuehren" wird `text`
  // zurueckgesetzt: die saubere Endausgabe ersetzt die Zwischenstaende.
  useEffect(() => {
    const unsub = window.api.analysis.onPhase((phase) => {
      setAnalysis((s) => {
        if (s.kind !== 'streaming') return s
        if (phase.kind === 'verifying' || phase.kind === 'merging') {
          return { ...s, phase, text: '' }
        }
        return { ...s, phase }
      })
    })
    return unsub
  }, [])

  const startAnalysis = useCallback(
    async (question?: string, extra?: AnalysisExtra) => {
      if (!docId) return
      setAskedQuestion(question ?? null)
      setExportError(null)
      setShowOriginal(false)
      setAnalysis({ kind: 'streaming', text: '', phase: { kind: 'analyzing' } })

      await analysisStream.run(() => window.api.analysis.run(docId, mode, question, extra), {
        onChunk: (chunk) => {
          setAnalysis((s) => (s.kind === 'streaming' ? { ...s, text: s.text + chunk } : s))
        },
        onComplete: (result) => {
          setAnalysis((s) => {
            const text = s.kind === 'streaming' ? s.text : ''
            if (result?.aborted) {
              // Freeform re-opens the input after abort so user can ask again
              if (mode === 'freeform') {
                return { kind: 'idle' }
              }
              return { kind: 'aborted', text }
            }
            return { kind: 'done', text, result }
          })
        },
        onError: (err) => {
          setAnalysis((s) => ({
            kind: 'error',
            message: err,
            partial: s.kind === 'streaming' ? s.text : ''
          }))
        }
      })
    },
    [docId, mode, analysisStream]
  )

  // Automatisch starten - ausser bei Modi, die erst eine Eingabe brauchen:
  // 'freeform' braucht die Frage, 'letter' die Briefart.
  //
  // Der Moduswechsel laeuft ueber denselben Router-Pfad, die Komponente bleibt
  // also montiert. Ohne das Zuruecksetzen blieb das vorherige Ergebnis stehen -
  // wer aus einer fertigen Analyse heraus "Antwort schreiben" waehlte, sah nie
  // die Briefart-Auswahl, sondern weiter das alte Ergebnis.
  useEffect(() => {
    if (!docId) return
    if (mode === 'freeform' || mode === 'letter') {
      setAnalysis({ kind: 'idle' })
      setAskedQuestion(null)
      setShowOriginal(false)
      return
    }
    startAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, mode])

  const startLetter = useCallback(
    (kind: LetterKind) => {
      startAnalysis(undefined, {
        letterKind: kind,
        sourceAnalysisId,
        userNotes: letterNotes.trim() || undefined
      })
    },
    [startAnalysis, sourceAnalysisId, letterNotes]
  )

  /** Aus einem Ergebnis heraus einen Brief schreiben - mit Bezug auf diese Analyse. */
  const goToLetter = useCallback(() => {
    if (!docId) return
    const from =
      analysis.kind === 'done' && analysis.result ? `&from=${analysis.result.analysis.id}` : ''
    navigate(`/analysis?doc=${docId}&mode=letter${from}`)
  }, [docId, analysis, navigate])

  const handleStopAnalysis = useCallback(() => {
    window.api.analysis.abort()
  }, [])

  const handleStopChat = useCallback(() => {
    window.api.chat.abort()
  }, [])

  const sendChatMessage = useCallback(async () => {
    if (!docId || !chatInput.trim() || chat.kind === 'streaming') return

    const userText = chatInput.trim()
    setChatInput('')
    setChat({ kind: 'streaming', buffer: '' })

    // Optimistically add the user message
    const tempUserMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      documentId: docId,
      role: 'user',
      content: userText,
      modelUsed: null,
      createdAt: new Date().toISOString()
    }
    setChatMessages((prev) => [...prev, tempUserMsg])

    await chatStream.run(() => window.api.chat.send(docId, userText), {
      onChunk: (chunk) => {
        setChat((s) => (s.kind === 'streaming' ? { ...s, buffer: s.buffer + chunk } : s))
      },
      onComplete: async () => {
        setChat({ kind: 'idle' })
        const history = await window.api.chat.getHistory(docId)
        setChatMessages(history)
      },
      onError: (err) => {
        setChat({ kind: 'error', message: err })
        // Remove the optimistic user message since sending failed
        setChatMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      }
    })
  }, [docId, chatInput, chat, chatStream])

  const handleClearChat = useCallback(async () => {
    if (!docId) return
    await window.api.chat.clearHistory(docId)
    setChatMessages([])
  }, [docId])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (analysis.kind !== 'done' || !analysis.result) return
      setExportError(null)
      setExportNotice(null)
      setExportOpen(false)
      const res = await window.api.exporter.analysis({
        analysisId: analysis.result.analysis.id,
        format,
        redact: redactOnExport
      })
      if (res.ok) {
        const redacted =
          res.redactedCount && res.redactedCount > 0
            ? ` (${t('analysis.redactedCount', { count: res.redactedCount })})`
            : ''
        setExportNotice(t('analysis.exportDone', { path: res.path ?? '' }) + redacted)
        setTimeout(() => setExportNotice(null), 8000)
        return
      }
      if (res.error && res.error !== 'Abgebrochen') {
        window.api.logs.write('error', 'AnalysisPage', 'Export failed', {
          format,
          error: res.error
        })
        setExportError(t('analysis.exportError', { error: res.error }))
        setTimeout(() => setExportError(null), 8000)
      }
    },
    [analysis, redactOnExport, t]
  )

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {
      /* Zwischenablage nicht verfuegbar - kein harter Fehler */
    })
  }, [])

  // Parse the structured response once streaming is done.
  // Pass doc.extractedText for evidence validation - parsers will filter
  // hallucinated findings whose quotes don't appear in the original text.
  const parsed = useMemo(() => {
    if (analysis.kind !== 'done' || !analysis.text) return null
    const docText = doc?.extractedText
    try {
      switch (mode) {
        case 'plain':
          return { type: 'plain' as const, data: parsePlainLanguage(analysis.text) }
        case 'grammar':
          return { type: 'grammar' as const, data: parseGrammar(analysis.text, docText) }
        case 'formulation':
          return {
            type: 'formulation' as const,
            data: parseFormulation(analysis.text, docText)
          }
        case 'arbeitszeugnis':
          return {
            type: 'arbeitszeugnis' as const,
            data: parseArbeitszeugnis(analysis.text, docText)
          }
        case 'contract':
          return {
            type: 'contract' as const,
            data: parseContractCheck(analysis.text, docText ?? '')
          }
        case 'summary':
          return { type: 'summary' as const, data: parseSummary(analysis.text) }
        case 'letter':
          return { type: 'letter' as const, data: parseLetter(analysis.text) }
        default:
          return null
      }
    } catch {
      return null
    }
  }, [analysis, mode, doc])

  /**
   * Zitate aus dem Ergebnis, die im Originaltext markiert werden koennen.
   * Nur belegte Befunde - unbelegte wuerden eine Sicherheit vortaeuschen,
   * die es nicht gibt.
   */
  const highlightQueries = useMemo<HighlightQuery[]>(() => {
    if (!parsed) return []
    if (parsed.type === 'arbeitszeugnis' && parsed.data) {
      return parsed.data.codedPhrases
        .filter((phrase) => phrase.verified)
        .map((phrase, idx) => ({
          id: `az-${idx}`,
          quote: phrase.evidence ?? phrase.phrase,
          severity: phrase.severity
        }))
    }
    if (parsed.type === 'contract' && parsed.data) {
      return parsed.data.clauses
        .filter((clause) => clause.verified && clause.quote)
        .map((clause, idx) => ({
          id: `clause-${idx}`,
          quote: clause.quote,
          severity: clause.severity
        }))
    }
    return []
  }, [parsed])

  const handleShowInText = useCallback(
    (quote: string) => {
      const match = highlightQueries.find((q) => q.quote === quote)
      setShowOriginal(true)
      setActiveQuoteId(match?.id ?? null)
    },
    [highlightQueries]
  )

  /**
   * Vorbehalt zum Ergebnis (gekuerzt / in Abschnitten analysiert). Kommt als
   * JSON aus dem Hauptprozess; kaputtes JSON wird still ignoriert - ein
   * fehlender Hinweis ist besser als eine kaputte Seite.
   */
  const notice = useMemo<AnalysisNotice | null>(() => {
    if (analysis.kind !== 'done' || !analysis.result?.analysis.notice) return null
    try {
      const parsed = JSON.parse(analysis.result.analysis.notice) as AnalysisNotice
      return typeof parsed?.chunks === 'number' ? parsed : null
    } catch {
      return null
    }
  }, [analysis])

  /**
   * Taugt das gewaehlte Modell fuer diesen Modus? Zeugnis-Decoder und
   * Vertrags-Check verlangen striktes JSON nach einem sehr langen Prompt.
   */
  const modelTooSmall =
    EVIDENCE_MODES.has(mode) && selectedModel.length > 0 && !isHeavyModeCapable(selectedModel)

  /** Was vorgelesen wird: die Kernaussagen, nicht das rohe Markdown. */
  const speakableText = useMemo(() => {
    if (analysis.kind !== 'done') return ''
    if (parsed?.type === 'plain' && parsed.data) {
      const p = parsed.data
      return [p.headline, p.urgencyReason, p.demand, p.ifNothing, ...p.actions.map((a) => a.text)]
        .filter(Boolean)
        .join('. ')
    }
    if (parsed?.type === 'letter' && parsed.data) return parsed.data.body
    // Markdown-Auszeichnung entfernen, damit nicht "Sternchen Sternchen" vorgelesen wird.
    return analysis.text
      .replace(/[#*_`>|-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [analysis, parsed])

  if (!docId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <FileSearch size={28} className="mb-4 text-brand-cyan" aria-hidden="true" />
        <p className="text-brand-text-dim">{t('analysis.noDocument')}</p>
      </div>
    )
  }

  const currentText =
    analysis.kind === 'streaming'
      ? analysis.text
      : analysis.kind === 'done'
        ? analysis.text
        : analysis.kind === 'aborted'
          ? analysis.text
          : analysis.kind === 'error'
            ? analysis.partial
            : ''
  const displayMarkdown =
    mode === 'arbeitszeugnis' ? stripTrailingJsonBlock(currentText) : currentText
  const showChat =
    analysis.kind === 'done' || analysis.kind === 'aborted' || chatMessages.length > 0
  // Neue Analyse = frisch montierte Ansicht. Sonst blieben abgehakte Punkte und
  // aufgeklappte Karten aus dem vorherigen Ergebnis stehen.
  const resultKey =
    analysis.kind === 'done' && analysis.result ? analysis.result.analysis.id : `${docId}-${mode}`

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/document/${docId}`)}
          aria-label={t('document.back')}
          title={t('document.back')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <ArrowLeft size={18} className="rtl-flip" aria-hidden="true" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
          <FileSearch size={16} aria-hidden="true" />
        </div>
        <h1 className="flex-1 text-lg font-semibold text-brand-text-bright">
          {t(`analysis.modes.${mode}`)}
        </h1>

        {/* Status icons + phase text */}
        {analysis.kind === 'streaming' && (
          <div className="flex items-center gap-1.5" role="status" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-brand-cyan" aria-hidden="true" />
            <span className="text-xs text-brand-text-dim">
              {t(phaseLabel(analysis.phase).key, phaseLabel(analysis.phase).params)}
            </span>
          </div>
        )}
        {analysis.kind === 'done' && (
          <CheckCircle2 size={16} className="text-brand-green" aria-hidden="true" />
        )}
        {analysis.kind === 'aborted' && (
          <CircleSlash size={16} className="text-brand-amber" aria-hidden="true" />
        )}
        {analysis.kind === 'error' && (
          <AlertCircle size={16} className="text-brand-red" aria-hidden="true" />
        )}

        {/* Stop button - only while streaming */}
        {analysis.kind === 'streaming' && (
          <button
            onClick={handleStopAnalysis}
            className="flex items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red transition-colors hover:bg-brand-red/20"
          >
            <Square size={12} fill="currentColor" aria-hidden="true" />
            {t('analysis.stop')}
          </button>
        )}

        {/* Restart button - after abort/done/error for modes that start on their own */}
        {(analysis.kind === 'done' || analysis.kind === 'aborted' || analysis.kind === 'error') &&
          mode !== 'freeform' &&
          mode !== 'letter' && (
            <button
              onClick={() => startAnalysis()}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              {t('analysis.restart')}
            </button>
          )}

        {/* Originaltext mit Belegstellen - nur wo es Zitate gibt */}
        {analysis.kind === 'done' && EVIDENCE_MODES.has(mode) && highlightQueries.length > 0 && (
          <button
            onClick={() => setShowOriginal((v) => !v)}
            aria-expanded={showOriginal}
            className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <ScanText size={12} aria-hidden="true" />
            {t('results.contract.showInText')}
          </button>
        )}

        {/* Vorlesen - fuer alle, die lange Texte nicht gut lesen koennen */}
        {analysis.kind === 'done' && speech.supported && speakableText.length > 0 && (
          <button
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(speakableText))}
            title={speech.speaking ? t('analysis.speakStop') : t('analysis.speak')}
            aria-label={speech.speaking ? t('analysis.speakStop') : t('analysis.speak')}
            className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            {speech.speaking ? (
              <VolumeX size={12} aria-hidden="true" />
            ) : (
              <Volume2 size={12} aria-hidden="true" />
            )}
            {speech.speaking ? t('analysis.speakStop') : t('analysis.speak')}
          </button>
        )}

        {/* Brief schreiben - der Schritt von "verstanden" zu "gehandelt" */}
        {analysis.kind === 'done' && mode !== 'letter' && (
          <button
            onClick={goToLetter}
            className="flex items-center gap-1.5 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 text-xs font-semibold text-brand-cyan transition-colors hover:bg-brand-cyan/20"
          >
            <PenLine size={12} aria-hidden="true" />
            {t('analysis.writeLetter')}
          </button>
        )}

        {/* Export - nur bei erfolgreichem Ergebnis */}
        {analysis.kind === 'done' && (
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              title={t('analysis.exportMenu')}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <FileDown size={12} aria-hidden="true" />
              {t('analysis.exportMenu')}
            </button>
            {exportOpen && (
              <div
                role="menu"
                className="absolute end-0 top-full z-20 mt-1 w-64 rounded-xl border border-brand-border bg-brand-card p-2 shadow-xl"
              >
                {EXPORT_FORMATS.map(({ format, labelKey }) => (
                  <button
                    key={format}
                    role="menuitem"
                    onClick={() => handleExport(format)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs text-brand-text transition-colors hover:bg-brand-card-hover"
                  >
                    {t(labelKey)}
                  </button>
                ))}
                <label className="mt-1 flex cursor-pointer items-start gap-2 border-t border-brand-border px-3 pb-1 pt-2 text-xs text-brand-text-dim">
                  <input
                    type="checkbox"
                    checked={redactOnExport}
                    onChange={(e) => setRedactOnExport(e.target.checked)}
                    className="mt-0.5 accent-[color:var(--color-brand-cyan)]"
                  />
                  <span>
                    {t('analysis.redactBeforeExport')}
                    <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                      {t('analysis.redactBeforeExportHint')}
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/*
        Warnung vor zu kleinen Modellen. Genau hier ist der Schaden entstanden:
        ein 3B-Modell lieferte beim Zeugnis-Decoder "Note 1" mit dem Wortlaut
        "mangelhaft". Der Hinweis stand bisher nur im Logfile.
      */}
      {modelTooSmall && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-amber/30 bg-brand-amber/5 px-4 py-3">
          <AlertCircle
            size={14}
            className="mt-0.5 flex-shrink-0 text-brand-amber"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-brand-text-dim">
            {t('analysis.modelTooSmall', {
              model: selectedModel,
              recommended: DEFAULT_MODEL
            })}
          </p>
        </div>
      )}

      {/* Ein-Klick-Flow: kurz erklaeren, warum die Analyse von selbst lief */}
      {autoStarted && analysis.kind !== 'idle' && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 px-4 py-2 text-xs text-brand-text-dim">
          <Wand2 size={12} className="text-brand-cyan" aria-hidden="true" />
          <span className="flex-1">{t('analysis.autoStarted')}</span>
          <button
            onClick={() => navigate(`/document/${docId}`)}
            className="font-semibold text-brand-cyan hover:underline"
          >
            {t('analysis.autoStartedChange')}
          </button>
        </div>
      )}

      {/* Freeform question input */}
      {mode === 'freeform' && analysis.kind === 'idle' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={freeQuestion}
            onChange={(e) => setFreeQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && freeQuestion.trim()) {
                startAnalysis(freeQuestion)
              }
            }}
            placeholder={t('analysis.askPlaceholder')}
            className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20"
          />
          <button
            onClick={() => freeQuestion.trim() && startAnalysis(freeQuestion)}
            disabled={!freeQuestion.trim()}
            aria-label={t('analysis.send')}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan text-brand-dark transition-all hover:bg-brand-cyan-dim disabled:opacity-40"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/*
        Vorbehalte zum Ergebnis. Kommen als Daten aus dem Hauptprozess, nicht
        als angehaengter Text - sonst waeren sie in den Karten-Ansichten
        (Zeugnis-Decoder, Vertrags-Check) unsichtbar, und genau dort sind die
        Aussagen am schaerfsten.
      */}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-amber/30 bg-brand-amber/5 px-4 py-3">
          <AlertCircle
            size={14}
            className="mt-0.5 flex-shrink-0 text-brand-amber"
            aria-hidden="true"
          />
          <div className="space-y-1 text-xs leading-relaxed text-brand-text-dim">
            {notice.truncated && <p>{t('analysis.noticeTruncated')}</p>}
            {notice.chunks > 1 && <p>{t('analysis.chunkedNotice', { count: notice.chunks })}</p>}
            {notice.truncatedChunks > 0 && (
              <p className="font-semibold text-brand-amber">
                {t('analysis.noticeChunksTruncated', { count: notice.truncatedChunks })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {analysis.kind === 'error' && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <p className="text-sm text-brand-red">{analysis.message}</p>
        </div>
      )}
      {exportError && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <p className="text-sm text-brand-red">{exportError}</p>
        </div>
      )}
      {exportNotice && (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <p className="break-all text-sm text-brand-green">{exportNotice}</p>
        </div>
      )}
      {chat.kind === 'error' && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <p className="text-sm text-brand-red">{chat.message}</p>
        </div>
      )}

      {/* Gestellte Freitext-Frage ueber dem Ergebnis anzeigen */}
      {mode === 'freeform' && askedQuestion && analysis.kind !== 'idle' && (
        <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            {t('analysis.yourQuestion')}
          </p>
          <p className="mt-1 text-sm text-brand-text">{askedQuestion}</p>
        </div>
      )}

      {/* Analysis response area */}
      <div
        ref={responseRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-brand-border bg-brand-card/40 p-6"
      >
        {/* Briefart waehlen, bevor es losgeht */}
        {mode === 'letter' && analysis.kind === 'idle' && (
          <LetterKindPicker
            suggested={suggestedLetterKind}
            notes={letterNotes}
            onNotesChange={setLetterNotes}
            onStart={startLetter}
          />
        )}

        {analysis.kind === 'idle' && mode !== 'letter' && (
          <p className="text-sm text-brand-text-dim">
            {mode === 'freeform' ? t('analysis.idleFreeform') : t('analysis.idleStarting')}
          </p>
        )}

        {/* Originaltext mit markierten Belegstellen */}
        {showOriginal && doc?.extractedText && highlightQueries.length > 0 && (
          <div className="mb-6">
            <HighlightedDocument
              documentText={doc.extractedText}
              queries={highlightQueries}
              activeId={activeQuoteId}
              onSelect={setActiveQuoteId}
            />
          </div>
        )}

        {currentText && (
          <>
            {analysis.kind === 'streaming' || !parsed?.data ? (
              <MarkdownView content={displayMarkdown} />
            ) : parsed.type === 'plain' && parsed.data ? (
              <PlainLanguageView key={resultKey} result={parsed.data} onWriteLetter={goToLetter} />
            ) : parsed.type === 'grammar' && parsed.data ? (
              <GrammarResults result={parsed.data} />
            ) : parsed.type === 'formulation' && parsed.data ? (
              <FormulationSuggestions result={parsed.data} />
            ) : parsed.type === 'arbeitszeugnis' && parsed.data ? (
              <ArbeitszeugnisDecoder
                key={resultKey}
                result={parsed.data}
                documentText={doc?.extractedText}
              />
            ) : parsed.type === 'contract' && parsed.data ? (
              <ContractCheck
                key={resultKey}
                result={parsed.data}
                onShowInText={handleShowInText}
                documentText={doc?.extractedText}
              />
            ) : parsed.type === 'summary' && parsed.data ? (
              <SummaryView result={parsed.data} />
            ) : parsed.type === 'letter' && parsed.data ? (
              <LetterView key={resultKey} result={parsed.data} onCopy={handleCopy} />
            ) : (
              <MarkdownView content={displayMarkdown} />
            )}
          </>
        )}

        {analysis.kind === 'streaming' && (
          <span className="ms-1 inline-block h-4 w-2 animate-pulse bg-brand-cyan" />
        )}

        {analysis.kind === 'aborted' && (
          <div className="mt-4 rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-3">
            <p className="flex items-center gap-2 text-xs text-brand-amber">
              <CircleSlash size={12} aria-hidden="true" />
              {t('analysis.aborted')}
            </p>
          </div>
        )}

        {/* Chat messages */}
        {showChat && chatMessages.length > 0 && (
          <div className="mt-8 space-y-4 border-t border-brand-border pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-cyan" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  {t('analysis.conversation')}
                </span>
              </div>
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-text-dim hover:bg-brand-red/10 hover:text-brand-red"
              >
                <Trash2 size={12} aria-hidden="true" />
                {t('analysis.chatDelete')}
              </button>
            </div>

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
                    <Sparkles size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-brand-cyan/10 text-brand-text'
                      : 'border border-brand-border bg-brand-card/60 text-brand-text'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownView content={msg.content} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                      {msg.content}
                    </pre>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-card text-brand-text-dim">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}

            {chat.kind === 'streaming' && chat.buffer && (
              <div className="flex gap-3">
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
                  <Sparkles size={14} />
                </div>
                <div className="max-w-[80%] rounded-2xl border border-brand-border bg-brand-card/60 px-4 py-3">
                  <MarkdownView content={chat.buffer} />
                  <span className="inline-block h-3 w-1.5 animate-pulse bg-brand-cyan" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* Chat input */}
      {showChat && (
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendChatMessage()
              }
            }}
            disabled={chat.kind === 'streaming'}
            placeholder={
              chatMessages.length === 0
                ? t('analysis.chatPlaceholderEmpty')
                : t('analysis.chatPlaceholderMore')
            }
            className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
          />
          {chat.kind === 'streaming' ? (
            <button
              onClick={handleStopChat}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-red/30 bg-brand-red/10 text-brand-red transition-colors hover:bg-brand-red/20"
              title={t('analysis.stopChat')}
              aria-label={t('analysis.stopChat')}
            >
              <Square size={16} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              aria-label={t('analysis.send')}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan text-brand-dark transition-all hover:bg-brand-cyan-dim disabled:opacity-40"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
