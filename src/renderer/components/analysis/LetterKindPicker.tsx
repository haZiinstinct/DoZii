import { useId, useState } from 'react'
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CheckCircle2,
  FileX,
  Gavel,
  Loader2,
  Mail,
  PenLine,
  Receipt,
  Scale,
  Sparkles
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LETTER_KINDS, type LetterKind } from '@shared/types'

interface Props {
  suggested?: LetterKind
  notes: string
  onNotesChange: (value: string) => void
  onStart: (kind: LetterKind) => void
  busy?: boolean
}

/** Harte Obergrenze fuer die Notizen - laengere Texte verwaessern den Prompt. */
const NOTES_MAX = 2000

// Jede Briefart bekommt ein eigenes Icon: Farbe allein traegt keine Information,
// und die Karten sind so auch ohne Lesen der Beschreibung unterscheidbar.
const KIND_ICONS: Record<LetterKind, React.ComponentType<{ size?: number; className?: string }>> = {
  widerspruch: Gavel,
  einspruch: Scale,
  'zeugnis-nachbesserung': Award,
  'mahnung-antwort': Receipt,
  kuendigung: FileX,
  fristverlaengerung: CalendarClock,
  allgemein: Mail
}

/** Vorgeschlagene Briefart nach oben, Rest in der Reihenfolge aus LETTER_KINDS. */
function orderKinds(suggested?: LetterKind): LetterKind[] {
  if (!suggested) return [...LETTER_KINDS]
  return [suggested, ...LETTER_KINDS.filter((kind) => kind !== suggested)]
}

export function LetterKindPicker({
  suggested,
  notes,
  onNotesChange,
  onStart,
  busy
}: Props): React.ReactElement {
  const { t } = useTranslation()
  // Vorauswahl bleibt der Vorschlag, bis der Nutzer selbst etwas anklickt -
  // so greift auch ein Vorschlag, der erst nach dem ersten Rendern eintrifft.
  const [picked, setPicked] = useState<LetterKind | null>(null)
  const selected = picked ?? suggested ?? null
  const baseId = useId()
  const notesId = `${baseId}-notes`
  const countId = `${baseId}-notes-count`

  const kinds = orderKinds(suggested)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-text-bright">
          <PenLine size={18} className="text-brand-cyan" aria-hidden="true" />
          {t('results.letter.chooseKind')}
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {kinds.map((kind) => {
            const Icon = KIND_ICONS[kind]
            const isSelected = selected === kind
            const isSuggested = suggested === kind
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => setPicked(kind)}
                  aria-pressed={isSelected}
                  disabled={busy}
                  className={`flex h-full w-full flex-col gap-2 rounded-2xl border p-5 text-start transition-colors disabled:opacity-50 ${
                    isSelected
                      ? 'border-brand-cyan/50 bg-brand-cyan/10'
                      : 'border-brand-border bg-brand-card/40 hover:border-brand-border-hover hover:bg-brand-card-hover/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                        isSelected
                          ? 'bg-brand-cyan/20 text-brand-cyan'
                          : 'bg-brand-darker/60 text-brand-text-dim'
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-brand-text-bright">
                          {t(`results.letter.kinds.${kind}`)}
                        </span>
                        {isSuggested && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-cyan">
                            <Sparkles size={10} aria-hidden="true" />
                            {t('document.modeRecommended')}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-brand-text-dim">
                        {t(`results.letter.kindDesc.${kind}`)}
                      </span>
                    </span>
                    {isSelected && (
                      <CheckCircle2
                        size={18}
                        className="flex-shrink-0 text-brand-cyan"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Notizen */}
      <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
        <label
          htmlFor={notesId}
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-text-dim"
        >
          {t('results.letter.notes')}
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value.slice(0, NOTES_MAX))}
          maxLength={NOTES_MAX}
          rows={4}
          disabled={busy}
          aria-describedby={countId}
          placeholder={t('results.letter.notesPlaceholder')}
          className="w-full resize-y rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
        />
        <p
          id={countId}
          className={`mt-2 text-end text-xs ${
            notes.length >= NOTES_MAX ? 'text-brand-amber' : 'text-brand-text-dim'
          }`}
        >
          {t('results.letter.notesCount', { chars: notes.length, max: NOTES_MAX })}
        </p>
      </div>

      <button
        type="button"
        onClick={() => selected && onStart(selected)}
        disabled={busy || !selected}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan px-6 py-3 text-sm font-semibold text-brand-dark transition-all duration-200 hover:bg-brand-cyan-dim hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <PenLine size={16} aria-hidden="true" />
        )}
        {busy ? t('results.letter.creating') : t('results.letter.create')}
      </button>

      {/* Haftungsausschluss - bewusst am Ende, aber als volle Karte, nicht als Kleingedrucktes. */}
      <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 text-brand-amber" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-brand-text">
            {t('results.letter.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
