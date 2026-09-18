import { describe, it, expect } from 'vitest'
import { addPeriod, computeDeadline, daysUntil, shiftToNextWorkingDay } from './deadline-calc'
import type { DeadlineAnchor } from './types'

/** Anker wie ihn das Modell liefert - Felder pro Testfall gezielt ueberschrieben. */
function anchor(partial: Partial<DeadlineAnchor> = {}): DeadlineAnchor {
  return {
    kind: 'widerspruch',
    label: 'Widerspruch gegen den Bescheid',
    startDateIso: null,
    startDateQuote: null,
    periodText: null,
    periodValue: null,
    periodUnit: null,
    explicitDueDateIso: null,
    quote: 'Gegen diesen Bescheid koennen Sie Widerspruch einlegen.',
    confidence: 'high',
    ...partial
  }
}

describe('addPeriod - Monatsfristen (§ 188 Abs. 2, 3 BGB)', () => {
  it('endet am gleichzahligen Tag des Folgemonats', () => {
    expect(addPeriod('2025-03-15', 1, 'month')).toBe('2025-04-15')
  })

  it('kappt auf den letzten Monatstag, wenn die Tageszahl fehlt (31.01. + 1 Monat)', () => {
    expect(addPeriod('2025-01-31', 1, 'month')).toBe('2025-02-28')
  })

  it('kappt im Schaltjahr auf den 29.02.', () => {
    expect(addPeriod('2024-01-31', 1, 'month')).toBe('2024-02-29')
    expect(addPeriod('2024-01-30', 1, 'month')).toBe('2024-02-29')
  })

  it('rechnet ueber den Jahreswechsel', () => {
    expect(addPeriod('2025-12-15', 1, 'month')).toBe('2026-01-15')
    expect(addPeriod('2025-12-31', 2, 'month')).toBe('2026-02-28')
    expect(addPeriod('2025-11-30', 3, 'month')).toBe('2026-02-28')
  })

  it('rechnet Mehrmonatsfristen', () => {
    expect(addPeriod('2025-10-31', 12, 'month')).toBe('2026-10-31')
    expect(addPeriod('2025-08-31', 6, 'month')).toBe('2026-02-28')
  })
})

describe('addPeriod - Tages-, Wochen- und Jahresfristen', () => {
  it('Wochenfrist endet auf demselben Wochentag', () => {
    expect(addPeriod('2025-03-03', 2, 'week')).toBe('2025-03-17') // Montag -> Montag
  })

  it('14-Tage-Frist entspricht zwei Wochen', () => {
    expect(addPeriod('2025-03-03', 14, 'day')).toBe('2025-03-17')
  })

  it('Tagesfrist rechnet ueber den Monatswechsel', () => {
    expect(addPeriod('2025-01-25', 14, 'day')).toBe('2025-02-08')
  })

  it('Jahresfrist kappt den 29.02. auf den 28.02.', () => {
    expect(addPeriod('2024-02-29', 1, 'year')).toBe('2025-02-28')
    expect(addPeriod('2025-03-15', 1, 'year')).toBe('2026-03-15')
  })

  it('wirft bei ungueltigem Startdatum oder krummer Dauer', () => {
    expect(() => addPeriod('2025-02-30', 1, 'month')).toThrow()
    expect(() => addPeriod('2025-03-15', 1.5, 'month')).toThrow()
  })
})

describe('shiftToNextWorkingDay (§ 193 BGB)', () => {
  it('laesst Werktage unveraendert', () => {
    expect(shiftToNextWorkingDay('2025-03-18')).toEqual({ iso: '2025-03-18', shifted: false })
  })

  it('schiebt vom Samstag auf den Montag', () => {
    expect(shiftToNextWorkingDay('2025-03-15')).toEqual({ iso: '2025-03-17', shifted: true })
  })

  it('schiebt vom Ostermontag auf den Dienstag', () => {
    expect(shiftToNextWorkingDay('2025-04-21')).toEqual({ iso: '2025-04-22', shifted: true })
  })

  it('schiebt von Neujahr auf den naechsten Werktag', () => {
    expect(shiftToNextWorkingDay('2026-01-01')).toEqual({ iso: '2026-01-02', shifted: true })
    // Neujahr 2028 faellt auf einen Samstag -> Montag.
    expect(shiftToNextWorkingDay('2028-01-01')).toEqual({ iso: '2028-01-03', shifted: true })
  })

  it('ueberspringt die Weihnachtstage samt Wochenende', () => {
    expect(shiftToNextWorkingDay('2025-12-25')).toEqual({ iso: '2025-12-29', shifted: true })
  })
})

