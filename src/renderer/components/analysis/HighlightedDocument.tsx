import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { buildHighlightSegments } from '@/lib/highlight'
import type { HighlightQuery, HighlightSpan } from '@/lib/highlight'

interface Props {
  documentText: string
  queries: HighlightQuery[]
  /** Aktuell fokussierte Fundstelle (scrollt in den sichtbaren Bereich). */
  activeId?: string | null
  onSelect?: (id: string) => void
  maxHeightClass?: string
}

/** Die drei Stufen, die globals.css ueber `data-severity` einfaerbt. */
type MarkSeverity = 'red' | 'yellow' | 'green'

const SEVERITY_RANK: Record<MarkSeverity, number> = { green: 0, yellow: 1, red: 2 }

const SEVERITY_LABEL_KEY: Record<MarkSeverity, string> = {
  red: 'results.az.sevRed',
  yellow: 'results.az.sevYellow',
  green: 'results.az.sevGreen'
}

/** Laenge des Zitat-Ausschnitts im aria-label - sonst liest der Screenreader Absaetze vor. */
const MAX_LABEL_CHARS = 80

/**
 * `HighlightQuery.severity` ist frei belegbar: der Zeugnis-Decoder liefert
 * Farben, der Vertrags-Check high/medium/low. Beides landet hier auf denselben
 * drei Stufen. Unbekanntes wird gelb - eine Markierung ohne `data-severity`
 * waere unsichtbar.
 */
function markSeverity(severity: string | undefined): MarkSeverity {
  switch ((severity ?? '').toLowerCase()) {
    case 'red':
    case 'high':
    case 'hoch':
      return 'red'
    case 'green':
    case 'low':
    case 'niedrig':
      return 'green'
    default:
      return 'yellow'
  }
}

/** Bei ueberlappenden Zitaten gewinnt die schwerste Stufe - Risiko nie abschwaechen. */
function worstSeverity(spans: HighlightSpan[]): MarkSeverity {
  return spans.reduce<MarkSeverity>((worst, span) => {
    const current = markSeverity(span.severity)
    return SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst
  }, 'green')
}

function labelSnippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_LABEL_CHARS ? `${flat.slice(0, MAX_LABEL_CHARS)}…` : flat
}

interface RenderSegment {
  text: string
  /** null = unmarkierter Fliesstext. */
  mark: {
    /** Klick-Ziel: die erste (aeusserste) Fundstelle dieses Segments. */
    id: string
    /** Alle hier aktiven Fundstellen - entscheidet ueber `data-active`. */
    ids: string[]
    severity: MarkSeverity
    /** Fundstellen, deren erstes Segment dieses ist - nur die bekommen den Scroll-Anker. */
    anchors: string[]
  } | null
}

export function HighlightedDocument({
  documentText,
  queries,
  activeId,
  onSelect,
  maxHeightClass = 'max-h-[28rem]'
}: Props): React.ReactElement {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const markRefs = useRef(new Map<string, HTMLElement>())

  // Der Text kann 100k Zeichen haben - Segmentierung nur bei echter Aenderung.
  const segments = useMemo<RenderSegment[]>(() => {
    const raw = buildHighlightSegments(documentText, queries)
    const seen = new Set<string>()
    return raw.map((segment) => {
      if (segment.spans.length === 0) return { text: segment.text, mark: null }
      const ids = segment.spans.map((span) => span.id)
      // Ein langes Zitat kann in mehrere Segmente zerfallen; Anker ist immer das erste.
      const anchors = ids.filter((id) => !seen.has(id))
      anchors.forEach((id) => seen.add(id))
      return {
        text: segment.text,
        mark: { id: ids[0], ids, severity: worstSeverity(segment.spans), anchors }
      }
    })
  }, [documentText, queries])

  const registerMark = useCallback((ids: string[], el: HTMLElement | null): void => {
    for (const id of ids) {
      if (el) markRefs.current.set(id, el)
      else markRefs.current.delete(id)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    const container = containerRef.current
    const el = markRefs.current.get(activeId)
    if (!container || !el) return

    // Bewusst kein scrollIntoView: das scrollt auch alle Eltern mit, die Seite
    // wuerde unter dem Panel wegrutschen. Hier scrollt nur der Container, die
    // Fundstelle landet mittig.
    const containerRect = container.getBoundingClientRect()
    const markRect = el.getBoundingClientRect()
    const delta = markRect.top - containerRect.top - (container.clientHeight - markRect.height) / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({
      top: container.scrollTop + delta,
      behavior: reduceMotion ? 'auto' : 'smooth'
    })
  }, [activeId, segments])

  const interactive = onSelect !== undefined

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, id: string): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect?.(id)
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t('results.evidence.regionLabel')}
      tabIndex={0}
      className={`overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-2xl border border-brand-border bg-brand-card/40 p-6 text-start font-sans text-sm leading-relaxed text-brand-text ${maxHeightClass}`}
    >
      {segments.map((segment, idx) => {
        if (!segment.mark) return <Fragment key={idx}>{segment.text}</Fragment>

        const { id, ids, severity, anchors } = segment.mark
        const isActive = activeId != null && ids.includes(activeId)
        const severityLabel = t(SEVERITY_LABEL_KEY[severity])

        return (
          <mark
            key={idx}
            ref={(el) => {
              registerMark(anchors, el)
            }}
            className={`evidence-mark${interactive ? ' cursor-pointer' : ''}`}
            data-severity={severity}
            data-active={isActive ? 'true' : undefined}
            title={t('results.evidence.markTitle', { severity: severityLabel })}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={
              interactive
                ? t('results.evidence.markLabel', {
                    severity: severityLabel,
                    text: labelSnippet(segment.text)
                  })
                : undefined
            }
            onClick={interactive ? () => onSelect?.(id) : undefined}
            onKeyDown={interactive ? (event) => handleKeyDown(event, id) : undefined}
          >
            {segment.text}
          </mark>
        )
      })}
    </div>
  )
}
