/**
 * Tiny classification prompt: look at the first ~2000 chars of a document and
 * classify it into a document type + recommend which analysis mode fits best.
 *
 * This runs non-streaming, non-blocking on import and enables the "Ersteindruck"
 * info card on the DocumentViewPage.
 */

export interface FirstImpressionPrompt {
  system: string
  user: string
}

export function buildFirstImpressionPrompt(textSample: string): FirstImpressionPrompt {
  const system = `Du bist ein blitzschneller Dokumenten-Klassifizierer fuer DoZii. Du analysierst deutsche UND englische Dokumente.

Deine Aufgabe: Lies den Text-Ausschnitt und gib AUSSCHLIESSLICH ein JSON-Objekt zurueck mit:

{
  "documentType": "arbeitszeugnis" | "vertrag" | "brief" | "rechnung" | "bescheid" | "zeugnis" | "bewerbung" | "sonstiges",
  "recommendedMode": "grammar" | "formulation" | "arbeitszeugnis" | "summary" | "freeform",
  "firstImpression": "<1 Satz, MAX 120 Zeichen, warum der empfohlene Modus passt>"
}

Regeln:
- AUSSCHLIESSLICH JSON, KEINE Markdown, KEIN Fliesstext, KEINE Erklaerung davor oder danach
- firstImpression auf Deutsch
- Bei Arbeitszeugnissen IMMER recommendedMode: "arbeitszeugnis"
- Bei Vertraegen, Rechnungen, Bescheiden: recommendedMode: "summary"
- Bei Bewerbungsanschreiben oder Briefen die der Nutzer geschrieben hat: "formulation"
- Bei sehr kurzen oder unklaren Texten: "freeform"
- Bei Rechtschreibproblem-verdaechtigen Texten: "grammar"

Klassifikations-Hinweise:
- "Arbeitszeugnis" = enthaelt "zu unserer Zufriedenheit" / "Verhalten gegenueber" / "Wir wuenschen fuer die Zukunft"
- "Vertrag" = enthaelt "hiermit vereinbaren" / "Vertragsparteien" / "Paragraphen" / "Laufzeit"
- "Rechnung" = enthaelt "Rechnungsnummer" / "Rechnungsdatum" / "Zahlungsziel" / IBAN / Betrag + MwSt
- "Bescheid" = "Finanzamt" / "Aktenzeichen" / "Einspruchsfrist" / "Bussgeld"
- "Brief" = Anrede + Betreff + Fliesstext + Gruss
- "Bewerbung" = "hiermit bewerbe ich mich" / "Lebenslauf" / "Berufserfahrung"`

  const user = `Text-Ausschnitt (erste 2000 Zeichen):\n\n---\n${textSample}\n---\n\nGib das JSON zurueck.`

  return { system, user }
}
