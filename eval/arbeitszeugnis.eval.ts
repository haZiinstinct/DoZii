/* eslint-disable no-console -- Die Scorecard IST das Ergebnis dieses Laufs und gehoert in die Konsole. */
/**
 * Eval: Arbeitszeugnis-Decoder.
 *
 * Misst, was DoZii verspricht: die NOTE. Gebaut wird der echte Prompt
 * (buildArbeitszeugnisPrompt), geparst mit dem echten Parser der App
 * (parseArbeitszeugnis) - nur das Modell dazwischen ist ein lokales Ollama
 * statt dem Electron-Client.
 *
 * Start: npx vitest run --config vitest.eval.config.ts eval/arbeitszeugnis.eval.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_NUM_CTX } from '../src/main/config/constants'
import { buildArbeitszeugnisPrompt } from '../src/main/prompts/arbeitszeugnis.prompt'
import {
  isInDocument,
  parseArbeitszeugnis,
  type ArbeitszeugnisResult
} from '../src/renderer/lib/parse-analysis'
import { chat, checkEvalPreconditions, EVAL_MODEL, reportSkip } from './lib/ollama'
import {
  DEFAULT_GRADE_TOLERANCE,
  formatScorecard,
  mean,
  rate,
  scoreEvidence,
  scoreGrade
} from './lib/score'

/** Wie prompt-builder.ts den Modus arbeitszeugnis fuehrt (MODE_PARAMS, nicht exportiert). */
const TEMPERATURE = 0.15

/**
 * Untergrenze fuer die Belegquote. Bewusst tolerant: das Eval soll bei einem
 * kaputten Prompt rot werden, nicht bei einem Modell, das eine Umlautschreibung
 * im Zitat verrutscht.
 */
const MIN_EVIDENCE_RATE = 0.5

interface ZeugnisFixture {
  id: string
  title: string
  rationale: string
  text: string
  expect: {
    contentGrade?: number
    craftGrade?: number
    gradeTolerance?: number
    mustFindPhrases?: string[]
    mustNotClaim?: string[]
    /** true = der Text ist gar kein Arbeitszeugnis, dann wird keine Note erwartet. */
    notGenuineZeugnis?: boolean
  }
}

function loadFixtures(): ZeugnisFixture[] {
  const dir = fileURLToPath(new URL('./fixtures/arbeitszeugnis/', import.meta.url))
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf-8')) as ZeugnisFixture)
}

/** Alles, was das Modell als Textstelle aus dem Zeugnis behauptet. */
function collectClaims(result: ArbeitszeugnisResult): string[] {
  const claims: string[] = []
  for (const section of result.sections) {
    const quote = section.evidence ?? section.excerpt
    if (quote) claims.push(quote)
  }
  for (const coded of result.codedPhrases) {
    claims.push(coded.evidence ?? coded.phrase)
  }
  const closing = result.closingFormula
  for (const part of [closing.reason, closing.regret, closing.thanks, closing.wishes]) {
    if (part?.excerpt) claims.push(part.excerpt)
  }
  return claims
}

const gate = await checkEvalPreconditions()
if (!gate.ready) reportSkip('Arbeitszeugnis-Eval', gate.reason)
const suite = gate.ready ? describe : describe.skip

