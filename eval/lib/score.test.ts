import { describe, it, expect } from 'vitest'
import {
  DEFAULT_GRADE_TOLERANCE,
  formatScorecard,
  scoreDates,
  scoreEvidence,
  scoreGrade
} from './score'

const DOC =
  'Herr Muster führte alle ihm übertragenen Aufgaben stets zu unserer vollen Zufriedenheit aus.\n' +
  'Sein Verhalten gegenüber Vorgesetzten, Kollegen und Kunden war stets einwandfrei.'

describe('scoreGrade', () => {
  it('erkennt den Volltreffer', () => {
    expect(scoreGrade(2, 2)).toEqual({
      expected: 2,
      actual: 2,
      deviation: 0,
      withinTolerance: true
    })
  })

  it('rechnet die Abweichung als Betrag, egal in welche Richtung', () => {
    expect(scoreGrade(2, 4).deviation).toBe(2)
    expect(scoreGrade(4, 2).deviation).toBe(2)
  })

  it('laesst eine Note Abweichung als Default-Toleranz durchgehen', () => {
    expect(DEFAULT_GRADE_TOLERANCE).toBe(1)
    expect(scoreGrade(3, 4).withinTolerance).toBe(true)
    expect(scoreGrade(3, 5).withinTolerance).toBe(false)
  })

  it('respektiert eine eigene Toleranz, auch die harte 0', () => {
    expect(scoreGrade(3, 5, 2).withinTolerance).toBe(true)
    expect(scoreGrade(3, 4, 0).withinTolerance).toBe(false)
    expect(scoreGrade(3, 3, 0).withinTolerance).toBe(true)
  })

  it('faellt bei unsinniger Toleranz auf den Default zurueck', () => {
    expect(scoreGrade(3, 5, -4).withinTolerance).toBe(false)
    expect(scoreGrade(3, 4, Number.NaN).withinTolerance).toBe(true)
  })

  it('wertet eine fehlende Note immer als Fehlschlag', () => {
    const score = scoreGrade(2, null, 5)
    expect(score.actual).toBeNull()
    expect(score.deviation).toBeNull()
    expect(score.withinTolerance).toBe(false)
  })
})

describe('scoreEvidence', () => {
  it('erkennt ein woertliches Zitat aus dem Dokument', () => {
    const score = scoreEvidence(['stets zu unserer vollen Zufriedenheit'], DOC)
    expect(score).toEqual({ total: 1, verified: 1, rate: 1, hallucinated: [] })
  })

  it('meldet ein erfundenes Zitat als Halluzination', () => {
    const score = scoreEvidence(['hat sich stets bemüht'], DOC)
    expect(score.verified).toBe(0)
    expect(score.rate).toBe(0)
    expect(score.hallucinated).toEqual(['hat sich stets bemüht'])
  })

  it('rechnet die Trefferquote ueber mehrere Zitate', () => {
    const score = scoreEvidence(
      ['stets zu unserer vollen Zufriedenheit', 'war stets vorbildlich', 'stets einwandfrei'],
      DOC
    )
    expect(score.total).toBe(3)
    expect(score.verified).toBe(2)
    expect(score.rate).toBeCloseTo(2 / 3)
    expect(score.hallucinated).toEqual(['war stets vorbildlich'])
  })

  it('ignoriert Umbrueche und Mehrfach-Leerzeichen wie die App', () => {
    const score = scoreEvidence(['Sein Verhalten   gegenüber\nVorgesetzten'], DOC)
    expect(score.verified).toBe(1)
  })

  it('zaehlt leere Zitate gar nicht erst mit', () => {
    const score = scoreEvidence(['', '   ', 'stets einwandfrei'], DOC)
    expect(score.total).toBe(1)
    expect(score.rate).toBe(1)
  })

  it('wertet gar keine Zitate als Quote 1 - behauptet wurde nichts', () => {
    expect(scoreEvidence([], DOC)).toEqual({
      total: 0,
      verified: 0,
      rate: 1,
      hallucinated: []
    })
  })
})

describe('scoreDates', () => {
  it('trennt Treffer, Fehlende und Erfundene', () => {
    const score = scoreDates(['2026-04-16', '2026-02-19'], ['2026-04-16', '2026-12-24'])
    expect(score.matched).toEqual(['2026-04-16'])
    expect(score.missed).toEqual(['2026-02-19'])
    expect(score.spurious).toEqual(['2026-12-24'])
    expect(score.precision).toBe(0.5)
    expect(score.recall).toBe(0.5)
  })

  it('zaehlt dieselbe Frist nur einmal', () => {
    const score = scoreDates(['2026-04-16'], ['2026-04-16', '2026-04-16', ' 2026-04-16 '])
    expect(score.actual).toEqual(['2026-04-16'])
    expect(score.precision).toBe(1)
    expect(score.recall).toBe(1)
  })

  it('bestraft eine erfundene Frist im Dokument ohne Frist', () => {
    const score = scoreDates([], ['2026-04-16'])
    expect(score.spurious).toEqual(['2026-04-16'])
    expect(score.precision).toBe(0)
    // Nichts zu finden heisst: nichts verpasst.
    expect(score.recall).toBe(1)
  })

  it('wertet "keine Frist erwartet, keine geliefert" als perfekt', () => {
    const score = scoreDates([], [])
    expect(score.precision).toBe(1)
    expect(score.recall).toBe(1)
  })

  it('meldet Recall 0, wenn das Modell gar nichts liefert', () => {
    const score = scoreDates(['2026-04-16'], [])
    expect(score.missed).toEqual(['2026-04-16'])
    expect(score.recall).toBe(0)
    // Nichts behauptet heisst: nichts falsch behauptet.
    expect(score.precision).toBe(1)
  })
})

describe('formatScorecard', () => {
  it('richtet Spalten an der laengsten Zelle aus', () => {
    const table = formatScorecard([
      { fixture: 'az-note2-solide', note: 2 },
      { fixture: 'az-1', note: 5 }
    ])
    const lines = table.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('fixture          note')
    expect(lines[1]).toBe('---------------  ----')
    expect(lines[2]).toBe('az-note2-solide     2')
    expect(lines[3]).toBe('az-1                5')
  })

  it('kuerzt Kommazahlen auf zwei Stellen und laesst ganze Zahlen ganz', () => {
    const table = formatScorecard([{ rate: 2 / 3, total: 12 }])
    expect(table.split('\n')[2]).toBe('0.67     12')
  })

  it('laesst fehlende Werte leer, statt Spalten zu verschieben', () => {
    const table = formatScorecard([{ id: 'a', note: 1 }, { id: 'b' }])
    const lines = table.split('\n')
    expect(lines[3]).toBe('b')
    expect(lines[0]).toBe('id  note')
  })

  it('kommt mit einer leeren Zeilenliste klar', () => {
    expect(formatScorecard([])).toBe('(keine Zeilen)')
    expect(formatScorecard([{}])).toBe('(keine Spalten)')
  })
})
