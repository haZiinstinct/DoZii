import { useCallback, useEffect, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExportFormat } from '@shared/types'
import { useSettings } from '@/stores/SettingsProvider'

const EXPORT_FORMATS: { format: ExportFormat; labelKey: string }[] = [
  { format: 'pdf', labelKey: 'analysis.exportPdf' },
  { format: 'rtf', labelKey: 'analysis.exportRtf' },
  { format: 'markdown', labelKey: 'analysis.exportMarkdown' },
  { format: 'txt', labelKey: 'analysis.exportTxt' }
]

/**
 * Export-Knopf mit Formatwahl und Schwaerzen-Option. Erfolg und Fehler
 * meldet das Menue nach oben - die Seite zeigt sie bei den anderen Hinweisen.
 */
export function ExportMenu({
  analysisId,
  onStart,
  onDone,
  onError
}: {
  analysisId: string
  onStart: () => void
  onDone: (message: string) => void
  onError: (message: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  // Vorbelegung aus den Einstellungen, bis der Nutzer im Menue umschaltet.
  const [redactOverride, setRedact] = useState<boolean | null>(null)
  const redact = redactOverride ?? settings?.redactOnExport ?? false
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Escape und ein Klick daneben schliessen das Menue - vorher blieb es
  // offen, bis man erneut auf den Knopf klickte.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      onStart()
      setOpen(false)
      const res = await window.api.exporter.analysis({ analysisId, format, redact })
      if (res.ok) {
        const redacted =
          res.redactedCount && res.redactedCount > 0
            ? ` (${t('analysis.redactedCount', { count: res.redactedCount })})`
            : ''
        onDone(t('analysis.exportDone', { path: res.path ?? '' }) + redacted)
        return
      }
      if (!res.cancelled && res.error) {
        window.api.logs
          .write('error', 'ExportMenu', 'Export failed', { format, error: res.error })
          .catch(() => {
            /* Log nicht erreichbar */
          })
        onError(t('analysis.exportError', { error: res.error }))
      }
    },
    [analysisId, redact, t, onStart, onDone, onError]
  )

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        title={t('analysis.exportMenu')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
      >
        <FileDown size={12} aria-hidden="true" />
        {t('analysis.exportMenu')}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 w-64 rounded-xl border border-brand-border bg-brand-card p-2 shadow-xl"
        >
          {EXPORT_FORMATS.map(({ format, labelKey }) => (
            <button
              key={format}
              role="menuitem"
              onClick={() => handleExport(format)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs text-brand-text transition-colors hover:bg-brand-card-hover"
            >
              {t(labelKey)}
            </button>
          ))}
          <label className="mt-1 flex cursor-pointer items-start gap-2 border-t border-brand-border px-3 pb-1 pt-2 text-xs text-brand-text-dim">
            <input
              type="checkbox"
              checked={redact}
              onChange={(e) => setRedact(e.target.checked)}
              className="mt-0.5 accent-[color:var(--color-brand-cyan)]"
            />
            <span>
              {t('analysis.redactBeforeExport')}
              <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                {t('analysis.redactBeforeExportHint')}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
