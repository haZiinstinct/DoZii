import { useState } from 'react'
import {
  Award,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Minus,
  Plus,
  X,
  FileX,
  Heart,
  Gift,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  LogOut
} from 'lucide-react'
import type {
  ArbeitszeugnisResult,
  ZeugnisSeverity,
  ZeugnisAssessment
} from '@/lib/parse-analysis'

interface Props {
  result: ArbeitszeugnisResult
}

const gradeLabels: Record<number, string> = {
  1: 'Sehr gut',
  2: 'Gut',
  3: 'Befriedigend',
  4: 'Ausreichend',
  5: 'Mangelhaft',
  6: 'Ungenuegend'
}

function gradeColor(grade: number): { bg: string; text: string; border: string; ring: string } {
  if (grade <= 1) return { bg: 'bg-brand-green/10', text: 'text-brand-green', border: 'border-brand-green/30', ring: 'ring-brand-green/20' }
  if (grade <= 2) return { bg: 'bg-brand-cyan/10', text: 'text-brand-cyan', border: 'border-brand-cyan/30', ring: 'ring-brand-cyan/20' }
  if (grade <= 3) return { bg: 'bg-brand-amber/10', text: 'text-brand-amber', border: 'border-brand-amber/30', ring: 'ring-brand-amber/20' }
  if (grade <= 4) return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', ring: 'ring-orange-500/20' }
  return { bg: 'bg-brand-red/10', text: 'text-brand-red', border: 'border-brand-red/30', ring: 'ring-brand-red/20' }
}

const severityConfig: Record<ZeugnisSeverity, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  green: {
    bg: 'bg-brand-green/5',
    border: 'border-brand-green/30',
    text: 'text-brand-green',
    icon: <CheckCircle2 size={14} />,
    label: 'Positiv'
  },
  yellow: {
    bg: 'bg-brand-amber/5',
    border: 'border-brand-amber/30',
    text: 'text-brand-amber',
    icon: <AlertTriangle size={14} />,
    label: 'Auffaellig'
  },
  red: {
    bg: 'bg-brand-red/5',
    border: 'border-brand-red/30',
    text: 'text-brand-red',
    icon: <AlertOctagon size={14} />,
    label: 'Negativ'
  }
}

function assessmentIcon(assessment: ZeugnisAssessment): React.ReactNode {
  switch (assessment) {
    case 'positive':
      return <Plus size={14} className="text-brand-green" />
    case 'neutral':
      return <Minus size={14} className="text-brand-text-dim" />
    case 'negative':
    case 'missing_negative':
      return <X size={14} className="text-brand-red" />
    default:
      return null
  }
}

function assessmentColor(assessment: ZeugnisAssessment): string {
  switch (assessment) {
    case 'positive':
      return 'border-brand-green/30 bg-brand-green/5'
    case 'neutral':
      return 'border-brand-border bg-brand-card/40'
    case 'negative':
    case 'missing_negative':
      return 'border-brand-red/30 bg-brand-red/5'
    default:
      return 'border-brand-border bg-brand-card/40'
  }
}

