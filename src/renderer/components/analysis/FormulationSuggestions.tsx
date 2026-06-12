import { useState } from 'react'
import { FileText, ArrowRight, Copy, Check } from 'lucide-react'
import type { FormulationResult } from '@/lib/parse-analysis'

interface Props {
  result: FormulationResult
}

export function FormulationSuggestions({ result }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!result.revisedFullText) return
    navigator.clipboard.writeText(result.revisedFullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
              Dokumenttyp
            </p>
            <h2 className="text-lg font-bold text-brand-text-bright">{result.documentType}</h2>
          </div>
        </div>
        {result.toneRecommendation && (
          <p className="mt-2 text-sm text-brand-text-dim">
            <span className="font-semibold text-brand-text">Tonalitaet:</span>{' '}
            {result.toneRecommendation}
          </p>
        )}
        {result.overallImpression && (
          <p className="mt-2 text-sm leading-relaxed text-brand-text-dim">
            {result.overallImpression}
          </p>
        )}
      </div>

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            {result.suggestions.length} Verbesserungsvorschlaege
          </h3>
          {result.suggestions.map((s) => (
            <div
              key={s.index}
              className="rounded-2xl border border-brand-border bg-brand-card/40 p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-cyan/10 font-mono text-xs text-brand-cyan">
                  {s.index}
                </span>
                <span className="text-sm font-semibold text-brand-text-bright">{s.title}</span>
                {s.category && (
                  <span className="rounded-lg border border-brand-cyan/20 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-cyan">
                    {s.category}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="flex-1 rounded-xl border border-brand-border bg-brand-darker/60 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                    Vorher
                  </p>
                  <p className="text-sm italic text-brand-text-dim line-through">{s.before}</p>
                </div>
                <div className="hidden items-center text-brand-cyan sm:flex">
                  <ArrowRight size={16} />
                </div>
                <div className="flex-1 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-cyan">
                    Nachher
                  </p>
                  <p className="text-sm text-brand-text">{s.after}</p>
                </div>
              </div>

              {s.why && (
                <p className="mt-3 text-xs italic text-brand-text-dim">
                  <span className="font-semibold text-brand-text">Warum:</span> {s.why}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Revised full version */}
      {result.revisedFullText && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">
              Ueberarbeitete Gesamtversion
            </h3>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-brand-green" />
                  Kopiert
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Kopieren
                </>
              )}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-brand-text">
            {result.revisedFullText}
          </pre>
        </div>
      )}
    </div>
  )
}