describe('daysUntil', () => {
  it('zaehlt ganze Tage, auch ueber den Jahreswechsel', () => {
    expect(daysUntil('2025-03-20', '2025-03-15')).toBe(5)
    expect(daysUntil('2025-03-15', '2025-03-15')).toBe(0)
    expect(daysUntil('2025-03-10', '2025-03-15')).toBe(-5)
    expect(daysUntil('2026-01-05', '2025-12-29')).toBe(7)
  })
})

describe('computeDeadline - Quellen und Vorrang', () => {
  it('nimmt das explizite Datum aus dem Dokument, nicht die Rechnung', () => {
    const result = computeDeadline({
      anchor: anchor({
        startDateIso: '2025-02-15',
        periodValue: 1,
        periodUnit: 'month',
        explicitDueDateIso: '2025-05-02'
      }),
      todayIso: '2025-03-01'
    })
    expect(result?.source).toBe('explicit')
    expect(result?.dueDateIso).toBe('2025-05-02')
    expect(result?.note).toBeNull()
  })

  it('schiebt auch ein explizites Datum auf den naechsten Werktag', () => {
    const result = computeDeadline({
      anchor: anchor({ explicitDueDateIso: '2025-03-15' }),
      todayIso: '2025-03-01'
    })
    expect(result?.source).toBe('explicit')
    expect(result?.dueDateIso).toBe('2025-03-17')
    expect(result?.note).toContain('§ 193 BGB')
  })

  it('ignoriert ein unsinniges explizites Datum und rechnet aus dem Startdatum', () => {
    const result = computeDeadline({
      anchor: anchor({
        startDateIso: '2025-03-15',
        periodValue: 1,
        periodUnit: 'month',
        explicitDueDateIso: '2025-02-30'
      }),
      todayIso: '2025-03-16'
    })
    expect(result?.source).toBe('computed')
    expect(result?.dueDateIso).toBe('2025-04-15')
  })

  it('gibt null zurueck, wenn weder Startdatum noch Enddatum bekannt sind', () => {
    expect(computeDeadline({ anchor: anchor(), todayIso: '2025-03-01' })).toBeNull()
    expect(
      computeDeadline({ anchor: anchor({ startDateIso: 'unbekannt' }), todayIso: '2025-03-01' })
    ).toBeNull()
  })

  it('gibt null zurueck, wenn es fuer die Fristart keinen gesetzlichen Default gibt', () => {
    for (const kind of ['zahlung', 'kuendigung', 'mitwirkung', 'sonstige'] as const) {
      const result = computeDeadline({
        anchor: anchor({ kind, startDateIso: '2025-03-15' }),
        todayIso: '2025-03-16'
      })
      expect(result).toBeNull()
    }
  })

  it('gibt null zurueck bei ungueltigem todayIso', () => {
    const result = computeDeadline({
      anchor: anchor({ explicitDueDateIso: '2025-05-02' }),
      todayIso: 'heute'
    })
    expect(result).toBeNull()
  })
})

describe('computeDeadline - Regelkatalog', () => {
  it('Widerspruch ohne Dauerangabe: 1 Monat, Fristende Samstag -> Montag', () => {
    const result = computeDeadline({
      anchor: anchor({ startDateIso: '2025-02-15' }),
      todayIso: '2025-02-20'
    })
    expect(result?.source).toBe('computed')
    expect(result?.dueDateIso).toBe('2025-03-17')
    expect(result?.note).toContain('§ 70 Abs. 1 VwGO')
    expect(result?.note).toContain('Samstag')
    expect(result?.note).toContain('Montag, den 17.03.2025')
    // Dauer aus dem Katalog statt aus dem Dokument -> Aussage weniger sicher.
    expect(result?.confidence).toBe('medium')
  })

  it('Widerspruch ohne Rechtsbehelfsbelehrung: Jahresfrist', () => {
    const result = computeDeadline({
      anchor: anchor({ startDateIso: '2025-03-15' }),
      todayIso: '2025-03-20',
      hint: 'Dieser Bescheid ergeht ohne Rechtsbehelfsbelehrung.'
    })
    expect(result?.dueDateIso).toBe('2026-03-16') // 15.03.2026 ist ein Sonntag
    expect(result?.note).toContain('§ 58 Abs. 2 VwGO')
  })

  it('Einspruch gegen Bussgeldbescheid: 2 Wochen (§ 67 OWiG)', () => {
    const result = computeDeadline({
      anchor: anchor({ kind: 'einspruch', startDateIso: '2025-03-03' }),
      todayIso: '2025-03-05',
      hint: 'Bußgeldbescheid wegen einer Ordnungswidrigkeit im Straßenverkehr'
    })
    expect(result?.dueDateIso).toBe('2025-03-17')
    expect(result?.note).toContain('§ 67 Abs. 1 OWiG')
  })

  it('Einspruch gegen Steuerbescheid: 1 Monat (§ 355 AO)', () => {
    const result = computeDeadline({
      anchor: anchor({ kind: 'einspruch', startDateIso: '2025-03-15' }),
      todayIso: '2025-03-20',
      hint: 'Einkommensteuerbescheid des Finanzamts Köln'
    })
    expect(result?.dueDateIso).toBe('2025-04-15')
    expect(result?.note).toContain('§ 355 Abs. 1 AO')
  })

  it('Widerruf: 14 Tage (§ 355 BGB)', () => {
    const result = computeDeadline({
      anchor: anchor({ kind: 'widerruf', startDateIso: '2025-03-03' }),
      todayIso: '2025-03-04'
    })
    expect(result?.dueDateIso).toBe('2025-03-17')
    expect(result?.note).toContain('§ 355 Abs. 2 BGB')
  })

  it('Klage: 1 Monat (§ 74 VwGO), Fristende Ostermontag -> Dienstag', () => {
    const result = computeDeadline({
      anchor: anchor({ kind: 'klage', startDateIso: '2025-03-21' }),
      todayIso: '2025-03-25'
    })
    expect(result?.dueDateIso).toBe('2025-04-22')
    expect(result?.note).toContain('Ostermontag')
  })
})

