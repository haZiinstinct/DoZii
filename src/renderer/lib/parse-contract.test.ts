import { describe, it, expect } from 'vitest'
import { parseContractCheck } from './parse-contract'

const DOC = `Mietvertrag ueber Wohnraum.
Die Kaltmiete betraegt 820,00 EUR monatlich.
Der Vertrag verlaengert sich um jeweils zwoelf Monate, sofern nicht drei Monate vor Ablauf gekuendigt wird.
Die Kaution betraegt vier Kaltmieten.`

const FULL_JSON = {
  documentType: 'mietvertrag',
  notAContract: false,
  parties: [
    { role: 'Vermieter', name: 'Immobilien Meier GmbH' },
    { role: 'Mieter', name: 'Anna Beispiel' }
  ],
  keyTerms: [
    { label: 'Kaltmiete', value: '820 EUR', quote: 'Die Kaltmiete betraegt 820,00 EUR monatlich.' }
  ],
  clauses: [
    {
      title: 'Automatische Verlaengerung',
      quote: 'Der Vertrag verlaengert sich um jeweils zwoelf Monate',
      category: 'verlaengerung',
      severity: 'red',
      side: 'mieter',
      plain: 'Der Vertrag laeuft automatisch weiter.',
      why: 'Eine verpasste Frist kostet zwoelf Monatsmieten.',
      typical: 'Verlaengerung auf unbestimmte Zeit.',
      askFor: 'Bitte auf unbestimmte Zeit umstellen.'
    }
  ],
  missingClauses: [
    { element: 'Rueckzahlung der Kaution', importance: 'high', implication: 'Streit beim Auszug.' }
  ],
  overallRisk: { level: 'medium', reasoning: 'Ueberwiegend Standard mit zwei Stolperfallen.' },
  summary: 'Befristeter Wohnraummietvertrag mit einer kritischen Klausel.'
}

function contractMarkdown(json: unknown): string {
  return `## Pruefung\nText davor.\n\n\`\`\`json\n${JSON.stringify(json)}\n\`\`\`\n`
}

