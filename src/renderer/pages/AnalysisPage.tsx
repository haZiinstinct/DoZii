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
  FileDown
} from 'lucide-react'
import type { AnalysisMode, AnalysisRunResult, ChatMessage, DoziiDocument } from '@shared/types'
import { MarkdownView } from '@/components/analysis/MarkdownView'
import { GrammarResults } from '@/components/analysis/GrammarResults'
import { FormulationSuggestions } from '@/components/analysis/FormulationSuggestions'
import { ArbeitszeugnisDecoder } from '@/components/analysis/ArbeitszeugnisDecoder'
import { SummaryView } from '@/components/analysis/SummaryView'
import { useStreamingInvocation } from '@/hooks/useStreamingInvocation'
import {
  parseGrammar,
  parseFormulation,
  parseSummary,
  parseArbeitszeugnis,
  stripTrailingJsonBlock
} from '@/lib/parse-analysis'

const modeLabels: Record<string, string> = {
  grammar: 'Rechtschreibung & Grammatik',
  formulation: 'Bessere Formulierungen',
  arbeitszeugnis: 'Arbeitszeugnis-Decoder',
  summary: 'Zusammenfassung',
  freeform: 'Freie Frage'
}

// ============================================================================
// State machine: discriminated union prevents invalid boolean combinations
// ============================================================================

type AnalysisPhase = 'analyzing' | 'verifying'

type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'streaming'; text: string; phase: AnalysisPhase }
  | { kind: 'done'; text: string; result: AnalysisRunResult | null }
  | { kind: 'aborted'; text: string }
  | { kind: 'error'; message: string; partial: string }

type ChatState =
  | { kind: 'idle' }
  | { kind: 'streaming'; buffer: string }
  | { kind: 'error'; message: string }

