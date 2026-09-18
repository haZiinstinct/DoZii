import type { PromptPair } from './prompt-builder'
import { withLanguageDirective } from './language-directive'

/**
 * Map-Reduce fuer lange Dokumente.
 *
 * Passt ein Vertrag oder Bescheid auch mit vergroessertem Kontextfenster nicht
 * in einen Durchgang, wird er abschnittsweise analysiert. Dieser Prompt fuehrt
 * die Teilergebnisse zu EINEM Ergebnis im selben Format zusammen.
 *
 * Die Alternative waere Abschneiden - und genau am Ende eines Vertrags stehen
 * Kuendigungsfristen, Preisanpassung und Gerichtsstand.
 */

const COMMON_RULES = `# HARTE REGELN

1. **KEINE NEUEN FAKTEN**: Du fasst ausschliesslich zusammen, was in den Teilergebnissen
   steht. Nichts ergaenzen, nichts ausschmuecken, nichts "sinnvoll vervollstaendigen".
2. **ZITATE BLEIBEN WOERTLICH**: Uebernimm Zitate exakt so, wie sie in den Teilergebnissen
   stehen. Kuerze sie nicht und formuliere sie nicht um.
3. **DUBLETTEN ZUSAMMENFASSEN**: Derselbe Befund aus zwei Abschnitten wird EIN Befund.
   Bei Widerspruechen zwischen Abschnitten nennst du beide Varianten statt eine zu waehlen.
4. **NICHTS WEGLASSEN**: Jeder inhaltliche Befund aus den Teilergebnissen muss im
   Gesamtergebnis auftauchen - es sei denn, er ist eine exakte Dublette.
5. **FORMAT EXAKT BEIBEHALTEN**: Die Ausgabe hat genau dieselbe Struktur wie ein einzelnes
   Teilergebnis. Kein Vorwort, kein Nachwort, keine Meta-Bemerkung ueber die Abschnitte.`

function joinParts(parts: string[]): string {
  return parts
    .map((part, index) => `--- TEILERGEBNIS ${index + 1} von ${parts.length} ---\n${part}`)
    .join('\n\n')
}

/**
 * Reduce fuer Markdown-Modi (Einfach erklaert, Zusammenfassung).
 * `formatReminder` ist der Ausgabeformat-Block des jeweiligen Modus.
 */
export function buildMarkdownReducePrompt(
  parts: string[],
  language: string,
  formatReminder: string
): PromptPair {
  const system = `Du fuehrst Teilanalysen eines einzigen langen Dokuments zu einer einzigen Analyse zusammen.

${COMMON_RULES}

# AUSGABEFORMAT

${formatReminder}`

  const user = `Hier sind die Teilergebnisse desselben Dokuments. Fasse sie zu EINER Analyse im vorgegebenen Format zusammen:\n\n${joinParts(parts)}`

  return { system: withLanguageDirective(system, language), user }
}

/**
 * Reduce fuer JSON-Modi (Vertrags-Check). Die Listenfelder werden vereinigt,
 * die Gesamtbewertung neu gebildet.
 */
export function buildJsonReducePrompt(parts: string[], language: string): PromptPair {
  const system = `Du fuehrst JSON-Teilergebnisse eines einzigen langen Vertrags zu einem JSON zusammen.

${COMMON_RULES}

# ZUSAMMENFUEHRUNG IM DETAIL

- \`clauses\`, \`keyTerms\`, \`parties\`, \`missingClauses\`: Listen vereinigen, Dubletten
  entfernen (gleiche Klausel = gleiches Zitat oder gleicher Titel).
- \`missingClauses\`: Ein Element gilt nur dann als fehlend, wenn es in KEINEM Teilergebnis
  vorhanden war. Taucht es in einem Abschnitt als \`clause\` auf, wird es aus
  \`missingClauses\` gestrichen - der Abschnitt hatte es schlicht nicht gesehen.
- \`overallRisk\`: aus der Gesamtheit neu bestimmen. Die hoechste Einzelstufe gewinnt
  (eine rote Klausel irgendwo im Vertrag macht den ganzen Vertrag riskant).
- \`notAContract\`: nur \`true\`, wenn ALLE Teilergebnisse das sagen.
- \`documentType\`: der am haeufigsten genannte Wert.
- \`summary\`: neu schreiben, bezogen auf den gesamten Vertrag.

# AUSGABE

Antworte AUSSCHLIESSLICH mit einem einzigen \`\`\`json-Block im exakt selben Schema wie die
Teilergebnisse. Kein Text davor oder danach.`

  const user = `Teilergebnisse desselben Vertrags:\n\n${joinParts(parts)}`

  return { system: withLanguageDirective(system, language), user }
}
