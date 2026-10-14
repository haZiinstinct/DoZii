/**
 * Entfernt Denkbloecke aus einer Modellantwort.
 *
 * `think: false` schaltet den Denkmodus bei Ollama ab - aber nur, wenn das
 * Modell die Option kennt. Aeltere Versionen und manche Portierungen
 * schreiben ihren Gedankengang trotzdem in die Antwort, und dann findet die
 * JSON-Auswertung dahinter nichts mehr: qwen3:4b lieferte so bei allen
 * sieben Zeugnissen ein leeres Ergebnis.
 *
 * Ein unabgeschlossener Block wird bis zum Ende weggeschnitten - sonst
 * bleibt der halbe Gedankengang als vermeintliche Antwort stehen.
 */
export function stripThinking(text: string): string {
  const cleaned = text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, '')
    .trim()

  /*
   * Ein schliessendes Tag OHNE oeffnendes. Klingt abwegig, ist aber der
   * Regelfall bei qwen3 unter Ollama: der Denkmodus laesst sich nicht
   * abschalten, Ollama schneidet nur das oeffnende Tag heraus und der
   * Gedankengang bleibt als scheinbar normaler Text davor stehen. Vor der
   * Korrektur war das der Grund, warum qwen3:4b bei ALLEN sieben Zeugnissen
   * nichts Verwertbares lieferte - obwohl es gut 5000 Token dafuer schrieb.
   */
  //
  // Nur wenn das Tag am Zeilenanfang oder -ende steht, so wie Ollama es
  // hinterlaesst. Ein "</think>" mitten im Satz ist Teil der Antwort (etwa
  // eine Erklaerung zu genau diesen Tags) - frueher ging dann alles davor verloren.
  let cut = -1
  for (const m of cleaned.matchAll(ORPHAN_CLOSE_RE)) {
    cut = (m.index ?? 0) + m[0].length
  }
  return cut === -1 ? cleaned : cleaned.slice(cut).trim()
}

/** `</think>` bzw. `</thinking>` allein am Zeilenanfang oder am Zeilenende. */
const ORPHAN_CLOSE_RE =
  /(?:^|\n)[ \t]*<\/think(?:ing)?>|<\/think(?:ing)?>[ \t]*(?=\n|$)/gi
