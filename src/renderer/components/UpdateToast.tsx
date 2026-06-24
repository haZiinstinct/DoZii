import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UpdateStatus } from '@shared/types'

/**
 * Dezenter Toast unten rechts, sobald ein Update heruntergeladen wurde.
 * Der Nutzer entscheidet: sofort neu starten oder wegklicken
 * (Installation passiert dann beim naechsten Beenden automatisch).
 */
export function UpdateToast() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubscribe = window.api.update.onStatus((s) => {
      setStatus(s)
      if (s.state === 'downloaded') setDismissed(false)
    })
    window.api.update.getState().then(({ status: s }) => setStatus(s))
    return unsubscribe
  }, [])

  if (status.state !== 'downloaded' || dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-brand-cyan/30 bg-brand-card p-4 shadow-xl">
      <Download size={16} className="flex-shrink-0 text-brand-cyan" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-brand-text">
          {t('update.ready', { version: status.version })}
        </p>
        <p className="text-xs text-brand-text-dim">{t('update.readyDesc')}</p>
      </div>
      <button
        onClick={() => window.api.update.install()}
        className="rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-cyan-dim"
      >
        {t('update.restart')}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('update.dismiss')}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-border/40 hover:text-brand-text"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
