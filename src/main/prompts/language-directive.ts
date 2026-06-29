import { englishNameFor } from '@shared/languages'

/**
 * Haengt eine Sprach-Direktive an den (englischen) Basis-Prompt an, damit das
 * Modell den INHALT in der UI-Sprache schreibt, das STRUKTUR-SKELETT aber
 * englisch laesst. Hintergrund: die Ergebnis-Parser (parse-analysis.ts) erkennen
 * Abschnitte an englischen Ueberschriften/Labels (## Overall Assessment,
 * **Error Count:**, Severity: high|medium|low). Lokalisierte Ueberschriften
 * wuerden die Karten-UI brechen (Fallback auf Roh-Markdown).
 *
 * de/en brauchen keine Direktive (eigene, handgepflegte Prompts). Fuer alle
 * anderen Sprachen ist der englische Prompt die Basis + diese Direktive.
 */
export function withLanguageDirective(system: string, language: string): string {
  if (language === 'de' || language === 'en') return system
  const name = englishNameFor(language)
  return `${system}

# OUTPUT LANGUAGE (CRITICAL - OVERRIDES ANY LANGUAGE INSTRUCTION ABOVE)
Write your ENTIRE response in ${name}. Translate all prose into ${name}: categories, quality ratings, explanations, rules, summaries, key points, observations and document-type labels.

KEEP THE STRUCTURE EXACTLY IN ENGLISH as written in the OUTPUT FORMAT above - do NOT translate these:
- the section headers (e.g. "## Overall Assessment", "## Error List", "## Document Type", "## Key Facts", "## Summary", "## Action Items", "## Suggestions", "## Revised Full Version");
- the bold field labels (e.g. "**Error Count:**", "**Quality:**", "**Original:**", "**Correction:**", "**Context:**", "**Rule:**", "**Before:**", "**After:**", "**Why:**", "**Type:**", "**Tone:**");
- the severity / priority keywords: write them as the English words "high", "medium", "low".

Analyze the document in whatever language it is actually written in, but present every explanation in ${name}. Quote the "Original", "Context" and "Before" fields VERBATIM from the source document in its ORIGINAL language - never translate quoted text.`
}
