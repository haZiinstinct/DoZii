import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Zweistufiger Klick fuer folgenreiche Aktionen (Loeschen): der erste Klick
 * "schaerft" den Knopf fuer ein paar Sekunden, erst der zweite fuehrt aus.
 * Dasselbe Muster wie beim Loeschen von Modellen in den Einstellungen - ein
 * versehentlicher Klick kostete sonst ein Dokument samt Analysen und Fristen.
 */
export function useConfirmClick(timeoutMs = 3000) {
  const [armed, setArmed] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /** true = bestaetigt, jetzt ausfuehren; false = erst geschaerft. */
  const confirmOrArm = useCallback(
    (key: string): boolean => {
      window.clearTimeout(timer.current)
      if (armed === key) {
        setArmed(null)
        return true
      }
      setArmed(key)
      timer.current = window.setTimeout(() => {
        setArmed((current) => (current === key ? null : current))
      }, timeoutMs)
      return false
    },
    [armed, timeoutMs]
  )

  return { armed, confirmOrArm }
}
