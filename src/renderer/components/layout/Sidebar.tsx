import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Upload,
  FileSearch,
  History,
  Settings,
  Circle,
  Play,
  Loader2,
  Download,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Clock
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { daysUntil } from '@shared/deadline-calc'
import { toIsoDate } from '@shared/german-holidays'
import type { DeadlineWithDocument } from '@shared/types'
import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { HardwareIndicator } from './HardwareIndicator'

interface NavItem {
  path: string
  labelKey: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/', labelKey: 'nav.upload', icon: <Upload size={18} aria-hidden="true" /> },
  {
    path: '/analysis',
    labelKey: 'nav.analysis',
    icon: <FileSearch size={18} aria-hidden="true" />
  },
  { path: '/history', labelKey: 'nav.history', icon: <History size={18} aria-hidden="true" /> },
  { path: '/settings', labelKey: 'nav.settings', icon: <Settings size={18} aria-hidden="true" /> }
]

/** Ohne 'expired': abgelaufene Fristen zeigt die Sidebar bewusst nicht an. */
type SidebarUrgency = 'critical' | 'soon' | 'ok'

const urgencyStyles: Record<
  SidebarUrgency,
  { button: string; text: string; badge: string; icon: React.ReactNode; labelKey: string }
> = {
  critical: {
    button: 'border-brand-red/30 bg-brand-red/5 hover:bg-brand-red/10',
    text: 'text-brand-red',
    badge: 'border-brand-red/30 bg-brand-red/10 text-brand-red',
    icon: <AlertTriangle size={11} aria-hidden="true" />,
    labelKey: 'deadlines.urgencyCritical'
  },
  soon: {
    button: 'border-brand-amber/30 bg-brand-amber/5 hover:bg-brand-amber/10',
    text: 'text-brand-amber',
    badge: 'border-brand-amber/30 bg-brand-amber/10 text-brand-amber',
    icon: <Clock size={11} aria-hidden="true" />,
    labelKey: 'deadlines.urgencySoon'
  },
  ok: {
    button: 'border-brand-border bg-brand-card/40 hover:bg-brand-card',
    text: 'text-brand-text-bright',
    badge: 'border-brand-border bg-brand-darker/60 text-brand-text-dim',
    icon: <CalendarCheck size={11} aria-hidden="true" />,
    labelKey: 'deadlines.urgencyOk'
  }
}

function urgencyFor(daysLeft: number): SidebarUrgency {
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'soon'
  return 'ok'
}

/**
 * Heutiger Tag als ISO-Datum in lokaler Zeit. `toISOString()` waere oestlich
 * von Greenwich abends schon der Folgetag - und damit eine Frist zu wenig.
 */
