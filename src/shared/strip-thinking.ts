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
  return text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, '')
    .trim()
}