describe('computeDeadline - Dauer aus dem Dokument', () => {
  it('nutzt die im Dokument genannte Dauer und behaelt die Confidence', () => {
    const result = computeDeadline({
      anchor: anchor({
        kind: 'zahlung',
        label: 'Zahlung der Rechnung',
        startDateIso: '2025-12-15',
        periodText: 'zahlbar innerhalb von 30 Tagen',
        periodValue: 30,
        periodUnit: 'day',
        confidence: 'high'
      }),
      todayIso: '2025-12-16'
    })
    expect(result?.source).toBe('computed')
    expect(result?.dueDateIso).toBe('2026-01-14')
    expect(result?.confidence).toBe('high')
    expect(result?.note).toBeNull()
  })

  it('faellt bei unsinniger Dauer auf den Regelkatalog zurueck', () => {
    const result = computeDeadline({
      anchor: anchor({
        startDateIso: '2025-03-15',
        periodValue: 9999,
        periodUnit: 'day'
      }),
      todayIso: '2025-03-16'
    })
    expect(result?.dueDateIso).toBe('2025-04-15') // 1 Monat statt 9999 Tage
    expect(result?.note).toContain('§ 70 Abs. 1 VwGO')
  })

  it('faellt bei Dauer 0 oder negativer Dauer auf den Regelkatalog zurueck', () => {
    for (const periodValue of [0, -3]) {
      const result = computeDeadline({
        anchor: anchor({ startDateIso: '2025-03-15', periodValue, periodUnit: 'month' }),
        todayIso: '2025-03-16'
      })
      expect(result?.dueDateIso).toBe('2025-04-15')
    }
  })
})

describe('computeDeadline - Restlaufzeit und Dringlichkeit', () => {
  const dueFor = (dueDateIso: string, todayIso: string) =>
    computeDeadline({ anchor: anchor({ explicitDueDateIso: dueDateIso }), todayIso })

  it('meldet abgelaufene Fristen', () => {
    const result = dueFor('2025-03-07', '2025-03-10')
    expect(result?.daysLeft).toBe(-3)
    expect(result?.urgency).toBe('expired')
  })

  it('stuft nach Restlaufzeit ab', () => {
    expect(dueFor('2025-03-10', '2025-03-10')?.urgency).toBe('critical') // 0 Tage
    expect(dueFor('2025-03-13', '2025-03-10')?.urgency).toBe('critical') // 3 Tage
    expect(dueFor('2025-03-14', '2025-03-10')?.urgency).toBe('soon') // 4 Tage
    expect(dueFor('2025-03-20', '2025-03-10')?.urgency).toBe('soon') // 10 Tage
    expect(dueFor('2025-03-21', '2025-03-10')?.urgency).toBe('ok') // 11 Tage
  })

  it('zaehlt die Restlaufzeit ab dem verschobenen Fristende', () => {
    const result = dueFor('2025-03-15', '2025-03-10') // Samstag -> Montag 17.03.
    expect(result?.dueDateIso).toBe('2025-03-17')
    expect(result?.daysLeft).toBe(7)
  })
})
