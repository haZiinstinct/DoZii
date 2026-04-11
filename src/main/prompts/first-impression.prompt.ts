/**
 * Tiny classification prompt: look at the first ~800 chars of a document and
 * classify it into a document type + recommend which analysis mode fits best.
 *
 * This runs non-streaming, non-blocking on import and enables the "Ersteindruck"
 * info card on the DocumentViewPage. Kept intentionally minimal so even a
 * 1B model can answer in 2-5 seconds.
 */

export interface FirstImpressionPrompt {
  system: string
  user: string
}

export function buildFirstImpressionPrompt(textSample: string): FirstImpressionPrompt {
  // Minimal system prompt - we need SPEED, not a treatise on classification.
  // Small models crash on long contexts, so every token counts here.
  const system = `Du klassifizierst deutsche/englische Dokumente. Antworte NUR mit JSON:

{"documentType":"arbeitszeugnis|vertrag|brief|rechnung|bescheid|bewerbung|sonstiges","recommendedMode":"grammar|formulation|arbeitszeugnis|summary|freeform","firstImpression":"<1 Satz Deutsch, max 120 Zeichen>"}

Regeln:
- Arbeitszeugnis ("zu unserer Zufriedenheit", "Verhalten gegenueber") -> mode: arbeitszeugnis
- Vertrag/Rechnung/Bescheid -> mode: summary
- Brief/Bewerbung -> mode: formulation
- Unklar -> mode: freeform
- NUR JSON, keine Erklaerung davor oder danach.`

  const user = `Text:\n${textSample}\n\nJSON:`

  return { system, user }
}
