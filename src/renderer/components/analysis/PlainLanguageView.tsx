import { useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Hash,
  HelpCircle,
  Info,
  ListChecks,
  Megaphone,
  PenLine
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlainLanguageResult, Urgency } from '@/lib/parse-plain-language'
import { GlossaryText } from '@/components/GlossaryText'

interface Props {
  result: PlainLanguageResult
  /** Wird gerufen, wenn der Nutzer aus einer Handlungsempfehlung heraus einen Brief schreiben will. */
  onWriteLetter?: () => void
}

const urgencyConfig: Record<
  Urgency,
  { border: string; bg: string; text: string; icon: React.ReactNode; labelKey: string }
> = {
  high: {
    border: 'border-brand-red/50',
    bg: 'bg-brand-red/10',
    text: 'text-brand-red',
    icon: <AlertOctagon size={20} aria-hidden="true" />,
    labelKey: 'results.plain.urgencyHigh'
  },
  medium: {
    border: 'border-brand-amber/50',
    bg: 'bg-brand-amber/10',
    text: 'text-brand-amber',
    icon: <AlertTriangle size={20} aria-hidden="true" />,
    labelKey: 'results.plain.urgencyMedium'
  },
  low: {
    border: 'border-brand-green/50',
    bg: 'bg-brand-green/10',
    text: 'text-brand-green',
    icon: <CheckCircle2 size={20} aria-hidden="true" />,
    labelKey: 'results.plain.urgencyLow'
  }
}

type Tone = 'neutral' | 'warn' | 'cyan'

const toneConfig: Record<Tone, { card: string; title: string }> = {
  neutral: { card: 'border-brand-border bg-brand-card/40', title: 'text-brand-text-dim' },
  warn: { card: 'border-brand-amber/30 bg-brand-amber/5', title: 'text-brand-amber' },
  cyan: { card: 'border-brand-cyan/20 bg-brand-cyan/5', title: 'text-brand-cyan' }
}