function localTodayIso(): string {
  const now = new Date()
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

interface NextDeadlineProps {
  deadline: DeadlineWithDocument
  todayIso: string
  /** Weitere offene Fristen ausser dieser. */
  moreCount: number
  onOpen: (documentId: string) => void
}

/** Kompakter Block unten in der Sidebar: was als naechstes ablaeuft. */
function NextDeadline({
  deadline,
  todayIso,
  moreCount,
  onOpen
}: NextDeadlineProps): React.ReactElement {
  const { t } = useTranslation()
  const daysLeft = daysUntil(deadline.dueDateIso, todayIso)
  const style = urgencyStyles[urgencyFor(daysLeft)]

  // Null und Eins bekommen eigene Saetze - "noch 0 Tage" versteht niemand.
  let countdown: string
  if (daysLeft === 0) countdown = t('deadlines.today')
  else if (daysLeft === 1) countdown = t('deadlines.tomorrow')
  else countdown = t('deadlines.daysLeft', { count: daysLeft })

  return (
    <div className="border-t border-brand-border p-3">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-brand-text-dim">
        <CalendarClock size={12} aria-hidden="true" />
        {t('deadlines.title')}
      </h2>

      <ul className="space-y-1">
        <li>
          <button
            type="button"
            onClick={() => onOpen(deadline.documentId)}
            title={deadline.filename}
            className={`w-full rounded-xl border px-3 py-2.5 text-start transition-all duration-200 ${style.button}`}
          >
            {/* Dringlichkeit steht zusaetzlich als Text da - Farbe allein reicht nicht. */}
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
            >
              {style.icon}
              {t(style.labelKey)}
            </span>
            <span className={`mt-1.5 block text-sm font-semibold ${style.text}`}>{countdown}</span>
            <span className="mt-0.5 block truncate text-xs text-brand-text-dim">
              {deadline.filename}
            </span>
          </button>
        </li>

        {moreCount > 0 && (
          <li className="px-3 py-1 text-xs text-brand-text-dim">
            {/* "+2" allein sagt Screenreadern nichts - der Kontext kommt unsichtbar dazu. */}
            {`+${moreCount}`} <span className="sr-only">{t('deadlines.title')}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { connected, model, installed, starting, startError, startOllama } = useOllamaStatus()
  const [deadlines, setDeadlines] = useState<DeadlineWithDocument[]>([])
  const [todayIso, setTodayIso] = useState<string>(localTodayIso)

  useEffect(() => {
    let active = true

    const load = async (): Promise<void> => {
      try {
        const upcoming = await window.api.deadlines.upcoming()
        if (!active) return
        // Bei jedem Laden neu bestimmen, damit die Sidebar ueber Mitternacht
        // hinweg nicht auf dem gestrigen Tag haengen bleibt.
        setTodayIso(localTodayIso())
        setDeadlines(upcoming)
      } catch {
        if (active) setDeadlines([])
      }
    }

    void load()
    // Die Fristensuche laeuft im Hintergrund nach einer Analyse - danach neu laden.
    const unsubscribe = window.api.deadlines.onUpdated(() => {
      void load()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Der Main-Prozess liefert auch abgelaufene Fristen; hier zaehlt nur, was noch laeuft.
  const openDeadlines = useMemo(
    () =>
      deadlines
        .filter((d) => d.dueDateIso >= todayIso)
        .sort((a, b) => a.dueDateIso.localeCompare(b.dueDateIso)),
    [deadlines, todayIso]
  )
  const nextDeadline: DeadlineWithDocument | undefined = openDeadlines[0]

  return (
    <aside className="flex w-[260px] flex-col border-e border-brand-border bg-brand-darker">
      <nav className="flex flex-1 flex-col gap-1 p-3 pt-4">
        {navItems.map((item) => {
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan'
                  : 'border border-transparent text-brand-text-dim hover:bg-brand-card hover:text-brand-text'
              }`}
            >
              {item.icon}
              {t(item.labelKey)}
            </button>
          )
        })}
      </nav>

      {/* Naechste offene Frist - faellt ganz weg, wenn keine laeuft */}
      {nextDeadline && (
        <NextDeadline
          deadline={nextDeadline}
          todayIso={todayIso}
          moreCount={openDeadlines.length - 1}
          onOpen={(documentId) => navigate(`/document/${documentId}`)}
        />
      )}

      {/* Hardware / Runtime Indicator */}
      <div className="border-t border-brand-border p-3">
        <HardwareIndicator />
      </div>

      {/* Ollama Status */}
      <div className="border-t border-brand-border p-4">
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={
              connected
                ? 'fill-brand-green text-brand-green'
                : starting
                  ? 'fill-brand-amber text-brand-amber'
                  : 'fill-brand-red text-brand-red'
            }
          />
          <span className="text-xs text-brand-text-dim">
            {connected
              ? t('sidebar.connected')
              : starting
                ? t('sidebar.starting')
                : installed
                  ? t('sidebar.inactive')
                  : t('sidebar.notInstalled')}
          </span>
        </div>

        {connected && model && (
          <p className="mt-1 truncate ps-4 font-mono text-xs text-brand-text-dim">{model}</p>
        )}

        {/* Start button if installed but not connected */}
        {!connected && installed && (
          <button
            onClick={startOllama}
            disabled={starting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-2 text-xs font-medium text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-50"
          >
            {starting ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                {t('sidebar.startingShort')}
              </>
            ) : (
              <>
                <Play size={12} aria-hidden="true" />
                {t('sidebar.start')}
              </>
            )}
          </button>
        )}

        {/* Install hint if not installed */}
        {!connected && !installed && !starting && (
          <a
            href="https://ollama.com/download"
            onClick={(e) => {
              e.preventDefault()
              // Open external link via shell
              // Note: shell.openExternal is handled in main via setWindowOpenHandler
              window.open('https://ollama.com/download', '_blank')
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-medium text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <Download size={12} aria-hidden="true" />
            {t('sidebar.download')}
          </a>
        )}

        {startError && <p className="mt-2 text-xs text-brand-red">{startError}</p>}
      </div>
    </aside>
  )
}
