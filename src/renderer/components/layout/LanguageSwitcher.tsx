import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@shared/languages'
import { applyLanguageDirection } from '../../hooks/useLanguageDirection'

/**
 * Globus-Dropdown in der Titelleiste: schaltet die UI-Sprache um (alle 9
 * Sprachen mit nativem Namen), persistiert die Wahl und setzt die
 * Schreibrichtung. Schliesst bei Klick ausserhalb und mit Escape.
 */
export function LanguageSwitcher(): React.JSX.Element {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = async (code: LanguageCode): Promise<void> => {
    setOpen(false)
    if (code === i18n.language) return
    await i18n.changeLanguage(code)
    applyLanguageDirection(code)
    try {
      await window.api.settings.update({ language: code })
    } catch {
      /* Persistenz ist best-effort - der Wechsel ist visuell schon erfolgt */
    }
  }

  return (
    <div ref={containerRef} className="titlebar-no-drag relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('settings.language')}
        title={t('settings.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
      >
        <Globe size={15} aria-hidden="true" />
        <span className="text-xs font-medium">{current.nativeName}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('settings.language')}
          className="absolute end-0 top-full z-50 mt-2 max-h-80 w-44 overflow-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-xl"
        >
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = l.code === i18n.language
            return (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(l.code)}
                  dir={l.dir}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-brand-darker ${
                    active ? 'font-medium text-brand-cyan' : 'text-brand-text'
                  }`}
                >
                  <span>{l.nativeName}</span>
                  {active && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
