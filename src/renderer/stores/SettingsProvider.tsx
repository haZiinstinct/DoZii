import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { logRejection } from '@/lib/log-rejection'

/**
 * Die Einstellungen einmal fuer den ganzen Renderer.
 *
 * Vorher holte sich jede Stelle ihre eigene Kopie (App, useTheme,
 * useAppearance, Analyse-, Upload- und Einstellungsseite). Die Kopien liefen
 * auseinander: useTheme lief zweimal (Layout und Einstellungen), und wer das
 * Design umstellte, aenderte nur eine davon.
 */

interface SettingsContextValue {
  /** null = wird noch geladen. */
  settings: AppSettings | null
  /** Einstellungen nicht lesbar - die App laeuft mit Defaults weiter. */
  loadFailed: boolean
  /**
   * Speichert und uebernimmt, was der Hauptprozess zurueckgibt - der prueft
   * selbst und behaelt bei ungueltigen Werten den alten (siehe M3). Die
   * Oberflaeche zeigt die Aenderung sofort und nimmt sie bei einem Fehler
   * zurueck.
   */
  update: (partial: Partial<AppSettings>) => Promise<AppSettings | null>
  /**
   * Neu laden - fuer Aenderungen, die der Hauptprozess selbst macht
   * (Modell waehlen/loeschen laeuft ueber ollama:*, nicht ueber settings:update).
   */
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.settings
      .get()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded)
      })
      .catch((err) => {
        logRejection('SettingsProvider', 'settings.get')(err)
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((current) => (current ? { ...current, ...partial } : current))
    try {
      const next = await window.api.settings.update(partial)
      setSettings(next)
      return next
    } catch (err) {
      logRejection('SettingsProvider', 'settings.update')(err)
      // Zuruecknehmen: den tatsaechlich gespeicherten Stand neu laden.
      window.api.settings
        .get()
        .then(setSettings)
        .catch(logRejection('SettingsProvider', 'settings.get nach Fehler'))
      return null
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      setSettings(await window.api.settings.get())
    } catch (err) {
      logRejection('SettingsProvider', 'settings.get (reload)')(err)
    }
  }, [])

  const value = useMemo(
    () => ({ settings, loadFailed, update, reload }),
    [settings, loadFailed, update, reload]
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings ausserhalb von SettingsProvider')
  return context
}