export function ArbeitszeugnisDecoder({ result }: Props) {
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null)
  const [infoOpen, setInfoOpen] = useState(true)
  const contentGrade = result.contentGrade.grade
  const contentColors = gradeColor(contentGrade)
  const contentLabel = result.contentGrade.label ?? gradeLabels[contentGrade] ?? ''
  const craftGrade = result.craftGrade.grade
  const craftColors = gradeColor(craftGrade)
  const craftLabel = result.craftGrade.label ?? gradeLabels[craftGrade] ?? ''

  // If the model detected this isn't a real Arbeitszeugnis, show a clear warning
  if (result.notGenuineZeugnis) {
    return (
      <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/5 p-6">
        <div className="mb-3 flex items-center gap-3">
          <AlertTriangle size={24} className="text-brand-amber" />
          <h2 className="text-lg font-bold text-brand-amber">
            Kein Arbeitszeugnis erkannt
          </h2>
        </div>
        <p className="text-sm text-brand-text">
          Dieser Text scheint kein Arbeitszeugnis zu sein. Der Arbeitszeugnis-Decoder
          funktioniert nur mit echten Arbeitszeugnissen (mit Taetigkeitsbeschreibung,
          Leistungsbewertung und Schlussformel).
        </p>
        {result.summary && (
          <p className="mt-3 text-xs text-brand-text-dim">{result.summary}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info-Box: explains the dual-grade system */}
      {infoOpen && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/20 text-brand-cyan">
              <Award size={14} />
            </div>
            <div className="flex-1 text-xs text-brand-text-dim leading-relaxed">
              <p className="text-brand-cyan font-semibold mb-1">Zwei Noten - zwei Perspektiven</p>
              <p>
                <strong className="text-brand-text">Inhalt</strong> = was das Zeugnis ueber
                dich AUSSAGT (Leistungsbewertung, versteckte Codes, rote Flaggen).{' '}
                <strong className="text-brand-text">Struktur</strong> = wie geschickt/professionell
                es VERFASST ist (Vollstaendigkeit, HR-Konformitaet, sprachliche Qualitaet).
                Beide sind unabhaengig: ein perfekt formuliertes Zeugnis (Struktur 1) kann
                inhaltlich hinterhaeltig schlecht sein (Inhalt 5).
              </p>
            </div>
            <button
              onClick={() => setInfoOpen(false)}
              className="text-brand-text-dim hover:text-brand-text"
              title="Hinweis ausblenden"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Dual Hero - Inhalt & Struktur */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Inhalts-Note */}
        <div
          className={`rounded-2xl border p-6 ${contentColors.border} ${contentColors.bg}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl ring-4 ${contentColors.ring} ${contentColors.bg} border ${contentColors.border}`}
            >
              <span className={`font-mono text-4xl font-bold ${contentColors.text}`}>
                {contentGrade}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Award size={14} className={contentColors.text} />
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  Inhalt
                </p>
              </div>
              <h2 className={`text-xl font-bold ${contentColors.text}`}>{contentLabel}</h2>
              <div className="mt-1">
                <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-text-dim">
                  Konfidenz: {result.contentGrade.confidence}
                </span>
              </div>
              {result.contentGrade.reasoning && (
                <p className="mt-2 text-xs leading-relaxed text-brand-text">
                  {result.contentGrade.reasoning}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Struktur-Note */}
        <div
          className={`rounded-2xl border p-6 ${craftColors.border} ${craftColors.bg}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl ring-4 ${craftColors.ring} ${craftColors.bg} border ${craftColors.border}`}
            >
              <span className={`font-mono text-4xl font-bold ${craftColors.text}`}>
                {craftGrade}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Award size={14} className={craftColors.text} />
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  Struktur & Handwerk
                </p>
              </div>
              <h2 className={`text-xl font-bold ${craftColors.text}`}>{craftLabel}</h2>
              <div className="mt-1">
                <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-text-dim">
                  Konfidenz: {result.craftGrade.confidence}
                </span>
              </div>
              {result.craftGrade.reasoning && (
                <p className="mt-2 text-xs leading-relaxed text-brand-text">
                  {result.craftGrade.reasoning}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document type line */}
      <div className="flex items-center gap-2 text-xs text-brand-text-dim">
        <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 font-mono text-[10px] uppercase">
          {result.documentType}
        </span>
      </div>

      {/* Sections */}
      {result.sections.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            Abschnittsanalyse
          </h3>
          <div className="space-y-3">
            {result.sections.map((section, idx) => {
              const sectionColors = section.grade ? gradeColor(section.grade) : null
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-brand-border bg-brand-darker/40 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {section.present ? (
                        <CheckCircle2 size={14} className="text-brand-green" />
                      ) : (
                        <FileX size={14} className="text-brand-red" />
                      )}
                      <span className="text-sm font-semibold text-brand-text-bright">
                        {section.name}
                      </span>
                    </div>
                    {section.grade && sectionColors && (
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold ${sectionColors.bg} ${sectionColors.text} border ${sectionColors.border}`}
                      >
                        {section.grade}
                      </span>
                    )}
                  </div>
                  {section.excerpt && (
                    <blockquote className="my-2 border-l-2 border-brand-cyan/40 pl-3 text-xs italic text-brand-text-dim">
                      "{section.excerpt}"
                    </blockquote>
                  )}
                  {section.assessment && (
                    <p className="text-xs text-brand-text-dim">{section.assessment}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Coded phrases */}
      {result.codedPhrases.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <AlertTriangle size={12} />
            Versteckte Codes ({result.codedPhrases.length})
          </h3>
          <div className="space-y-3">
            {result.codedPhrases.map((cp, idx) => {
              const sev = severityConfig[cp.severity] ?? severityConfig.yellow
              const hasSuggestion =
                cp.suggestion && (cp.suggestion.note2 || cp.suggestion.note3 || cp.suggestion.howToNegotiate)
              const isExpanded = expandedPhrase === idx
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 ${sev.bg} ${sev.border}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${sev.text}`}
                    >
                      {sev.icon}
                      {sev.label}
                    </span>
                    {cp.verified && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                        <ShieldCheck size={10} />
                        verifiziert
                      </span>
                    )}
                  </div>
                  <blockquote className="my-2 border-l-2 border-brand-cyan/40 pl-3 text-sm italic text-brand-text">
                    &quot;{cp.phrase}&quot;
                  </blockquote>
                  <p className={`text-sm ${sev.text}`}>
                    <span className="font-semibold">Bedeutung:</span> {cp.decoded}
                  </p>

                  {hasSuggestion && (
                    <>
                      <button
                        onClick={() => setExpandedPhrase(isExpanded ? null : idx)}
                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker/60 px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded
                          ? 'Verbesserungsvorschlaege verbergen'
                          : 'Verbesserungsvorschlaege anzeigen'}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 rounded-xl border border-brand-border bg-brand-darker/40 p-4">
                          {cp.suggestion?.note2 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-cyan">
                                Alternativ-Formulierung (Note 2)
                              </p>
                              <p className="text-sm text-brand-text">
                                &quot;{cp.suggestion.note2}&quot;
                              </p>
                            </div>
                          )}
                          {cp.suggestion?.note3 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                                Alternativ-Formulierung (Note 3)
                              </p>
                              <p className="text-sm text-brand-text">
                                &quot;{cp.suggestion.note3}&quot;
                              </p>
                            </div>
                          )}
                          {cp.suggestion?.howToNegotiate && (
                            <div className="border-t border-brand-border pt-3">
                              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
                                <LogOut size={10} />
                                Verhandlungs-Tipp
                              </p>
                              <p className="text-sm italic text-brand-text">
                                {cp.suggestion.howToNegotiate}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing elements */}
      {result.missingElements.length > 0 && (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/5 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-red">
            <FileX size={12} />
            Fehlende Elemente ({result.missingElements.length})
          </h3>
          <div className="space-y-3">
            {result.missingElements.map((el, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <X size={16} className="mt-0.5 flex-shrink-0 text-brand-red" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-text-bright">{el.element}</p>
                  <p className="mt-0.5 text-xs text-brand-text-dim">{el.implication}</p>
                </div>
                <span className="rounded-lg border border-brand-red/20 bg-brand-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-red">
                  {el.importance}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closing formula */}
      {(result.closingFormula.regret || result.closingFormula.wishes || result.closingFormula.thanks) && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            Schlussformel
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Bedauern',
                icon: <Heart size={14} />,
                data: result.closingFormula.regret
              },
              {
                label: 'Zukunftswuensche',
                icon: <TrendingUp size={14} />,
                data: result.closingFormula.wishes
              },
              {
                label: 'Dank',
                icon: <Gift size={14} />,
                data: result.closingFormula.thanks
              }
            ].map(({ label: itemLabel, icon, data }) => (
              <div
                key={itemLabel}
                className={`rounded-xl border p-4 ${assessmentColor(data?.assessment ?? null)}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                    {icon}
                    {itemLabel}
                  </div>
                  {assessmentIcon(data?.assessment ?? null)}
                </div>
                {data?.excerpt ? (
                  <p className="text-xs italic text-brand-text">"{data.excerpt}"</p>
                ) : (
                  <p className="text-xs italic text-brand-red">Fehlt</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary / Fazit */}
      {result.summary && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            Klartext-Fazit
          </h3>
          <p className="leading-relaxed text-brand-text">{result.summary}</p>
        </div>
      )}
    </div>
  )
}