export function AnalysisPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const docId = params.get('doc')
  const mode = (params.get('mode') || 'grammar') as AnalysisMode

  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: 'idle' })
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chat, setChat] = useState<ChatState>({ kind: 'idle' })
  const [chatInput, setChatInput] = useState('')
  const [freeQuestion, setFreeQuestion] = useState('')
  const [doc, setDoc] = useState<DoziiDocument | null>(null)

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
  }, [docId])

  // Subscribe to analysis:phase events for two-pass modes.
  // When we transition to verifying, we reset `text` so the clean pass 2
  // output replaces the pass 1 output in the UI.
  useEffect(() => {
    const unsub = window.api.analysis.onPhase((phase) => {
      setAnalysis((s) => {
        if (s.kind !== 'streaming') return s
        if (phase === 'verifying') return { ...s, phase, text: '' }
        return { ...s, phase }
      })
    })
    return unsub
  }, [])

  const startAnalysis = useCallback(
    async (question?: string) => {
      if (!docId) return
      setAnalysis({ kind: 'streaming', text: '', phase: 'analyzing' })

      await analysisStream.run(() => window.api.analysis.run(docId, mode, question), {
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

  // Auto-start for non-freeform modes
  useEffect(() => {
    if (docId && mode !== 'freeform') {
      startAnalysis()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, mode])

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

  const handleExportPdf = useCallback(async () => {
    if (analysis.kind !== 'done' || !analysis.result) return
    const res = await window.api.exporter.analysisAsPdf(analysis.result.analysis.id)
    if (!res.ok && res.error) {
      window.api.logs.write('error', 'AnalysisPage', 'PDF export failed', { error: res.error })
    }
  }, [analysis])

  // Parse the structured response once streaming is done.
  // Pass doc.extractedText for evidence validation - parsers will filter
  // hallucinated findings whose quotes don't appear in the original text.
  const parsed = useMemo(() => {
    if (analysis.kind !== 'done' || !analysis.text) return null
    const docText = doc?.extractedText
    try {
      switch (mode) {
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
        case 'summary':
          return { type: 'summary' as const, data: parseSummary(analysis.text) }
        default:
          return null
      }
    } catch {
      return null
    }
  }, [analysis, mode, doc])

  if (!docId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <FileSearch size={28} className="mb-4 text-brand-cyan" />
        <p className="text-brand-text-dim">
          Kein Dokument ausgewählt. Bitte zuerst ein Dokument hochladen und öffnen.
        </p>
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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/document/${docId}`)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
          <FileSearch size={16} />
        </div>
        <h1 className="flex-1 text-lg font-semibold text-brand-text-bright">
          {modeLabels[mode] || mode}
        </h1>

        {/* Status icons + phase text */}
        {analysis.kind === 'streaming' && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={16} className="animate-spin text-brand-cyan" />
            <span className="text-xs text-brand-text-dim">
              {analysis.phase === 'verifying' ? 'Verifiziert...' : 'Analysiert...'}
            </span>
          </div>
        )}
        {analysis.kind === 'done' && <CheckCircle2 size={16} className="text-brand-green" />}
        {analysis.kind === 'aborted' && <CircleSlash size={16} className="text-brand-amber" />}
        {analysis.kind === 'error' && <AlertCircle size={16} className="text-brand-red" />}

        {/* Stop button - only while streaming */}
        {analysis.kind === 'streaming' && (
          <button
            onClick={handleStopAnalysis}
            className="flex items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red transition-colors hover:bg-brand-red/20"
          >
            <Square size={12} fill="currentColor" />
            Stoppen
          </button>
        )}

        {/* Restart button - after abort/done/error for non-freeform */}
        {(analysis.kind === 'done' || analysis.kind === 'aborted' || analysis.kind === 'error') &&
          mode !== 'freeform' && (
            <button
              onClick={() => startAnalysis()}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              Neu starten
            </button>
          )}

        {/* Export button - only when we have a successful result */}
        {analysis.kind === 'done' && (
          <button
            onClick={handleExportPdf}
            title="Als PDF exportieren"
            className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <FileDown size={12} />
            PDF
          </button>
        )}
      </div>

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
            placeholder="Stelle eine Frage zum Dokument..."
            className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20"
          />
          <button
            onClick={() => freeQuestion.trim() && startAnalysis(freeQuestion)}
            disabled={!freeQuestion.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan text-brand-dark transition-all hover:bg-brand-cyan-dim disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* Error */}
      {analysis.kind === 'error' && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <p className="text-sm text-brand-red">{analysis.message}</p>
        </div>
      )}
      {chat.kind === 'error' && (
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <p className="text-sm text-brand-red">{chat.message}</p>
        </div>
      )}

      {/* Analysis response area */}
      <div
        ref={responseRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-brand-border bg-brand-card/40 p-6"
      >
        {analysis.kind === 'idle' && (
          <p className="text-sm text-brand-text-dim">
            {mode === 'freeform'
              ? 'Stelle eine Frage zum Dokument, um die Analyse zu starten.'
              : 'Analyse wird gestartet...'}
          </p>
        )}

        {currentText && (
          <>
            {analysis.kind === 'streaming' || !parsed?.data ? (
              <MarkdownView content={displayMarkdown} />
            ) : parsed.type === 'grammar' && parsed.data ? (
              <GrammarResults result={parsed.data} />
            ) : parsed.type === 'formulation' && parsed.data ? (
              <FormulationSuggestions result={parsed.data} />
            ) : parsed.type === 'arbeitszeugnis' && parsed.data ? (
              <ArbeitszeugnisDecoder result={parsed.data} />
            ) : parsed.type === 'summary' && parsed.data ? (
              <SummaryView result={parsed.data} />
            ) : (
              <MarkdownView content={displayMarkdown} />
            )}
          </>
        )}

        {analysis.kind === 'streaming' && (
          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-brand-cyan" />
        )}

        {analysis.kind === 'aborted' && (
          <div className="mt-4 rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-3">
            <p className="flex items-center gap-2 text-xs text-brand-amber">
              <CircleSlash size={12} />
              Analyse vom Nutzer abgebrochen. Der bisherige Text wurde gespeichert.
            </p>
          </div>
        )}

        {/* Chat messages */}
        {showChat && chatMessages.length > 0 && (
          <div className="mt-8 space-y-4 border-t border-brand-border pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-cyan" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  Weiteres Gespräch
                </span>
              </div>
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-text-dim hover:bg-brand-red/10 hover:text-brand-red"
              >
                <Trash2 size={12} />
                Chat löschen
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
                ? 'Frage stellen oder weiter diskutieren...'
                : 'Nachricht schreiben...'
            }
            className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
          />
          {chat.kind === 'streaming' ? (
            <button
              onClick={handleStopChat}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-red/30 bg-brand-red/10 text-brand-red transition-colors hover:bg-brand-red/20"
              title="Antwort stoppen"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan text-brand-dark transition-all hover:bg-brand-cyan-dim disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
