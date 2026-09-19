import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { findZeugnisFormeln } from './zeugnis-formel'

describe('Leistungsformel', () => {
  const cases: Array<[string, number]> = [
    ['Er erledigte die Aufgaben stets zu unserer vollsten Zufriedenheit.', 1],
    ['Sie arbeitete jederzeit zu unserer allerhöchsten Zufriedenheit.', 1],
    ['Er erledigte die Aufgaben zu unserer vollsten Zufriedenheit.', 2],
    ['Sie arbeitete stets zu unserer vollen Zufriedenheit.', 2],
    ['Er erledigte die Aufgaben zu unserer vollen Zufriedenheit.', 3],
    ['Sie arbeitete stets zu unserer Zufriedenheit.', 3],
    ['Er erledigte die Aufgaben zu unserer Zufriedenheit.', 4],
    ['Sie arbeitete im Großen und Ganzen zu unserer Zufriedenheit.', 5],
    ['Er arbeitete insgesamt zu unserer Zufriedenheit.', 5],
    ['Er hat sich bemüht, den Anforderungen gerecht zu werden.', 6]
  ]

  for (const [text, grade] of cases) {
    it(`"${text.slice(0, 48)}..." ist Note ${grade}`, () => {
      expect(findZeugnisFormeln(text).hauptformelGrade).toBe(grade)
    })
  }

  it('laesst sich vom kuerzeren Muster nicht unterbieten', () => {
    // Der Kern: "zu unserer Zufriedenheit" steckt in "stets zu unserer
    // Zufriedenheit". Wird zuerst das kuerzere geprueft, wird jede Drei zur
    // Vier - und zwar lautlos.
    const r = findZeugnisFormeln('Sie arbeitete stets zu unserer Zufriedenheit.')
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0].grade).toBe(3)
  })

  it('erkennt die Formel ueber einen Zeilenumbruch hinweg', () => {
    // So kommt der Text aus einem PDF heraus.
    expect(findZeugnisFormeln('stets zu unserer\nvollsten\tZufriedenheit').hauptformelGrade).toBe(1)
  })

  it('kommt mit ss statt ß zurecht', () => {
    expect(
      findZeugnisFormeln('im Grossen und Ganzen zu unserer Zufriedenheit').hauptformelGrade
    ).toBe(5)
  })

  it('akzeptiert auch den einzelnen Arbeitgeber', () => {
    expect(findZeugnisFormeln('stets zu meiner vollsten Zufriedenheit').hauptformelGrade).toBe(1)
  })

  it('meldet Widerspruch statt sich fuer eine Note zu entscheiden', () => {
    const r = findZeugnisFormeln(
      'Er arbeitete stets zu unserer vollsten Zufriedenheit. ' +
        'Zuvor erledigte er die Arbeiten zu unserer Zufriedenheit.'
    )
    expect(r.ambiguous).toBe(true)
    expect(r.hauptformelGrade).toBeUndefined()
  })

  it('findet in einem Text ohne Formel nichts', () => {
    expect(findZeugnisFormeln('Wir kündigen das Arbeitsverhältnis zum 30. April.')).toMatchObject({
      matches: [],
      ambiguous: false
    })
  })
})

describe('Verhaltensformel', () => {
  it('unterscheidet vorbildlich von stets vorbildlich', () => {
    expect(findZeugnisFormeln('Sein Verhalten war stets vorbildlich.').verhaltenGrade).toBe(1)
    expect(findZeugnisFormeln('Sein Verhalten war vorbildlich.').verhaltenGrade).toBe(2)
    expect(findZeugnisFormeln('Sein Verhalten war einwandfrei.').verhaltenGrade).toBe(3)
    expect(
      findZeugnisFormeln('Sein Verhalten gab keinen Anlass zu Beanstandungen.').verhaltenGrade
    ).toBe(4)
  })
})

/**
 * Der eigentliche Nachweis: dieselben Zeugnisse, an denen die Modelle
 * gescheitert sind. granite4.1:8b machte aus dem Spitzenzeugnis eine Vier,
 * granite4.1:3b antwortete bei fuenf von sechs mit einer Drei.
 */
describe('gegen die Eval-Fixtures', () => {
  const dir = join(__dirname, '..', '..', 'eval', 'fixtures', 'arbeitszeugnis')
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
          id: string
          text: string
          expect: { contentGrade?: number; notGenuineZeugnis?: boolean }
        }
    )

  it('findet ueberhaupt Fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(3)
  })

  /**
   * Die Hauptformel ist eine OBERGRENZE, keine Endnote. Versteckte Codes und
   * fehlende Abschnitte druecken die Gesamtnote weiter nach unten - besser
   * als die Hauptformel wird sie nie. Genau das macht sie brauchbar: sagt ein
   * Modell "Note 1", waehrend im Text "zu unserer Zufriedenheit" steht, ist
   * das Modell widerlegt, nicht das Zeugnis.
   */
  for (const f of fixtures.filter((x) => typeof x.expect.contentGrade === 'number')) {
    it(`${f.id}: Gesamtnote ist nie besser als die Hauptformel`, () => {
      const hf = findZeugnisFormeln(f.text).hauptformelGrade
      if (hf === undefined) return
      expect(f.expect.contentGrade).toBeGreaterThanOrEqual(hf)
    })
  }

  it('az-note1-sehr-gut: Hauptformel ergibt die Eins direkt', () => {
    // granite4.1:8b las hier dieselbe Wendung und nannte sie Note 4.
    const f = fixtures.find((x) => x.id === 'az-note1-sehr-gut')!
    expect(findZeugnisFormeln(f.text).hauptformelGrade).toBe(1)
  })

  it('az-note5-bemueht: Nebensatz "war bemueht" macht daraus keine Sechs', () => {
    const f = fixtures.find((x) => x.id === 'az-note5-bemueht')!
    const r = findZeugnisFormeln(f.text)
    expect(r.hauptformelGrade).toBe(5)
    expect(r.matches.some((m) => m.kind === 'warnung')).toBe(true)
  })

  it('az-codes-versteckt: Hauptformel liest sich gut, die Gesamtnote nicht', () => {
    // Der Fall, den eine reine Formeltabelle NICHT loesen kann - und genau
    // deshalb wird die Note nicht ueberschrieben, sondern gegengeprueft.
    const f = fixtures.find((x) => x.id === 'az-codes-versteckt')!
    expect(findZeugnisFormeln(f.text).hauptformelGrade).toBe(2)
    expect(f.expect.contentGrade).toBe(4)
  })

  for (const f of fixtures.filter((x) => x.expect.notGenuineZeugnis)) {
    it(`${f.id}: im Nicht-Zeugnis steht keine Leistungsformel`, () => {
      expect(findZeugnisFormeln(f.text).hauptformelGrade).toBeUndefined()
    })
  }
})
