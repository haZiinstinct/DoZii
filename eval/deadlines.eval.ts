/* eslint-disable no-console -- Die Scorecard IST das Ergebnis dieses Laufs und gehoert in die Konsole. */
/**
 * Eval: Fristen-Radar.
 *
 * Misst die zweite Zahl, die DoZii verspricht: das FRISTENDE. Der Weg ist
 * derselbe wie in der App - Extraktions-Prompt (buildDeadlineExtractPrompt),
 * Validierung (parseDeadlineAnchors) und erst danach die deterministische
 * Berechnung (computeDeadline). Das Modell rechnet nie selbst; gemessen wird
 * also, ob es die richtigen ANKER findet.
 *
 * Start: npx vitest run --config vitest.eval.config.ts eval/deadlines.eval.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_NUM_CTX } from '../src/main/config/constants'
import { buildDeadlineExtractPrompt } from '../src/main/prompts/deadline-extract.prompt'
import { parseDeadlineAnchors } from '../src/main/lib/parse-deadline-anchors'
import { computeDeadline } from '../src/shared/deadline-calc'
import type { DeadlineKind } from '../src/shared/types'
import { chat, checkEvalPreconditions, EVAL_MODEL, reportSkip } from './lib/ollama'
import { formatScorecard, rate, scoreDates, scoreEvidence } from './lib/score'

/** Der Extraktions-Prompt braucht Treue, keine Kreativitaet. */
const TEMPERATURE = 0.1

/**
 * Fester "heute"-Tag, damit der Lauf reproduzierbar bleibt. Auf das Fristende
 * hat er keinen Einfluss - nur auf daysLeft und urgency, die hier niemand misst.
 */
const TODAY_ISO = '2026-01-01'

/** Siehe arbeitszeugnis.eval.ts: tolerant genug fuer Zitier-Schludrigkeit, hart genug fuer Erfindungen. */
const MIN_EVIDENCE_RATE = 0.5

/**
 * Untergrenze fuer die Precision. Eine zusaetzliche Frist pro erwarteter Frist
 * ist noch verzeihlich, alles darueber macht die Fristenliste unbrauchbar.
 */
const MIN_PRECISION = 0.5

interface BescheidFixture {
  id: string
  title: string
  rationale: string
  text: string
  expect: {
    /** Alle erwarteten Fristenden als ISO-Datum. Leer = das Dokument hat keine Frist. */
    deadlines: string[]
    /** Fristart, die mindestens einmal vorkommen muss. null = keine Erwartung. */
    kind: DeadlineKind | null
  }
}

function loadFixtures(): BescheidFixture[] {
  const dir = fileURLToPath(new URL('./fixtures/bescheid/', import.meta.url))
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf-8')) as BescheidFixture)
}

const gate = await checkEvalPreconditions()
if (!gate.ready) reportSkip('Fristen-Eval', gate.reason)
const suite = gate.ready ? describe : describe.skip

suite(`Fristen-Eval (${EVAL_MODEL})`, () => {
  const fixtures = loadFixtures()
  const rows: Array<Record<string, string | number>> = []
  let matchedTotal = 0
  let expectedTotal = 0
  let actualTotal = 0
  let quotesTotal = 0
  let quotesVerified = 0

  it.each(fixtures)('$id', async (fixture) => {
    const prompt = buildDeadlineExtractPrompt(fixture.text)
    const answer = await chat(prompt.system, prompt.user, {
      temperature: TEMPERATURE,
      // Die Fristen-Extraktion ist kein Analyse-Modus: eigener, kurzer
      // Prompt und eine kurze Antwort - 8192 reichen hier wirklich.
      numCtx: DEFAULT_NUM_CTX
    })

    const anchors = parseDeadlineAnchors(answer.content)
    // Der Dokumenttext ist der hint fuer den Regelkatalog (Bussgeld vs. Steuer).
    const computed = anchors
      .map((anchor) => computeDeadline({ anchor, todayIso: TODAY_ISO, hint: fixture.text }))
      .filter((result): result is NonNullable<typeof result> => result !== null)

    const dates = scoreDates(
      fixture.expect.deadlines,
      computed.map((result) => result.dueDateIso)
    )
    const evidence = scoreEvidence(
      anchors.map((anchor) => anchor.quote),
      fixture.text
    )
    const kinds = anchors.map((anchor) => anchor.kind)

    rows.push({
      fixture: fixture.id,
      anker: anchors.length,
      fristen_soll: dates.expected.length,
      fristen_ist: dates.actual.length,
      treffer: dates.matched.length,
      precision: dates.precision,
      recall: dates.recall,
      belegquote: evidence.rate,
      arten: kinds.join(',') || '-',
      sek: answer.durationMs / 1000
    })

    matchedTotal += dates.matched.length
    expectedTotal += dates.expected.length
    actualTotal += dates.actual.length
    quotesTotal += evidence.total
    quotesVerified += evidence.verified

    expect(
      evidence.rate,
      `Fristzitate ohne Beleg im Dokument: ${evidence.hallucinated.join(' | ')}`
    ).toBeGreaterThanOrEqual(MIN_EVIDENCE_RATE)

    if (fixture.expect.deadlines.length === 0) {
      // Der teuerste Fehler der App: eine Frist, die es gar nicht gibt.
      expect(dates.actual, 'Frist erfunden, obwohl das Dokument keine nennt').toEqual([])
      return
    }

    expect(
      dates.missed,
      `Nicht gefundene Fristen. Gefunden wurden: ${dates.actual.join(', ') || 'keine'}`
    ).toEqual([])

    expect(
      dates.precision,
      `Zusaetzlich erfundene Fristen: ${dates.spurious.join(', ')}`
    ).toBeGreaterThanOrEqual(MIN_PRECISION)

    if (fixture.expect.kind) {
      expect(kinds, `Fristart ${fixture.expect.kind} fehlt`).toContain(fixture.expect.kind)
    }
  })

  afterAll(() => {
    if (rows.length === 0) return
    const precision = rate(matchedTotal, actualTotal)
    const recall = rate(matchedTotal, expectedTotal)
    const evidenceRate = rate(quotesVerified, quotesTotal)

    console.log(`\n=== Fristen-Eval - ${EVAL_MODEL} ===\n`)
    console.log(formatScorecard(rows))
    console.log(
      [
        '',
        `Fristen-Precision: ${precision} (${matchedTotal}/${actualTotal} gelieferte Fristen stimmen)`,
        `Fristen-Recall:    ${recall} (${matchedTotal}/${expectedTotal} erwartete Fristen gefunden)`,
        `Evidence-Trefferquote: ${evidenceRate} (${quotesVerified}/${quotesTotal} Zitate)`,
        `Halluzinationsrate:    ${rate(quotesTotal - quotesVerified, quotesTotal)}`,
        ''
      ].join('\n')
    )
  })
})
