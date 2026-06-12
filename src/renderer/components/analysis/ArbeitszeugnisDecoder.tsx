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
  LogOut,
  Flag
} from 'lucide-react'
import type {
  ArbeitszeugnisResult,
  ZeugnisSeverity,
  ZeugnisAssessment,
  ZeugnisCodedPhrase,
  ZeugnisGrade
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

function gradeColor(grade: number): {
  bg: string
  text: string
  border: string
  ring: string
  fill: string
} {
  if (grade <= 1)
    return {
      bg: 'bg-brand-green/10',
      text: 'text-brand-green',
      border: 'border-brand-green/30',
      ring: 'ring-brand-green/20',
      fill: 'bg-brand-green'
    }
  if (grade <= 2)
    return {
      bg: 'bg-brand-cyan/10',
      text: 'text-brand-cyan',
      border: 'border-brand-cyan/30',
      ring: 'ring-brand-cyan/20',
      fill: 'bg-brand-cyan'
    }
  if (grade <= 3)
    return {
      bg: 'bg-brand-amber/10',
      text: 'text-brand-amber',
      border: 'border-brand-amber/30',
      ring: 'ring-brand-amber/20',
      fill: 'bg-brand-amber'
    }
  if (grade <= 4)
    return {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      ring: 'ring-orange-500/20',
      fill: 'bg-orange-500'
    }
  return {
    bg: 'bg-brand-red/10',
    text: 'text-brand-red',
    border: 'border-brand-red/30',
    ring: 'ring-brand-red/20',
    fill: 'bg-brand-red'
  }
}

const severityConfig: Record<
  ZeugnisSeverity,
  { bg: string; border: string; text: string; icon: React.ReactNode; label: string }
> = {
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

function assessmentIcon(assessment: ZeugnisAssessment | null): React.ReactNode {
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

function assessmentColor(assessment: ZeugnisAssessment | null): string {
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

function GradeScale({
  grade,
  fillClass
}: {
  grade: number
  fillClass: string
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div
          key={n}
          className={`h-3 flex-1 rounded-full transition-colors ${
            n <= grade ? fillClass : 'bg-brand-border'
          }`}
        />
      ))}
    </div>
  )
}

function GradeHero({
  title,
  data
}: {
  title: string
  data: ZeugnisGrade
}): React.ReactElement {
  const colors = gradeColor(data.grade)
  const label = data.label ?? gradeLabels[data.grade] ?? ''
  return (
    <div className={`rounded-2xl border p-6 ${colors.border} ${colors.bg}`}>
      <div className="mb-3 flex items-center gap-2">
        <Award size={14} className={colors.text} />
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
          {title}
        </p>
        <span className="ml-auto rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-text-dim">
          Konfidenz: {data.confidence}
        </span>
      </div>

      <div className="mb-3 flex items-baseline gap-3">
        <span className={`font-mono text-3xl font-bold ${colors.text}`}>Note {data.grade}</span>
        <span className={`text-lg font-semibold ${colors.text}`}>{label}</span>
      </div>

      <GradeScale grade={data.grade} fillClass={colors.fill} />

      {data.reasoning && (
        <p className="mt-3 text-xs leading-relaxed text-brand-text">{data.reasoning}</p>
      )}
    </div>
  )
}

function RedFlagsBlock({ phrases }: { phrases: ZeugnisCodedPhrase[] }): React.ReactElement | null {
  const redPhrases = phrases.filter((p) => p.severity === 'red').slice(0, 3)
  if (redPhrases.length === 0) return null

  return (
    <div className="rounded-2xl border border-brand-red/30 bg-brand-red/5 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-red">
        <Flag size={14} />
        Rote Flaggen ({redPhrases.length})
      </h3>
      <div className="space-y-3">
        {redPhrases.map((p, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-xl border border-brand-red/20 bg-brand-darker/40 p-3"
          >
            <AlertOctagon size={16} className="mt-0.5 flex-shrink-0 text-brand-red" />
            <div className="min-w-0 flex-1">
              <blockquote className="mb-1 border-l-2 border-brand-red/40 pl-3 text-sm italic text-brand-text">
                &quot;{p.phrase}&quot;
              </blockquote>
              <p className="text-xs text-brand-red">
                <span className="font-semibold">Wirklich gemeint:</span> {p.decoded}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ArbeitszeugnisDecoder({ result }: Props): React.ReactElement {
  // Red phrases start expanded so the worst findings are visible without a click.
  // Keyed by result identity via lazy init so a new analysis resets the state.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const set = new Set<number>()
    result.codedPhrases.forEach((cp, idx) => {
      if (cp.severity === 'red') set.add(idx)
    })
    return set
  })
  const [infoOpen, setInfoOpen] = useState(true)

  const toggleExpanded = (idx: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

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
      {infoOpen && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/20 text-brand-cyan">
              <Award size={14} />
            </div>
            <div className="flex-1 text-xs text-brand-text-dim leading-relaxed">
              <p className="mb-1 font-semibold text-brand-cyan">Zwei Noten - zwei Perspektiven</p>
              <p>
                <strong className="text-brand-text">Inhalt</strong> = was das Zeugnis ueber
                dich AUSSAGT (Leistungsbewertung, versteckte Codes, rote Flaggen).{' '}
                <strong className="text-brand-text">Struktur</strong> = wie geschickt/professionell
                es VERFASST ist (Vollstaendigkeit, HR-Konformitaet, sprachliche Qualitaet).
                Beide sind unabhaengig.
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

      <div className="grid gap-4 md:grid-cols-2">
        <GradeHero title="Inhalt" data={result.contentGrade} />
        <GradeHero title="Struktur & Handwerk" data={result.craftGrade} />
      </div>

      <div className="flex items-center gap-2 text-xs text-brand-text-dim">
        <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 font-mono text-[10px] uppercase">
          {result.documentType}
        </span>
      </div>

      <RedFlagsBlock phrases={result.codedPhrases} />

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
                      &quot;{section.excerpt}&quot;
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

      {result.codedPhrases.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <AlertTriangle size={12} />
            Alle versteckten Codes ({result.codedPhrases.length})
          </h3>
          <div className="space-y-3">
            {result.codedPhrases.map((cp, idx) => {
              const sev = severityConfig[cp.severity] ?? severityConfig.yellow
              const hasSuggestion =
                cp.suggestion &&
                (cp.suggestion.note2 || cp.suggestion.note3 || cp.suggestion.howToNegotiate)
              const isExpanded = expanded.has(idx)
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
                        onClick={() => toggleExpanded(idx)}
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

      {(result.closingFormula.regret ||
        result.closingFormula.wishes ||
        result.closingFormula.thanks) && (
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
                  <p className="text-xs italic text-brand-text">&quot;{data.excerpt}&quot;</p>
                ) : (
                  <p className="text-xs italic text-brand-red">Fehlt</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