function Section({
  title,
  icon,
  tone = 'neutral',
  children
}: {
  title: string
  icon: React.ReactNode
  tone?: Tone
  children: React.ReactNode
}): React.ReactElement {
  const colors = toneConfig[tone]
  return (
    <section className={`rounded-2xl border p-6 ${colors.card}`}>
      <h3
        className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${colors.title}`}
      >
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Fliesstext mit Glossar-Treffern, oder der Hinweis, dass nichts dazu dasteht. */
function Prose({ text, empty }: { text: string; empty: string }): React.ReactElement {
  if (!text) return <p className="text-sm italic text-brand-text-dim">{empty}</p>
  return (
    <GlossaryText
      text={text}
      className="block whitespace-pre-wrap leading-relaxed text-brand-text"
    />
  )
}

/**
 * Ergebnis des Modus "Einfach erklaert".
 *
 * Reihenfolge ist Absicht: Wer einen Bescheid in der Hand haelt, soll oben in
 * drei Sekunden lesen, wie schlimm es ist, was verlangt wird und bis wann.
 * Erklaerungen und Details kommen erst darunter.
 */
export function PlainLanguageView({ result, onWriteLetter }: Props): React.ReactElement {
  const { t } = useTranslation()
  // Abhaken ist reine Lesehilfe und wird nicht gespeichert. Ein neues Ergebnis
  // setzt die Haken zurueck, weil die Seite die Ansicht neu montiert.
  const [checked, setChecked] = useState<Set<number>>(() => new Set())

  const toggleChecked = (idx: number): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const urgency = urgencyConfig[result.urgency]

  return (
    <div className="space-y-6">
      {/* Das Wichtigste - der Block, der alles andere ueberstrahlen darf */}
      <section className={`rounded-2xl border-2 p-6 ${urgency.border} ${urgency.bg}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
              {t('results.plain.headline')}
            </p>
            <h2 className="text-2xl font-bold leading-snug text-brand-text-bright md:text-3xl">
              {result.headline || t('results.plain.emptySection')}
            </h2>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 self-start rounded-xl border px-3 py-2 text-sm font-bold uppercase tracking-wide ${urgency.border} ${urgency.text}`}
          >
            {urgency.icon}
            {t(urgency.labelKey)}
          </span>
        </div>
        {result.urgencyReason && (
          <p className="mt-4 text-base leading-relaxed text-brand-text">{result.urgencyReason}</p>
        )}
      </section>

      {/* Forderung und Folgen sind die Kernfrage dieser Ansicht - beide Karten
          bleiben stehen, auch wenn das Modell eine davon nicht gefuellt hat. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title={t('results.plain.demand')}
          icon={<Megaphone size={12} aria-hidden="true" />}
        >
          <Prose text={result.demand} empty={t('results.plain.emptySection')} />
        </Section>
        <Section
          title={t('results.plain.ifNothing')}
          icon={<AlertTriangle size={12} aria-hidden="true" />}
          tone="warn"
        >
          <Prose text={result.ifNothing} empty={t('results.plain.emptySection')} />
        </Section>
      </div>

      <p className="flex items-start gap-2 text-xs text-brand-text-dim">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        {t('glossary.hint')}
      </p>

      {result.actions.length > 0 && (
        <Section
          title={t('results.plain.actions')}
          icon={<ListChecks size={12} aria-hidden="true" />}
          tone="cyan"
        >
          <ul className="space-y-2">
            {result.actions.map((action, idx) => {
              const isChecked = checked.has(idx)
              return (
                <li key={idx}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggleChecked(idx)}
                    className="flex w-full items-start gap-3 rounded-xl border border-brand-border bg-brand-darker/40 p-3 text-start transition-colors hover:border-brand-cyan/30"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        isChecked
                          ? 'border-brand-green bg-brand-green/20 text-brand-green'
                          : 'border-brand-text-dim/50'
                      }`}
                    >
                      {isChecked && <Check size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-relaxed ${
                          isChecked ? 'text-brand-text-dim line-through' : 'text-brand-text'
                        }`}
                      >
                        {action.text}
                      </span>
                      {action.deadline ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-brand-amber/30 bg-brand-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-amber">
                          <CalendarClock size={10} aria-hidden="true" />
                          {t('results.plain.until')} {action.deadline}
                        </span>
                      ) : (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-brand-border px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-text-dim">
                          {t('results.plain.noDeadline')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {onWriteLetter && (
            <button
              type="button"
              onClick={onWriteLetter}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-2.5 text-sm font-semibold text-brand-cyan transition-colors hover:bg-brand-cyan/20"
            >
              <PenLine size={16} aria-hidden="true" />
              {t('analysis.writeLetter')}
            </button>
          )}
        </Section>
      )}

      <Section title={t('results.plain.about')} icon={<Info size={12} aria-hidden="true" />}>
        <Prose text={result.about} empty={t('results.plain.emptySection')} />
      </Section>

      {result.facts.length > 0 && (
        <Section title={t('results.plain.facts')} icon={<Hash size={12} aria-hidden="true" />}>
          <dl className="space-y-2">
            {result.facts.map((fact, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1 rounded-lg border border-brand-border/60 bg-brand-darker/40 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim sm:w-40 sm:shrink-0">
                  {fact.label}
                </dt>
                <dd className="font-mono text-sm text-brand-text-bright">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {result.terms.length > 0 && (
        <Section title={t('results.plain.terms')} icon={<BookOpen size={12} aria-hidden="true" />}>
          <ul className="space-y-3">
            {result.terms.map((term, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-brand-border bg-brand-darker/40 p-4"
              >
                <p className="text-sm font-semibold text-brand-text-bright">{term.term}</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-text-dim">
                  {term.explanation}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.gaps.length > 0 && (
        <Section title={t('results.plain.gaps')} icon={<HelpCircle size={12} aria-hidden="true" />}>
          <ul className="space-y-2">
            {result.gaps.map((gap, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs leading-relaxed text-brand-text-dim"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-text-dim"
                />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
