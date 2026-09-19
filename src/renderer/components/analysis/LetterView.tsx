import { useEffect, useId, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  LifeBuoy,
  ListChecks,
  PenLine
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LetterResult } from '@/lib/parse-letter'

interface Props {
  result: LetterResult
  /** Kopiert Text in die Zwischenablage (Integrator reicht navigator.clipboard durch). */
  onCopy?: (text: string) => void
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Setzt die eingetippten Werte in den Brieftext ein. Leere Felder bleiben als
 * Platzhalter stehen - sie werden spaeter gelb markiert, damit niemand einen
 * Brief mit "[Dein Name]" abschickt.
 */
function fillText(text: string, values: Record<string, string>, open: Set<string>): string {
  let out = text
  for (const [token, value] of Object.entries(values)) {
    if (open.has(token)) continue
    // Ersatz als Funktion: sonst wuerden "$&" o.ae. im Nutzertext ausgewertet.
    out = out.replace(new RegExp(escapeRegExp(token), 'gi'), () => value.trim())
  }
  return out
}

/** Zerlegt den Text so, dass die noch offenen Platzhalter gelb hinterlegt sind. */
function highlightOpen(text: string, openTokens: string[]): React.ReactNode {
  if (openTokens.length === 0) return text
  const re = new RegExp(openTokens.map(escapeRegExp).join('|'), 'gi')
  const nodes: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(re)) {
    const start = match.index
    if (start > last) nodes.push(text.slice(last, start))
    nodes.push(
      <mark
        key={`ph-${start}`}
        className="rounded bg-brand-amber/25 px-1 font-semibold text-brand-amber"
      >
        {match[0]}
      </mark>
    )
    last = start + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Sichtbare Beschriftung eines Platzhalters: "[Dein Name]" -> "Dein Name". */
function placeholderLabel(token: string): string {
  return token.replace(/^\[/, '').replace(/\]$/, '')
}

export function LetterView({ result, onCopy }: Props): React.ReactElement {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)
  const baseId = useId()

  // "Kopiert"-Rueckmeldung nach zwei Sekunden zuruecksetzen.
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const openTokens = useMemo(
    () => result.placeholders.filter((token) => !(values[token] ?? '').trim()),
    [result.placeholders, values]
  )

  const filledBody = useMemo(() => {
    const open = new Set(openTokens)
    return fillText(result.body, values, open)
  }, [result.body, values, openTokens])

  const filledSubject = useMemo(() => {
    const open = new Set(openTokens)
    return fillText(result.subject, values, open)
  }, [result.subject, values, openTokens])

  const handleCopy = (): void => {
    onCopy?.(filledBody)
    setCopied(true)
  }

  const toggleChecked = (idx: number): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/*
        Hinweis - bleibt stehen, ist nicht wegklickbar. Laesst das Modell den
        Abschnitt weg, greift der feste Text aus den Uebersetzungen: der
        Rechtsvorbehalt darf nicht davon abhaengen, ob ein Sprachmodell
        ihn diesmal mitgeschrieben hat.
      */}
      <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/5 p-6">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-amber">
          <AlertTriangle size={14} aria-hidden="true" />
          {t('results.letter.notice')}
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text">
          {result.notice.trim() || t('results.letter.disclaimer')}
        </p>
      </div>

      {/* Platzhalter ausfuellen */}
      {result.placeholders.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <PenLine size={12} aria-hidden="true" />
            {t('results.letter.placeholders')}
          </h3>
          <p className="mb-4 text-xs text-brand-text-dim">{t('results.letter.placeholdersHint')}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.placeholders.map((token, idx) => {
              const fieldId = `${baseId}-ph-${idx}`
              const isOpen = !(values[token] ?? '').trim()
              return (
                <div key={token}>
                  <label
                    htmlFor={fieldId}
                    className="mb-1 block text-xs font-semibold text-brand-text"
                  >
                    {placeholderLabel(token)}
                  </label>
                  <input
                    id={fieldId}
                    type="text"
                    value={values[token] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [token]: e.target.value }))}
                    className={`w-full rounded-xl border bg-brand-dark/80 px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 ${
                      isOpen
                        ? 'border-brand-amber/40 focus:border-brand-cyan/50'
                        : 'border-brand-green/40 focus:border-brand-cyan/50'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          <p
            className={`mt-4 flex items-center gap-2 text-xs font-semibold ${
              openTokens.length > 0 ? 'text-brand-amber' : 'text-brand-green'
            }`}
          >
            {openTokens.length > 0 ? (
              <>
                <AlertTriangle size={12} aria-hidden="true" />
                {t('results.letter.placeholdersLeft', { count: openTokens.length })}
              </>
            ) : (
              <>
                <CheckCircle2 size={12} aria-hidden="true" />
                {t('results.letter.placeholdersDone')}
              </>
            )}
          </p>
        </div>
      )}

      {/* Briefbogen */}
      <div className="rounded-2xl border border-brand-border bg-brand-card p-8 sm:p-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-brand-border pb-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
              {t('results.letter.subject')}
            </p>
            <p className="select-text text-base font-semibold text-brand-text-bright">
              {highlightOpen(filledSubject, openTokens)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            {copied ? (
              <>
                <Check size={12} className="text-brand-green" aria-hidden="true" />
                {t('analysis.copied')}
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden="true" />
                {t('results.letter.copyBody')}
              </>
            )}
          </button>
        </div>

        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('results.letter.body')}
        </p>
        <div className="select-text whitespace-pre-wrap text-sm leading-7 text-brand-text">
          {highlightOpen(filledBody, openTokens)}
        </div>
      </div>

      {/* Noch zu ergaenzen */}
      {result.todos.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <ClipboardList size={12} aria-hidden="true" />
            {t('results.letter.todos')}
          </h3>
          <ul className="space-y-2">
            {result.todos.map((todo, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-cyan" />
                <span className="leading-relaxed">{todo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checkliste vor dem Abschicken */}
      {result.checklist.length > 0 && (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <ListChecks size={12} aria-hidden="true" />
            {t('results.letter.checklist')}
          </h3>
          <p className="mb-3 text-xs text-brand-text-dim">
            {t('results.letter.checklistDone', {
              done: checked.size,
              total: result.checklist.length
            })}
          </p>
          <ul className="space-y-2">
            {result.checklist.map((item, idx) => {
              const itemId = `${baseId}-check-${idx}`
              const isDone = checked.has(idx)
              return (
                <li key={idx}>
                  <div className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-darker/40 p-3">
                    <input
                      id={itemId}
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleChecked(idx)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-cyan"
                    />
                    <label
                      htmlFor={itemId}
                      className={`text-sm leading-relaxed ${
                        isDone ? 'text-brand-text-dim line-through' : 'text-brand-text'
                      }`}
                    >
                      {item}
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Anlaufstellen */}
      {result.help.length > 0 && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            <LifeBuoy size={12} aria-hidden="true" />
            {t('results.letter.help')}
          </h3>
          <ul className="space-y-2">
            {result.help.map((entry, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-text">
                <LifeBuoy
                  size={12}
                  className="mt-1 flex-shrink-0 text-brand-cyan"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
