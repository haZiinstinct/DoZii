/**
 * Winziger Extraktions-Prompt fuer den Fristen-Radar: das Modell liest nur die
 * ANKER einer Frist (Startdatum, Fristtext, Zitat) aus dem Dokument. Gerechnet
 * wird danach deterministisch in TypeScript - Modelle rechnen mit Datumsangaben
 * notorisch falsch.
 *
 * Laeuft zusaetzlich zur Hauptanalyse und ist deshalb bewusst kurz gehalten
 * (Vorbild: first-impression.prompt) - auch ein 3B-Modell soll in Sekunden
 * antworten.
 *
 * Immer Deutsch: es geht um deutsche Rechtsfristen, und die Ausgabe ist
 * strukturiertes JSON, das der Nutzer nie zu sehen bekommt.
 */

import type { PromptPair } from './prompt-builder'

export function buildDeadlineExtractPrompt(text: string): PromptPair {
  const system = `Du findest Fristen in deutschen Dokumenten (Bescheide, Rechnungen, Vertraege, Mahnungen). Du EXTRAHIERST nur, was dasteht - du RECHNEST NICHT.

Antworte AUSSCHLIESSLICH mit einem \`\`\`json-Block in genau diesem Format:

\`\`\`json
{"anchors":[{"kind":"widerspruch","label":"Widerspruch gegen den Bescheid","startDateIso":"2026-03-15","startDateQuote":"Bescheid vom 15.03.2026","periodText":"innerhalb eines Monats","periodValue":1,"periodUnit":"month","explicitDueDateIso":null,"quote":"Gegen diesen Bescheid koennen Sie innerhalb eines Monats nach Bekanntgabe Widerspruch erheben.","confidence":"high"}]}
\`\`\`

Felder:
- kind: widerspruch | einspruch | klage | zahlung | widerruf | kuendigung | mitwirkung | sonstige
- label: kurze Bezeichnung fuer die Anzeige, max. 60 Zeichen
- startDateIso: Bezugsdatum der Frist (Bescheid-, Rechnungs-, Zustelldatum) als YYYY-MM-DD, sonst null
- startDateQuote: die Textstelle, aus der das Startdatum stammt, sonst null
- periodText: die Fristangabe woertlich, z.B. "innerhalb eines Monats", sonst null
- periodValue + periodUnit (day | week | month | year): dieselbe Frist als Zahl, z.B. 1 + "month"; unklar -> beide null
- explicitDueDateIso: konkretes Enddatum NUR, wenn es woertlich im Dokument steht, sonst null
- quote: woertliches Zitat des Satzes mit der Frist - PFLICHT
- confidence: high (Frist steht klar da) | medium | low

Harte Regeln:
- NICHT RECHNEN. Addiere nichts, schaetze kein Enddatum, leite kein Datum aus einer Frist ab. explicitDueDateIso wird nur woertlich uebernommen, niemals berechnet.
- Ohne woertliches Zitat kein Anker. Lieber KEINE Frist als eine erfundene.
- Nur Fristen, die wirklich im Text stehen. Ergaenze nichts aus allgemeinem Rechtswissen.
- Datumsangaben normalisieren: "15.03.2026" -> "2026-03-15", "15. Maerz 2026" -> "2026-03-15". Unklar oder unvollstaendig -> null.
- Keine Frist im Dokument -> {"anchors":[]}
- Keine Erklaerung, keine Ueberschrift, kein Text ausserhalb des json-Blocks.`

  const user = `Dokument:
---
${text}
---

Fristanker als JSON:`

  return { system, user }
}
