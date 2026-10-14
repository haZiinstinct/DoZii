/**
 * Fehlerpfad fuer Promise-Ketten, die keinen eigenen brauchen (Einstellungen
 * laden, Status abfragen): der Fehler landet im Log statt als unbehandelte
 * Rejection. Das Schreiben ins Log faengt seinen eigenen Fehler ab - sonst
 * erzeugt eine abgebaute IPC-Verbindung eine Rejection-Schleife ueber den
 * globalen Handler in main.tsx.
 */
export function logRejection(source: string, what: string): (err: unknown) => void {
  return (err) => {
    window.api.logs
      .write('warn', source, `${what} fehlgeschlagen`, {
        error: err instanceof Error ? err.message : String(err)
      })
      .catch(() => {
        /* Log nicht erreichbar - nichts mehr zu tun */
      })
  }
}
