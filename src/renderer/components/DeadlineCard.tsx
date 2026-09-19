import {
  AlertOctagon,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Clock,
  HelpCircle,
  Info
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { daysUntil } from '@shared/deadline-calc'
import { parseIsoDate } from '@shared/german-holidays'
import type { Deadline } from '@shared/types'

interface Props {
  deadline: Deadline
  /** Heutiges Datum als ISO 'YYYY-MM-DD'. Wird hereingereicht, damit die Komponente testbar und deterministisch bleibt. */
  todayIso: string
  onAddToCalendar?: (deadline: Deadline) => void
}

type Urgency = 'expired' | 'critical' | 'soon' | 'ok'

const urgencyConfig: Record<
  Urgency,
  { card: string; text: string; badge: string; icon: React.ReactNode; labelKey: string }
> = {
  expired: {
    card: 'border-brand-red/40 bg-brand-red/10',
    text: 'text-brand-red',
    badge: 'border-brand-red/30 bg-brand-red/10 text-brand-red',
    icon: <AlertOctagon size={12} aria-hidden="true" />,
    labelKey: 'deadlines.urgencyExpired'
  },
  critical: {
    card: 'border-brand-red/30 bg-brand-red/5',
    text: 'text-brand-red',
    badge: 'border-brand-red/30 bg-brand-red/10 text-brand-red',
    icon: <AlertTriangle size={12} aria-hidden="true" />,
    labelKey: 'deadlines.urgencyCritical'
  },
  soon: {
    card: 'border-brand-amber/30 bg-brand-amber/5',
    text: 'text-brand-amber',
    badge: 'border-brand-amber/30 bg-brand-amber/10 text-brand-amber',
    icon: <Clock size={12} aria-hidden="true" />,
    labelKey: 'deadlines.urgencySoon'
  },
  ok: {
    card: 'border-brand-border bg-brand-card/40',
    text: 'text-brand-text-bright',
    badge: 'border-brand-border bg-brand-darker/60 text-brand-text-dim',
    icon: <CalendarCheck size={12} aria-hidden="true" />,
    labelKey: 'deadlines.urgencyOk'
  }
}

function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'soon'
  return 'ok'
}

/**
 * Lokalisiertes Datum. `new Date('2026-03-15')` liest ISO als UTC-Mitternacht -
 * westlich von Greenwich waere das Ergebnis der Vortag. Darum die Datumsteile
 * einzeln in die lokale Zeitzone setzen.
 */
function formatDate(iso: string, locale: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(parts.year, parts.month - 1, parts.day)
  )
}

export function DeadlineCard({ deadline, todayIso, onAddToCalendar }: Props): React.ReactElement {
  const { t, i18n } = useTranslation()
  const daysLeft = daysUntil(deadline.dueDateIso, todayIso)
  const urgency = urgencyFor(daysLeft)
  const config = urgencyConfig[urgency]

  // Null und Eins bekommen eigene Saetze - "noch 0 Tage" versteht niemand.
  let countdown: string
  if (daysLeft === 0) countdown = t('deadlines.today')
  else if (daysLeft === 1) countdown = t('deadlines.tomorrow')
  else if (daysLeft < 0) countdown = t('deadlines.expiredDays', { count: Math.abs(daysLeft) })
  else countdown = t('deadlines.daysLeft', { count: daysLeft })

  return (
    <article className={`rounded-2xl border p-6 ${config.card}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Dringlichkeit steht zusaetzlich als Text da - Farbe allein reicht nicht. */}
        <span
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${config.badge}`}
        >
          {config.icon}
          {t(config.labelKey)}
        </span>
        <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
          {t(`deadlines.kinds.${deadline.kind}`)}
        </span>
        {deadline.confidence === 'low' && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-brand-amber/30 bg-brand-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
            <HelpCircle size={10} aria-hidden="true" />
            {t('deadlines.uncertain')}
          </span>
        )}
      </div>

      <h3 className={`text-2xl font-bold leading-tight ${config.text}`}>{countdown}</h3>

      {deadline.label && <p className="mt-1 text-sm text-brand-text">{deadline.label}</p>}

      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand-text-bright">
        <CalendarDays size={14} className="flex-shrink-0 text-brand-text-dim" aria-hidden="true" />
        {formatDate(deadline.dueDateIso, i18n.language)}
      </p>

      {deadline.quote && (
        <blockquote className="mt-3 border-s-2 border-brand-cyan/40 ps-3 text-sm italic text-brand-text-dim">
          &quot;{deadline.quote}&quot;
        </blockquote>
      )}

      <ul className="mt-3 space-y-1.5 text-xs text-brand-text-dim">
        {deadline.source === 'explicit' ? (
          <li className="flex items-start gap-2">
            <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{t('deadlines.fromDocument')}</span>
          </li>
        ) : (
          deadline.startDateIso && (
            <li className="flex items-start gap-2">
              <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                {t('deadlines.computedFrom', {
                  date: formatDate(deadline.startDateIso, i18n.language)
                })}
              </span>
            </li>
          )
        )}
        {deadline.note && (
          <li className="flex items-start gap-2">
            <AlertTriangle
              size={12}
              className="mt-0.5 flex-shrink-0 text-brand-amber"
              aria-hidden="true"
            />
            <span>{deadline.note}</span>
          </li>
        )}
      </ul>

      {onAddToCalendar && (
        <button
          type="button"
          onClick={() => onAddToCalendar(deadline)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm font-semibold text-brand-cyan transition-all hover:bg-brand-cyan/20"
        >
          <CalendarPlus size={14} aria-hidden="true" />
          {t('deadlines.addToCalendar')}
        </button>
      )}
    </article>
  )
}
