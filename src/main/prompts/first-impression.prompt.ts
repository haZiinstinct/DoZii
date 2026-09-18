/**
 * Tiny classification prompt: look at the first ~800 chars of a document and
 * classify it into a document type + recommend which analysis mode fits best.
 *
 * This runs non-streaming, non-blocking on import and enables the "Ersteindruck"
 * info card on the DocumentViewPage. Kept intentionally minimal so even a
 * 1B model can answer in 2-5 seconds.
 */

import { englishNameFor } from '@shared/languages'

export interface FirstImpressionPrompt {
  system: string
  user: string
}

export function buildFirstImpressionPrompt(
  textSample: string,
  language = 'de'
): FirstImpressionPrompt {
  // Minimal system prompt - we need SPEED, not a treatise on classification.
  // Small models crash on long contexts, so every token counts here.
  // documentType/recommendedMode bleiben feste (englische/deutsche) Schluessel -
  // sie werden in der UI gemappt. Nur der Freitext "firstImpression" folgt der
  // gewaehlten UI-Sprache.
  const langName = englishNameFor(language)
  const system = `Du klassifizierst Dokumente. Antworte NUR mit JSON:

{"documentType":"arbeitszeugnis|vertrag|brief|rechnung|bescheid|bewerbung|sonstiges","recommendedMode":"plain|arbeitszeugnis|contract|summary|formulation|grammar|freeform","firstImpression":"<1 short sentence written in ${langName}, max 120 chars>"}

Regeln:
- Arbeitszeugnis ("zu unserer Zufriedenheit", "Verhalten gegenueber") -> mode: arbeitszeugnis
- Vertrag, AGB, Police, Darlehen, Mietvertrag ("Vertragsparteien", "Laufzeit", "Kuendigungsfrist") -> mode: contract
- Bescheid, Amtspost, Mahnung, Rechnung, Brief einer Behoerde oder Firma -> mode: plain
- Eigener Entwurf, Bewerbung, Anschreiben, das der Nutzer selbst verfasst hat -> mode: formulation
- Unklar -> mode: plain
- Das Feld "firstImpression" MUSS in ${langName} geschrieben sein.
- NUR JSON, keine Erklaerung davor oder danach.`

  const user = `Text:\n${textSample}\n\nJSON:`

  return { system, user }
}
