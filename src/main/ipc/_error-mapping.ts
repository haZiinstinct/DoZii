/**
 * Transform raw error messages from Ollama / Node fetch into user-friendly
 * German messages with actionable guidance. Shared by analysis.ipc and chat.ipc.
 */
export function friendlyError(raw: string): string {
  const lower = raw.toLowerCase()

  // Ollama model runner crash (the llama.cpp subprocess died)
  if (
    /model runner.+stopped|model runner.+crashed|model runner.+exit/i.test(raw) ||
    /llama runner process.+exit|llama runner.+stopped/i.test(raw)
  ) {
    return (
      'Das Modell ist beim Laden abgestürzt (Ollama model runner).\n\n' +
      'Das passiert meist wenn:\n' +
      '• Das Modell zu gross für deinen verfügbaren RAM/VRAM ist\n' +
      '• Der Prompt (besonders Arbeitszeugnis-Decoder) zu lang für das Modell ist\n' +
      '• Andere Programme viel Speicher belegen\n\n' +
      'Lösungen:\n' +
      '• Wähle ein kleineres Modell (z.B. qwen2.5:3b für CPU oder qwen2.5:7b für GPU)\n' +
      '• Schliesse andere Programme die RAM/VRAM verbrauchen\n' +
      '• Starte Ollama neu (Einstellungen -> Stoppen -> Starten)'
    )
  }

  // Transient network / socket issues (undici / fetch errors)
  if (
    /fetch failed|socket hang up|econnreset|und_err_socket|und_err_closed|network error/i.test(raw)
  ) {
    return (
      'Verbindung zu Ollama abgebrochen. Mögliche Ursachen:\n' +
      '• Modell zu gross für verfügbaren RAM / VRAM\n' +
      '• Ollama-Server ist abgestürzt oder wurde neugestartet\n' +
      '• Timeout beim Modell-Ladevorgang\n\n' +
      'Versuche es erneut oder wähle in den Einstellungen ein kleineres bzw. stärkeres Modell.'
    )
  }

  // Ollama läuft nicht (Verbindung von vornherein abgelehnt)
  if (/econnrefused|connection refused/i.test(raw)) {
    return (
      'Ollama ist nicht erreichbar. Bitte Ollama starten ' +
      '(Einstellungen -> Ollama starten) und erneut versuchen.'
    )
  }

  // Timeout beim Laden/Antworten
  if (/timed? ?out|deadline exceeded|etimedout/i.test(raw)) {
    return (
      'Zeitüberschreitung bei der Anfrage an Ollama. Das Modell lädt möglicherweise noch ' +
      'oder das System ist ausgelastet. Bitte erneut versuchen oder ein kleineres Modell wählen.'
    )
  }

  // Model missing
  if (/model.+not found|no such model/i.test(raw)) {
    return 'Das ausgewählte Modell ist nicht installiert. Bitte in den Einstellungen herunterladen.'
  }

  // Beschädigte / inkompatible Modell-Dateien
  if (
    /invalid model|unsupported model|quantization|tensor.+mismatch|checkpoint.+failed|unable to load model|error loading model/i.test(
      raw
    )
  ) {
    return (
      'Die Modell-Dateien sind beschädigt oder inkompatibel mit dieser Ollama-Version.\n' +
      'Lösung: Modell in den Einstellungen löschen und neu herunterladen, ggf. Ollama aktualisieren.'
    )
  }

  // Platte voll (z.B. beim Modell-Download oder KV-Cache)
  if (/no space left|enospc|disk.+full/i.test(raw)) {
    return 'Nicht genug freier Speicherplatz auf der Festplatte. Bitte Platz schaffen und erneut versuchen.'
  }

  // Out-of-memory hints from Ollama
  if (lower.includes('out of memory') || lower.includes('cuda error') || lower.includes('oom')) {
    return (
      'Nicht genug Speicher für dieses Modell. Schliesse andere Programme oder wähle ' +
      'ein kleineres Modell in den Einstellungen (z.B. llama3.2:3b oder gemma3:1b).'
    )
  }

  // Context length exceeded
  if (lower.includes('context') && (lower.includes('too') || lower.includes('exceed'))) {
    return (
      'Das Dokument ist zu lang für das aktuelle Modell. ' +
      'Bitte kürze das Dokument oder wähle ein Modell mit größerem Kontextfenster.'
    )
  }

  // Fallback: return the raw message (already localized where possible)
  return raw
}
