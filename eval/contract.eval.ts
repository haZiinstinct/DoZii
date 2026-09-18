/* eslint-disable no-console -- Die Scorecard IST das Ergebnis dieses Laufs und gehoert in die Konsole. */
/**
 * Eval: Vertrags-Check.
 *
 * Misst die Ampel. Zwei Fehlerbilder sind gleich schlimm: eine uebersehene
 * rote Klausel kostet den Nutzer Geld, ein rot gefaerbter Standardvertrag
 * macht die Ampel wertlos - deshalb liegt bewusst auch ein fairer Vertrag in
 * den Fixtures.
 *
 * Gebaut wird der echte Prompt (buildContractCheckPrompt, Sprache de) und
 * geparst mit dem echten Parser (parseContractCheck).
 *
 * Start: npx vitest run --config vitest.eval.config.ts eval/contract.eval.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_NUM_CTX } from '../src/main/config/constants'
import { buildContractCheckPrompt } from '../src/main/prompts/contract-check.prompt'
import { isInDocument } from '../src/renderer/lib/parse-analysis'
import { parseContractCheck, type ContractClause } from '../src/renderer/lib/parse-contract'
import { chat, checkEvalPreconditions, EVAL_MODEL, reportSkip } from './lib/ollama'
import { formatScorecard, scoreEvidence } from './lib/score'

/** Der Vertrags-Check soll treu zitieren, nicht formulieren. */
const TEMPERATURE = 0.15

/** Siehe arbeitszeugnis.eval.ts. */
const MIN_EVIDENCE_RATE = 0.5

const RISK_LEVELS = ['low', 'medium', 'high'] as const
type RiskLevel = (typeof RISK_LEVELS)[number]

interface VertragFixture {
  id: string
  title: string
  rationale: string
  text: string
  expect: {
    /**
     * Woertliche Textstellen, die als Klausel auftauchen muessen. Leer =
     * der Vertrag ist fair, es darf keine rote Klausel geben.
     */
    redClauses: string[]
    risk: RiskLevel
  }
}

function loadFixtures(): VertragFixture[] {
  const dir = fileURLToPath(new URL('./fixtures/vertrag/', import.meta.url))
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf-8')) as VertragFixture)
}

/**
 * Alles, was eine Klausel ueber sich sagt - der Abgleich laeuft ueber das
 * Zitat, weil nur das woertlich aus dem Vertrag stammt. Titel und Freitext
 * kommen dazu, damit eine sinngemaess benannte Klausel auch trifft.
 */
function clauseHaystack(clause: ContractClause): string {
  return [clause.title, clause.quote, clause.plain, clause.why].join('\n')
}

/** Distanz zweier Ampelstufen: 0 = Treffer, 1 = eine Stufe daneben. */
function riskDistance(expected: RiskLevel, actual: RiskLevel): number {
  return Math.abs(RISK_LEVELS.indexOf(expected) - RISK_LEVELS.indexOf(actual))
}

const gate = await checkEvalPreconditions()
if (!gate.ready) reportSkip('Vertrags-Eval', gate.reason)
const suite = gate.ready ? describe : describe.skip

