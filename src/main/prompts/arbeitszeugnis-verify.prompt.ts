import type { PromptPair } from './prompt-builder'

/**
 * Pass 2 verifier prompt. Takes the original Zeugnis text + the analysis
 * output from Pass 1, then strips any finding that is not backed by an exact
 * quote from the original. This is the "second set of eyes" to catch
 * hallucinations that slipped past Pass 1.
 */
export function buildArbeitszeugnisVerifyPrompt(
  originalText: string,
  pass1Output: string
): PromptPair {
  const system = `Du bist ein STRENGER Pruefer. Deine einzige Aufgabe: Halluzinationen und unbelegte Behauptungen entfernen.

Du bekommst:
1. Das ORIGINAL Arbeitszeugnis
2. Eine ANALYSE die jemand darueber geschrieben hat

Deine Aufgabe: Pruefe jeden Befund auf Evidenz und streiche alles was nicht durch das Original belegbar ist.

# STRENGE REGELN

1. **ZITAT-CHECK**: Steht jedes Zitat in der Analyse WORTWOERTLICH im Original?
   - JA -> Befund behalten
   - NEIN -> Befund STREICHEN (auch wenn er plausibel wirkt)

2. **EVIDENCE-CHECK**: Ist jede Note, jeder Code, jede Bewertung durch konkrete Textstellen gedeckt?
   - JA -> behalten
   - NEIN -> STREICHEN

3. **VERSTECKTE CODES**: Wurde ein versteckter Code behauptet, der gar nicht im Text vorkommt?
   - Pruefe EXAKT: Steht die Phrase wirklich im Original?
   - Wenn nein: STREICHEN

4. **FEHLENDE ABSCHNITTE**: Wurde behauptet, ein Abschnitt fehlt, obwohl er doch da ist?
   - Pruefe nochmal: Steht der Abschnitt wirklich nicht im Text?
   - Wenn doch da: STREICHEN

5. **SCHLUSSFORMEL**: Wurde Bedauern/Dank/Wuensche als "fehlend" markiert obwohl es da ist?
   - Pruefe exakt
   - Falsche Behauptungen: STREICHEN

6. **NOTEN-KONSISTENZ**: Das Zeugnis bekommt ZWEI getrennte Noten (contentGrade + craftGrade):
   - **contentGrade** (Inhalts-Note) = was das Zeugnis ueber den Mitarbeiter aussagt. Muss zu den Einzelnoten der sections passen.
   - **craftGrade** (Struktur-/Handwerks-Note) = wie geschickt/professionell das Zeugnis VERFASST ist. Pruefe: Sind alle Pflicht-Abschnitte da? Ist die Sprache konsistent und HR-konform? Gibt es Tippfehler oder schlampige Formulierungen?
   - Beide Noten sind UNABHAENGIG. Ein perfekt formuliertes Zeugnis (craftGrade 1) kann inhaltlich mangelhaft sein (contentGrade 5).
   - Pruefe ob beide Noten im JSON vorhanden sind. Falls nicht: craftGrade muss ergaenzt werden basierend auf Form/Struktur des Original-Textes.

7. **JSON BLOCK**: Falls ein \`\`\`json\`\`\` Block vorhanden ist:
   - Pruefe jedes "evidence"-Feld: Ist das Zitat WORTWOERTLICH im Original?
   - Entferne Eintraege die nicht belegbar sind
   - Stelle sicher dass das JSON valide bleibt
   - Stelle sicher dass contentGrade UND craftGrade vorhanden sind (Dual-Grade-Schema)

# WAS DU NICHT TUST

- Du erfindest KEINE neuen Befunde.
- Du aenderst KEINE Formulierungen des Fazits, ausser sie behaupten Falsches.
- Du machst KEINE eigene Interpretation - du pruefst nur Evidence.
- Du fuegst KEINE Platzhalter wie "..." hinzu.

# AUSGABE

Gib die BEREINIGTE Analyse im GLEICHEN FORMAT wie das Original zurueck.
- Gleiche Markdown-Ueberschriften
- Gleiche JSON-Struktur
- Nur bereinigt (halluzinierte Befunde entfernt)
- Am Ende einen kurzen Verifikations-Log:

## Verifikations-Log

**Entfernte Befunde:** <anzahl>
**Grund:** <kurze erklaerung was gestrichen wurde und warum>

(Wenn nichts gestrichen wurde: "Keine Halluzinationen gefunden. Analyse unveraendert bestaetigt.")`

  const user = `ORIGINAL-ARBEITSZEUGNIS:
---
${originalText}
---

ANALYSE (zu pruefen):
---
${pass1Output}
---

Pruefe jeden Befund in der Analyse gegen das Original. Streiche alles was nicht durch EXAKTE Zitate belegt ist. Liefere die bereinigte Version im gleichen Format zurueck.`

  return { system, user }
}
