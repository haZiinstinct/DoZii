import { AlertOctagon, AlertTriangle, Info, CheckCircle2, BookOpen } from 'lucide-react'
import type { GrammarResult, Severity } from '@/lib/parse-analysis'

interface Props {
  result: GrammarResult
}

const severityConfig: Record<
  Severity,
  { color: string; bg: string; border: string; icon: React.ReactNode; label: string }
> = {
  high: {
    color: 'text-brand-red',
    bg: 'bg-brand-red/10',
    border: 'border-brand-red/30',
    icon: <AlertOctagon size={14} />,
    label: 'Hoch'
  },
  medium: {
    color: 'text-brand-amber',
    bg: 'bg-brand-amber/10',
    border: 'border-brand-amber/30',
    icon: <AlertTriangle size={14} />,
    label: 'Mittel'
  },
  low: {
    color: 'text-brand-text-dim',
    bg: 'bg-brand-card',
    border: 'border-brand-border',
    icon: <Info size={14} />,
    label: 'Niedrig'
  }
}

export function GrammarResults({ result }: Props) {
  const { overall, errors } = result
  // Use the actual verified error count (after evidence validation),
  // not the model's self-reported count which may include halluzinated findings.
  const verifiedCount = errors.length
  const filteredHallucinations = Math.max(0, overall.errorCount - verifiedCount)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-cyan/10">
            {verifiedCount === 0 ? (
              <CheckCircle2 size={28} className="text-brand-green" />
            ) : (
              <span className="font-mono text-2xl font-bold text-brand-cyan">{verifiedCount}</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
              Qualitaet
            </p>
            <h2 className="text-xl font-bold text-brand-text-bright">{overall.quality}</h2>
          </div>
        </div>
        {overall.summary && (
          <p className="text-sm leading-relaxed text-brand-text-dim">{overall.summary}</p>
        )}
        {filteredHallucinations > 0 && (
          <p className="mt-3 rounded-lg border border-brand-amber/20 bg-brand-amber/5 px-3 py-2 text-xs text-brand-amber">
            {filteredHallucinations} nicht belegbare{' '}
            {filteredHallucinations === 1 ? 'Befund wurde' : 'Befunde wurden'} automatisch
            herausgefiltert (Text konnte nicht im Dokument verifiziert werden).
          </p>
        )}
      </div>

      {/* Errors */}
      {errors.length === 0 ? (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-brand-green" />
          <p className="text-sm text-brand-green">Keine Fehler gefunden!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            Fehler-Details
          </h3>
          {errors.map((err) => {
            const sev = severityConfig[err.severity]
            return (
              <div key={err.index} className={`rounded-2xl border p-5 ${sev.border} ${sev.bg}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-darker font-mono text-xs text-brand-text-dim">
                    {err.index}
                  </span>
                  <span className="text-sm font-semibold text-brand-text-bright">{err.type}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${sev.color}`}
                  >
                    {sev.icon}
                    {sev.label}
                  </span>
                </div>

                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                      Original
                    </p>
                    <code className="block rounded-lg border border-brand-red/20 bg-brand-darker px-3 py-2 font-mono text-xs text-brand-red">
                      {err.original}
                    </code>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                      Korrektur
                    </p>
                    <code className="block rounded-lg border border-brand-green/20 bg-brand-darker px-3 py-2 font-mono text-xs text-brand-green">
                      {err.correction}
                    </code>
                  </div>
                </div>

                {err.context && (
                  <div className="mb-2 rounded-lg border-l-2 border-brand-cyan/40 bg-brand-darker/60 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                      Kontext
                    </p>
                    <p className="text-xs italic text-brand-text-dim">{err.context}</p>
                  </div>
                )}

                {err.rule && (
                  <div className="flex items-start gap-2 text-xs text-brand-text-dim">
                    <BookOpen size={12} className="mt-0.5 flex-shrink-0 text-brand-cyan" />
                    <span>{err.rule}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