suite(`Arbeitszeugnis-Eval (${EVAL_MODEL})`, () => {
  const fixtures = loadFixtures()
  const rows: Array<Record<string, string | number>> = []
  const deviations: number[] = []
  let toleranceHits = 0
  let gradedCount = 0
  let quotesTotal = 0
  let quotesVerified = 0

  it.each(fixtures)('$id', async (fixture) => {
    const prompt = buildArbeitszeugnisPrompt(fixture.text)
    const answer = await chat(prompt.system, prompt.user, {
      temperature: TEMPERATURE,
      numCtx: DEFAULT_NUM_CTX
    })

    // Zweimal parsen mit Absicht: ohne Dokumenttext sehen wir die ROHEN
    // Behauptungen (fuer die Halluzinationsrate), mit Dokumenttext das, was
    // die App dem Nutzer nach der Evidenz-Filterung tatsaechlich zeigt.
    const raw = parseArbeitszeugnis(answer.content)
    const shown = parseArbeitszeugnis(answer.content, fixture.text)

    const claims = raw ? collectClaims(raw) : []
    const evidence = scoreEvidence(claims, fixture.text)
    const tolerance = fixture.expect.gradeTolerance ?? DEFAULT_GRADE_TOLERANCE
    const expectedContent = fixture.expect.contentGrade
    const expectedCraft = fixture.expect.craftGrade
    const content =
      expectedContent === undefined
        ? null
        : scoreGrade(expectedContent, shown?.contentGrade.grade ?? null, tolerance)
    const craft =
      expectedCraft === undefined
        ? null
        : scoreGrade(expectedCraft, shown?.craftGrade.grade ?? null, tolerance)

    rows.push({
      fixture: fixture.id,
      inhalt_soll: expectedContent ?? '-',
      inhalt_ist: content?.actual ?? '-',
      abw: content?.deviation ?? '-',
      struktur_soll: expectedCraft ?? '-',
      struktur_ist: craft?.actual ?? '-',
      zitate: evidence.total,
      belegt: evidence.verified,
      belegquote: evidence.rate,
      sek: answer.durationMs / 1000
    })

    quotesTotal += evidence.total
    quotesVerified += evidence.verified
    if (content) {
      gradedCount++
      if (content.deviation !== null) deviations.push(content.deviation)
      if (content.withinTolerance) toleranceHits++
    }

    if (!shown) {
      throw new Error(
        `parseArbeitszeugnis konnte die Antwort nicht lesen. Rohantwort (gekuerzt):\n${answer.content.slice(0, 800)}`
      )
    }

    const haystack = claims.join('\n')
    for (const phrase of fixture.expect.mustFindPhrases ?? []) {
      expect(isInDocument(phrase, haystack), `Kein Befund belegt mit: "${phrase}"`).toBe(true)
    }
    for (const phrase of fixture.expect.mustNotClaim ?? []) {
      expect(isInDocument(phrase, haystack), `Erfundener Beleg: "${phrase}"`).toBe(false)
    }

    expect(
      evidence.rate,
      `Nicht belegte Zitate: ${evidence.hallucinated.join(' | ')}`
    ).toBeGreaterThanOrEqual(MIN_EVIDENCE_RATE)

    if (fixture.expect.notGenuineZeugnis) {
      expect(shown.notGenuineZeugnis, 'Kein Zeugnis, wurde aber als eines bewertet').toBe(true)
      return
    }

    if (content) {
      expect(
        content.withinTolerance,
        `Inhalts-Note ${content.actual} statt ${content.expected} (Toleranz ${tolerance}). Begruendung des Modells: ${shown.contentGrade.reasoning}`
      ).toBe(true)
    }
    if (craft) {
      expect(
        craft.withinTolerance,
        `Struktur-Note ${craft.actual} statt ${craft.expected} (Toleranz ${tolerance}). Begruendung des Modells: ${shown.craftGrade.reasoning}`
      ).toBe(true)
    }
  })

  afterAll(() => {
    if (rows.length === 0) return
    const meanDeviation = mean(deviations)
    const evidenceRate = rate(quotesVerified, quotesTotal)

    console.log(`\n=== Arbeitszeugnis-Eval - ${EVAL_MODEL} ===\n`)
    console.log(formatScorecard(rows))
    console.log(
      [
        '',
        `Mittlere Notenabweichung: ${meanDeviation} Noten (${deviations.length} bewertet)`,
        `Innerhalb der Toleranz:   ${toleranceHits}/${gradedCount} bewertete Zeugnisse`,
        `Evidence-Trefferquote:    ${evidenceRate} (${quotesVerified}/${quotesTotal} Zitate)`,
        `Halluzinationsrate:       ${rate(quotesTotal - quotesVerified, quotesTotal)}`,
        ''
      ].join('\n')
    )
  })
})
