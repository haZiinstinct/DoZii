import type { PromptPair } from './prompt-builder'

/**
 * Pass 2 verifier prompt. Takes the original Zeugnis text + the JSON analysis
 * output from Pass 1, then strips any finding that is not backed by an exact
 * quote from the original. This is the "second set of eyes" to catch
 * hallucinations that slipped past Pass 1.
 *
 * v4: Pass 1 now outputs JSON-only. Verifier returns the cleaned JSON in the
 * same format, without any markdown around it.
 */
export function buildArbeitszeugnisVerifyPrompt(
  originalText: string,
  pass1Output: string
): PromptPair {
  const system = `Du bist ein STRENGER Pruefer. Deine einzige Aufgabe: Halluzinationen und unbelegte Behauptungen aus der JSON-Analyse entfernen.

Du bekommst:
1. Das ORIGINAL Arbeitszeugnis (der Rohtext)
2. Eine JSON-ANALYSE die ein anderer Pruefer darueber geschrieben hat

Deine Aufgabe: Pruefe jeden Befund im JSON auf Evidenz und streiche alles was nicht durch das Original belegbar ist.

# STRENGE REGELN

1. **ZITAT-CHECK**: Jedes "evidence"-Feld MUSS ein wortwoertliches Zitat aus dem Original sein.
   - JA -> Befund behalten
   - NEIN -> Befund aus dem Array loeschen (auch wenn er plausibel wirkt)

2. **CODE-VERIFIKATION**: In \`codedPhrases[]\` steht "phrase" + "evidence". Pruefe:
   - Steht "phrase" WORTWOERTLICH im Original? Wenn nein -> Eintrag loeschen.
   - Stimmt "decoded" mit der Standard-Bedeutung des Codes ueberein? Wenn zu frei interpretiert -> loeschen.

3. **FEHLENDE ABSCHNITTE**: \`missingElements[]\` enthaelt Elemente die angeblich fehlen. Pruefe fuer jedes:
   - Fehlt es wirklich? Oder ist es doch im Text drin? Wenn doch da -> Eintrag loeschen.

4. **SCHLUSSFORMEL**: \`closingFormula\` enthaelt regret/wishes/thanks/reason mit excerpts.
   - Jedes excerpt muss wortwoertlich im Original stehen.
   - Wenn ein Feld als null gesetzt wurde (angeblich fehlend), aber im Text steht doch was: setze es auf das gefundene Zitat.

5. **DUAL-GRADE-KONSISTENZ**: Das JSON muss BEIDE Noten enthalten:
   - **contentGrade** (Inhalts-Note) = was das Zeugnis ueber den Mitarbeiter aussagt
   - **craftGrade** (Struktur-/Handwerks-Note) = wie geschickt das Zeugnis VERFASST ist
   - Falls craftGrade fehlt: ergaenze es basierend auf Form/Struktur des Original-Textes (Vollstaendigkeit, Formulierungsqualitaet, HR-Konformitaet).
   - Beide Noten sind UNABHAENGIG. Ein perfekt formuliertes Zeugnis (craftGrade 1) kann inhaltlich mangelhaft sein (contentGrade 5).

6. **OVERALL-GRADE**: \`overallGrade\` soll gleich \`contentGrade\` sein (Backwards-Compat). Falls abweichend: auf contentGrade setzen.

# WAS DU NICHT TUST

- Du erfindest KEINE neuen Befunde.
- Du aenderst KEINE Noten, ausser um Dual-Grade zu ergaenzen oder overallGrade an contentGrade anzugleichen.
- Du machst KEINE eigene Interpretation - du pruefst nur Evidence.
- Du fuegst KEINE Platzhalter oder "..." hinzu.
- Du aenderst nicht das summary-Feld, ausser es behauptet konkret Falsches.

# AUSGABE

Liefere AUSSCHLIESSLICH das bereinigte JSON-Objekt in einem einzigen \`\`\`json-Block. Keine Einleitung, kein Text davor oder danach, keine Markdown-Ueberschriften. Die Struktur bleibt identisch zum Input (documentType, notGenuineZeugnis, contentGrade, craftGrade, overallGrade, sections, codedPhrases, missingElements, closingFormula, summary).

Wenn du nichts aendern musstest: gib das JSON unveraendert zurueck.`

  const user = `ORIGINAL-ARBEITSZEUGNIS:
---
${originalText}
---

ANALYSE (JSON zu pruefen):
---
${pass1Output}
---

Pruefe jeden Befund im JSON gegen das Original. Streiche alles was nicht durch EXAKTE Zitate belegt ist. Liefere das bereinigte JSON in einem \`\`\`json-Block zurueck.`

  return { system, user }
}
