/**
 * Transform raw error messages from Ollama / Node fetch into user-friendly
 * German messages with actionable guidance. Shared by analysis.ipc and chat.ipc.
 */
export function friendlyError(raw: string): string {
  const lower = raw.toLowerCase()

  // Transient network / socket issues (undici / fetch errors)
  if (
    /fetch failed|socket hang up|econnreset|und_err_socket|und_err_closed|network error/i.test(raw)
  ) {
    return (
      'Verbindung zu Ollama abgebrochen. Moegliche Ursachen:\n' +
      '• Modell zu gross fuer verfuegbaren RAM / VRAM\n' +
      '• Ollama-Server ist abgestuerzt oder wurde neugestartet\n' +
      '• Timeout beim Modell-Ladevorgang\n\n' +
      'Versuche es erneut oder waehle in den Einstellungen ein kleineres bzw. staerkeres Modell.'
    )
  }

  // Model missing
  if (/model.+not found|no such model/i.test(raw)) {
    return 'Das ausgewaehlte Modell ist nicht installiert. Bitte in den Einstellungen herunterladen.'
  }

  // Out-of-memory hints from Ollama
  if (lower.includes('out of memory') || lower.includes('cuda error') || lower.includes('oom')) {
    return (
      'Nicht genug Speicher fuer dieses Modell. Schliesse andere Programme oder waehle ' +
      'ein kleineres Modell in den Einstellungen (z.B. llama3.2:3b oder gemma3:1b).'
    )
  }

  // Context length exceeded
  if (lower.includes('context') && (lower.includes('too') || lower.includes('exceed'))) {
    return (
      'Das Dokument ist zu lang fuer das aktuelle Modell. ' +
      'Bitte kuerze das Dokument oder waehle ein Modell mit groesserem Kontextfenster.'
    )
  }

  // Fallback: return the raw message (already localized where possible)
  return raw
}
