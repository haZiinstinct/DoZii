import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GlossaryEntry } from '@shared/glossary'
import type { GlossaryMatch } from '@shared/glossary-match'
import { findGlossaryMatches } from '@shared/glossary-match'

interface GlossaryTextProps {
  text: string
  className?: string
}

/** Ein Stueck Fliesstext: entweder normal (entry null) oder ein Glossar-Treffer. */
interface Segment {
  text: string
  entry: GlossaryEntry | null
}

/** Mehr Treffer pro Textblock ueberfrachten den Absatz mehr als sie helfen. */
const MAX_MATCHES = 25

/** Ein Fehler im Matcher darf nie den Fliesstext verschlucken. */
function safeMatches(text: string): GlossaryMatch[] {
  try {
    return findGlossaryMatches(text, { maxMatches: MAX_MATCHES, uniqueTerms: true })
  } catch {
    return []
  }
}

/**
 * Rendert Fliesstext und unterstreicht Fachbegriffe, die im Glossar stehen.
 * Ein Klick oeffnet die Erklaerung direkt neben dem Wort - kein Portal, damit
 * das Popover mit dem Text mitscrollt.
 *
 * Reine Darstellung: das Glossar ist eine lokale Datentabelle, kein Modellaufruf.
 */
export function GlossaryText({ text, className }: GlossaryTextProps): React.ReactElement {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLSpanElement>(null)
  const triggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const segments = useMemo<Segment[]>(() => {
    if (!text) return []
    const matches = safeMatches(text)
    if (matches.length === 0) return [{ text, entry: null }]

    const sorted = [...matches].sort((a, b) => a.start - b.start)
    const out: Segment[] = []
    let cursor = 0
    for (const match of sorted) {
      // Ueberlappende oder ungueltige Treffer stillschweigend ueberspringen.
      if (match.start < cursor || match.end > text.length || match.end <= match.start) continue
      if (match.start > cursor) out.push({ text: text.slice(cursor, match.start), entry: null })
      out.push({ text: text.slice(match.start, match.end), entry: match.entry })
      cursor = match.end
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), entry: null })
    return out
  }, [text])

  // Escape und Klick ausserhalb schliessen das Popover.
  useEffect(() => {
    if (openIndex === null) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpenIndex(null)
      triggerRefs.current.get(openIndex)?.focus()
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenIndex(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [openIndex])

  return (
    <span ref={containerRef} className={className}>
      {segments.map((segment, idx) => {
        if (!segment.entry) return <span key={idx}>{segment.text}</span>
        const entry = segment.entry
        const isOpen = openIndex === idx
        return (
          <span key={idx} className="relative inline-block">
            <button
              type="button"
              ref={(el) => {
                if (el) triggerRefs.current.set(idx, el)
                else triggerRefs.current.delete(idx)
              }}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
              title={t('glossary.explain')}
              className="glossary-term text-start"
            >
              {segment.text}
            </button>
            {isOpen && (
              <span
                role="dialog"
                aria-label={entry.term}
                className="absolute start-0 top-full z-20 mt-2 block w-72 max-w-[80vw] rounded-xl border border-brand-border bg-brand-card p-4 text-start shadow-xl"
              >
                <span className="block text-sm font-bold text-brand-text-bright">{entry.term}</span>
                <span className="mt-1 block text-sm font-semibold text-brand-text">
                  {entry.short}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-brand-text-dim">
                  {entry.long}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpenIndex(null)
                    triggerRefs.current.get(idx)?.focus()
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-brand-border px-2 py-1 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
                >
                  <X size={12} aria-hidden="true" />
                  {t('glossary.close')}
                </button>
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