describe('parseContractCheck', () => {
  it('parst einen vollstaendigen Vertrags-Check', () => {
    const result = parseContractCheck(contractMarkdown(FULL_JSON), DOC)
    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('mietvertrag')
    expect(result!.notAContract).toBe(false)
    expect(result!.parties).toHaveLength(2)
    expect(result!.parties[0].role).toBe('Vermieter')
    expect(result!.keyTerms[0].value).toBe('820 EUR')
    expect(result!.clauses).toHaveLength(1)
    expect(result!.clauses[0].severity).toBe('red')
    expect(result!.clauses[0].side).toBe('mieter')
    expect(result!.missingClauses[0].importance).toBe('high')
    expect(result!.overallRisk.level).toBe('medium')
    expect(result!.summary).toContain('Wohnraummietvertrag')
  })

  it('liefert null bei fehlendem oder kaputtem JSON', () => {
    expect(parseContractCheck('Nur Prosa, kein JSON.', DOC)).toBeNull()
    expect(parseContractCheck('```json\n{kaputt:\n```', DOC)).toBeNull()
    expect(parseContractCheck('', DOC)).toBeNull()
  })

  it('liefert null bei JSON ohne Vertrags-Schema', () => {
    expect(parseContractCheck('```json\n{"beispiel": true}\n```', DOC)).toBeNull()
    expect(parseContractCheck('```json\n[1,2,3]\n```', DOC)).toBeNull()
  })

  it('ueberspringt Beispiel-JSON und nimmt den gueltigen Block', () => {
    const md = '```json\n{"hinweis":"Beispiel"}\n```\nProsa\n' + contractMarkdown(FULL_JSON)
    const result = parseContractCheck(md, DOC)
    expect(result).not.toBeNull()
    expect(result!.clauses).toHaveLength(1)
  })

  it('parst rohes JSON ohne Codefence', () => {
    const result = parseContractCheck(JSON.stringify(FULL_JSON), DOC)
    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('mietvertrag')
  })

  it('normalisiert deutsche Ampel-Werte', () => {
    const json = {
      ...FULL_JSON,
      clauses: [
        { ...FULL_JSON.clauses[0], severity: 'rot' },
        { ...FULL_JSON.clauses[0], title: 'B', severity: 'gelb' },
        { ...FULL_JSON.clauses[0], title: 'C', severity: 'gruen' },
        { ...FULL_JSON.clauses[0], title: 'D', severity: 'grün' }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.clauses.map((c) => c.severity)).toEqual(['red', 'yellow', 'green', 'green'])
  })

  it('faellt bei unbekannter oder fehlender severity auf yellow zurueck', () => {
    const json = {
      ...FULL_JSON,
      clauses: [
        { ...FULL_JSON.clauses[0], severity: 'kritisch' },
        { title: 'Ohne Severity', quote: 'Die Kaution betraegt vier Kaltmieten.' },
        { ...FULL_JSON.clauses[0], title: 'Zahl', severity: 3 }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.clauses.map((c) => c.severity)).toEqual(['yellow', 'yellow', 'yellow'])
  })

  it('normalisiert importance und faellt auf medium zurueck', () => {
    const json = {
      ...FULL_JSON,
      missingClauses: [
        { element: 'A', importance: 'hoch', implication: '' },
        { element: 'B', importance: 'niedrig', implication: '' },
        { element: 'C', importance: 'unbekannt', implication: '' },
        { element: 'D', implication: '' }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.missingClauses.map((m) => m.importance)).toEqual([
      'high',
      'low',
      'medium',
      'medium'
    ])
  })

  it('normalisiert overallRisk', () => {
    const hoch = { ...FULL_JSON, overallRisk: { level: 'hoch', reasoning: 'Viel rot.' } }
    expect(parseContractCheck(contractMarkdown(hoch), DOC)!.overallRisk.level).toBe('high')
  })

  it('leitet ein fehlendes overallRisk aus den Klauseln ab, statt es zu erfinden', () => {
    // FULL_JSON enthaelt mindestens eine rote Klausel - die bestimmt das
    // Gesamtbild. Ein pauschales "mittel" waere eine Aussage, die niemand
    // getroffen hat, die der Nutzer aber fuer eine Einschaetzung haelt.
    const ohne = { ...FULL_JSON, overallRisk: undefined }
    const result = parseContractCheck(contractMarkdown(ohne), DOC)
    expect(result!.overallRisk).toEqual({ level: 'high', reasoning: '' })
  })

  it('nur gruene Klauseln ergeben ohne Angabe ein niedriges Risiko', () => {
    const nurGruen = {
      ...FULL_JSON,
      overallRisk: undefined,
      clauses: [
        {
          title: 'Kuendigungsfrist',
          quote: 'Der Vertrag kann mit einer Frist von einem Monat gekuendigt werden.',
          category: 'laufzeit',
          severity: 'green',
          side: 'mieter',
          plain: 'Du kannst monatlich kuendigen.',
          why: 'Das ist nutzerfreundlich.'
        }
      ]
    }
    const result = parseContractCheck(contractMarkdown(nurGruen), DOC)
    expect(result!.overallRisk.level).toBe('low')
  })

  it('kommt mit komplett fehlenden Feldern klar', () => {
    const result = parseContractCheck('```json\n{"clauses":[]}\n```', DOC)
    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('sonstiges')
    expect(result!.notAContract).toBe(false)
    expect(result!.parties).toEqual([])
    expect(result!.keyTerms).toEqual([])
    expect(result!.clauses).toEqual([])
    expect(result!.missingClauses).toEqual([])
    expect(result!.summary).toBe('')
    expect(result!.unverifiedCount).toBe(0)
  })

  it('ignoriert Arrays, die in Wahrheit Strings oder Objekte sind', () => {
    const json = {
      ...FULL_JSON,
      parties: 'Vermieter und Mieter',
      keyTerms: { label: 'Kaltmiete' },
      clauses: 'keine'
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result).not.toBeNull()
    expect(result!.parties).toEqual([])
    expect(result!.keyTerms).toEqual([])
    expect(result!.clauses).toEqual([])
  })

  it('akzeptiert missingClauses als reines String-Array', () => {
    const json = { ...FULL_JSON, missingClauses: ['Kuendigungsfrist', '  ', 42] }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.missingClauses).toEqual([
      { element: 'Kuendigungsfrist', importance: 'medium', implication: '' }
    ])
  })

  it('wandelt Zahlen und Booleans in Text um', () => {
    const json = {
      ...FULL_JSON,
      keyTerms: [{ label: 'Kaution', value: 3280, quote: null }],
      clauses: [{ ...FULL_JSON.clauses[0], category: 12, side: true }]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.keyTerms[0].value).toBe('3280')
    expect(result!.clauses[0].category).toBe('12')
    expect(result!.clauses[0].side).toBe('true')
  })

  it('setzt verified pro Klausel und zaehlt unverifizierte', () => {
    const json = {
      ...FULL_JSON,
      clauses: [
        FULL_JSON.clauses[0],
        {
          ...FULL_JSON.clauses[0],
          title: 'Erfundene Klausel',
          quote: 'Der Mieter verzichtet auf jede Minderung.'
        }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.clauses[0].verified).toBe(true)
    expect(result!.clauses[1].verified).toBe(false)
    // Halluzinierte Klauseln werden nicht gefiltert, sondern markiert und gezaehlt
    expect(result!.clauses).toHaveLength(2)
    expect(result!.unverifiedCount).toBe(1)
  })

  it('prueft keyTerms gegen das Zitat, sonst gegen den Wert', () => {
    const json = {
      ...FULL_JSON,
      keyTerms: [
        { label: 'Kaltmiete', value: '820 EUR', quote: 'Die Kaltmiete betraegt 820,00 EUR' },
        { label: 'Kaution', value: 'vier Kaltmieten', quote: null },
        { label: 'Stellplatz', value: '45 EUR', quote: null }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.keyTerms.map((t) => t.verified)).toEqual([true, true, false])
  })

  it('erkennt notAContract auch als String', () => {
    const json = {
      documentType: 'sonstiges',
      notAContract: 'true',
      clauses: [],
      summary: 'Das ist eine Rechnung, kein Vertrag.'
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.notAContract).toBe(true)
    expect(result!.summary).toContain('Rechnung')
  })

  it('verwirft Eintraege ohne jeden Inhalt', () => {
    const json = {
      ...FULL_JSON,
      parties: [{ role: '', name: '' }, { role: 'Mieter' }],
      keyTerms: [{ value: 'ohne Label' }, { label: 'Kaltmiete', value: '820 EUR' }],
      clauses: [{ plain: 'Text ohne Titel und Zitat' }, FULL_JSON.clauses[0]],
      missingClauses: [{ importance: 'high' }]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    expect(result!.parties).toEqual([{ role: 'Mieter', name: '' }])
    expect(result!.keyTerms).toHaveLength(1)
    expect(result!.clauses).toHaveLength(1)
    expect(result!.clauses[0].title).toBe('Automatische Verlaengerung')
    expect(result!.missingClauses).toEqual([])
  })

  it('setzt leere Optionalfelder auf null und category auf sonstiges', () => {
    const json = {
      ...FULL_JSON,
      clauses: [
        {
          title: 'Schriftformklausel',
          quote: 'Die Kaution betraegt vier Kaltmieten.',
          severity: 'yellow',
          side: '   ',
          typical: '',
          askFor: null
        }
      ]
    }
    const result = parseContractCheck(contractMarkdown(json), DOC)
    const clause = result!.clauses[0]
    expect(clause.category).toBe('sonstiges')
    expect(clause.side).toBeNull()
    expect(clause.typical).toBeNull()
    expect(clause.askFor).toBeNull()
    expect(clause.plain).toBe('')
    expect(clause.why).toBe('')
  })
})
