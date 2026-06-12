import { FileText, Calendar, AlertTriangle, CheckSquare, Info, ShieldAlert } from 'lucide-react'
import type { SummaryResult, ActionItem } from '@/lib/parse-analysis'

interface Props {
  result: SummaryResult
}

function priorityColor(priority?: ActionItem['priority']): string {
  if (!priority) return 'border-brand-border text-brand-text-dim bg-brand-card/40'
  const lower = priority.toLowerCase()
  if (lower === 'hoch' || lower === 'high')
    return 'border-brand-red/30 text-brand-red bg-brand-red/5'
  if (lower === 'mittel' || lower === 'medium')
    return 'border-brand-amber/30 text-brand-amber bg-brand-amber/5'
  return 'border-brand-text-dim/30 text-brand-text-dim bg-brand-card/40'
}

function priorityLabel(priority?: ActionItem['priority']): string {
  if (!priority) return ''
  const map: Record<string, string> = {
    hoch: 'Hoch',
    high: 'Hoch',
    mittel: 'Mittel',
    medium: 'Mittel',
    niedrig: 'Niedrig',
    low: 'Niedrig'
  }
  return map[priority.toLowerCase()] ?? priority
}

export function SummaryView({ result }: Props) {
  return (
    <div className="space-y-6">
      {/* Phishing warning - shown prominently at the top if detected */}
      {result.phishingWarning && (
        <div className="rounded-2xl border border-brand-red/40 bg-brand-red/10 p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert size={18} className="text-brand-red" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-red">
              Phishing-Verdacht
            </h3>
          </div>
          <p className="text-sm text-brand-text">{result.phishingWarning}</p>
          <p className="mt-2 text-xs text-brand-text-dim">
            Klicke auf keine Links und gib keine Daten ein. Ueberpruefe den Absender direkt ueber
            die offizielle Website.
          </p>
        </div>
      )}

      {/* Hero - Dokumenttyp */}
      <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
              Dokumenttyp
            </p>
            <h2 className="text-xl font-bold text-brand-text-bright">{result.documentType}</h2>
            {result.title && <p className="mt-1 text-sm text-brand-text-dim">{result.title}</p>}
          </div>
        </div>
      </div>

      {/* Key Facts */}
      {result.keyFacts.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            Wichtige Fakten
          </h3>
          <div className="space-y-2">
            {result.keyFacts.map((fact, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-brand-border/60 bg-brand-darker/40 px-4 py-2.5"
              >
                <span className="w-32 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  {fact.label}
                </span>
                <span className="text-sm text-brand-text">{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {result.keyPoints.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            Kernaussagen
          </h3>
          <ul className="space-y-2">
            {result.keyPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-cyan" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Text */}
      {result.summary && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            Zusammenfassung
          </h3>
          <p className="leading-relaxed text-brand-text">{result.summary}</p>
        </div>
      )}

      {/* Action Items */}
      {result.actionItems.length > 0 && (
        <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/5 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-amber">
            <CheckSquare size={12} />
            Handlungsbedarf
          </h3>
          <div className="space-y-2">
            {result.actionItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-darker/40 p-3"
              >
                <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-brand-amber/50" />
                <div className="flex-1">
                  <p className="text-sm text-brand-text">{item.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.priority && (
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityColor(item.priority)}`}
                      >
                        {priorityLabel(item.priority)}
                      </span>
                    )}
                    {item.deadline && (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-text-dim">
                        <Calendar size={10} />
                        {item.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observations */}
      {result.observations.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <Info size={12} />
            Auffaelligkeiten
          </h3>
          <ul className="space-y-2">
            {result.observations.map((obs, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text-dim">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-brand-amber" />
                <span className="leading-relaxed">{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