suite(`Vertrags-Eval (${EVAL_MODEL})`, () => {
  const fixtures = loadFixtures()
  const rows: Array<Record<string, string | number>> = []
  let expectedClauses = 0
  let foundClauses = 0
  let foundAsRed = 0
  let riskHits = 0
  let quotesTotal = 0
  let quotesVerified = 0

  it.each(fixtures)('$id', async (fixture) => {
    const prompt = buildContractCheckPrompt(fixture.text, 'de')
    const answer = await chat(prompt.system, prompt.user, {
      temperature: TEMPERATURE,
      numCtx: DEFAULT_NUM_CTX
    })

    const result = parseContractCheck(answer.content, fixture.text)
    const clauses = result?.clauses ?? []
    const evidence = scoreEvidence(
      clauses.map((clause) => clause.quote),
      fixture.text
    )

    // Pro erwarteter Klausel: ueberhaupt gefunden, und wenn ja - als rot?
    const hits = fixture.expect.redClauses.map((needle) => {
      const clause = clauses.find((candidate) => isInDocument(needle, clauseHaystack(candidate)))
      return { needle, found: clause !== undefined, red: clause?.severity === 'red' }
    })
    const actualRisk = result?.overallRisk.level ?? null
    const distance = actualRisk === null ? null : riskDistance(fixture.expect.risk, actualRisk)

    rows.push({
      fixture: fixture.id,
      klauseln: clauses.length,
      rot: clauses.filter((clause) => clause.severity === 'red').length,
      erwartet: hits.length,
      gefunden: hits.filter((hit) => hit.found).length,
      als_rot: hits.filter((hit) => hit.red).length,
      risiko_soll: fixture.expect.risk,
      risiko_ist: actualRisk ?? '-',
      belegquote: evidence.rate,
      sek: answer.durationMs / 1000
    })

    expectedClauses += hits.length
    foundClauses += hits.filter((hit) => hit.found).length
    foundAsRed += hits.filter((hit) => hit.red).length
    quotesTotal += evidence.total
    quotesVerified += evidence.verified
    if (distance === 0) riskHits++

    if (!result) {
      throw new Error(
        `parseContractCheck konnte die Antwort nicht lesen. Rohantwort (gekuerzt):\n${answer.content.slice(0, 800)}`
      )
    }

    expect(
      evidence.rate,
      `Klausel-Zitate ohne Beleg im Vertrag: ${evidence.hallucinated.join(' | ')}`
    ).toBeGreaterThanOrEqual(MIN_EVIDENCE_RATE)

    for (const hit of hits) {
      expect(hit.found, `Klausel nicht gefunden: "${hit.needle}"`).toBe(true)
    }

    // Eine Ampelstufe Abweichung ist Geschmackssache, zwei sind ein Fehler:
    // "low" statt "high" heisst, der Nutzer unterschreibt beruhigt.
    expect(
      distance,
      `Gesamtrisiko "${actualRisk}" statt "${fixture.expect.risk}". Begruendung des Modells: ${result.overallRisk.reasoning}`
    ).toBeLessThanOrEqual(1)

    if (fixture.expect.risk === 'high') {
      expect(
        clauses.some((clause) => clause.severity === 'red'),
        'Hochriskanter Vertrag ohne eine einzige rote Klausel'
      ).toBe(true)
    }
    if (fixture.expect.redClauses.length === 0 && fixture.expect.risk === 'low') {
      // Gegenprobe gegen Ueberwarnung: der faire Vertrag darf nicht rot werden.
      expect(
        clauses.filter((clause) => clause.severity === 'red').map((clause) => clause.title),
        'Fairer Vertrag wurde rot bewertet'
      ).toEqual([])
    }
  })

  afterAll(() => {
    if (rows.length === 0) return
    const findRate = expectedClauses === 0 ? 1 : foundClauses / expectedClauses
    const redRate = expectedClauses === 0 ? 1 : foundAsRed / expectedClauses
    const evidenceRate = quotesTotal === 0 ? 1 : quotesVerified / quotesTotal

    console.log(`\n=== Vertrags-Eval - ${EVAL_MODEL} ===\n`)
    console.log(formatScorecard(rows))
    console.log(
      [
        '',
        `Kritische Klauseln gefunden: ${(findRate * 100).toFixed(1)} % (${foundClauses}/${expectedClauses})`,
        `davon als rot eingestuft:    ${(redRate * 100).toFixed(1)} % (${foundAsRed}/${expectedClauses})`,
        `Gesamtrisiko exakt getroffen: ${riskHits}/${rows.length}`,
        `Evidence-Trefferquote:        ${(evidenceRate * 100).toFixed(1)} % (${quotesVerified}/${quotesTotal} Zitate)`,
        `Halluzinationsrate:           ${((1 - evidenceRate) * 100).toFixed(1)} %`,
        ''
      ].join('\n')
    )
  })
})
