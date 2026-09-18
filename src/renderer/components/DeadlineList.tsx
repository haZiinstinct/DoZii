import { CalendarClock, Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Deadline } from '@shared/types'
import { DeadlineCard } from './DeadlineCard'

interface Props {
  deadlines: Deadline[]
  todayIso: string
  loading?: boolean
  onScan?: () => void
  onAddToCalendar?: (deadline: Deadline) => void
}

/**
 * Sortierung nach Handlungsdruck: was noch laeuft zuerst (naechstes Fristende
 * oben), Abgelaufenes danach - dort zuerst das, was gerade eben abgelaufen ist.
 */
function sortByUrgency(deadlines: Deadline[], todayIso: string): Deadline[] {
  const open = deadlines.filter((d) => d.dueDateIso >= todayIso)
  const expired = deadlines.filter((d) => d.dueDateIso < todayIso)
  open.sort((a, b) => a.dueDateIso.localeCompare(b.dueDateIso))
  expired.sort((a, b) => b.dueDateIso.localeCompare(a.dueDateIso))
  return [...open, ...expired]
}

export function DeadlineList({
  deadlines,
  todayIso,
  loading,
  onScan,
  onAddToCalendar
}: Props): React.ReactElement {
  const { t } = useTranslation()
  const sorted = sortByUrgency(deadlines, todayIso)

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
        <CalendarClock size={14} aria-hidden="true" />
        {t('deadlines.title')}
      </h2>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6 text-center">
          <p className="text-sm text-brand-text-dim">{t('deadlines.none')}</p>
          {onScan && (
            <button
              type="button"
              onClick={onScan}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm font-semibold text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Search size={14} aria-hidden="true" />
              )}
              {loading ? t('deadlines.scanning') : t('deadlines.scan')}
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {sorted.map((deadline) => (
            <li key={deadline.id}>
              <DeadlineCard
                deadline={deadline}
                todayIso={todayIso}
                onAddToCalendar={onAddToCalendar}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-brand-text-dim">{t('deadlines.disclaimer')}</p>
    </section>
  )
}
