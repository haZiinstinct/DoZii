import { describe, it, expect } from 'vitest'
import {
  addDays,
  daysInMonth,
  diffDays,
  easterSunday,
  holidayNameFor,
  isNonWorkingDay,
  isValidIsoDate,
  nationwideHolidayNames,
  nationwideHolidays,
  parseIsoDate,
  toIsoDate,
  weekdayOf
} from './german-holidays'

describe('parseIsoDate / isValidIsoDate', () => {
  it('akzeptiert gueltige Kalendertage', () => {
    expect(parseIsoDate('2025-04-20')).toEqual({ year: 2025, month: 4, day: 20 })
    expect(isValidIsoDate('2024-02-29')).toBe(true)
  })

  it('lehnt Formatfehler und nicht existierende Tage ab', () => {
    for (const bad of ['', '2025-4-20', '20.04.2025', '2025-13-01', '2025-02-30', '2023-02-29']) {
      expect(isValidIsoDate(bad)).toBe(false)
    }
  })
})

describe('daysInMonth', () => {
  it('kennt Schaltjahre', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29) // durch 400 teilbar
    expect(daysInMonth(1900, 2)).toBe(28) // durch 100, nicht durch 400
    expect(daysInMonth(2025, 4)).toBe(30)
  })
})

describe('addDays / diffDays', () => {
  it('rechnet ueber Monats- und Jahresgrenzen', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('bleibt bei der Sommerzeitumstellung exakt', () => {
    // 30.03.2025 ist der Umstellungstag - mit lokaler Zeit waeren das 1.96 Tage.
    expect(diffDays('2025-03-29', '2025-03-31')).toBe(2)
    expect(addDays('2025-03-29', 2)).toBe('2025-03-31')
    expect(diffDays('2025-03-15', '2025-03-15')).toBe(0)
    expect(diffDays('2025-03-20', '2025-03-15')).toBe(-5)
  })

  it('wirft bei ungueltigem Datum', () => {
    expect(() => addDays('2025-02-30', 1)).toThrow()
    expect(() => weekdayOf('quatsch')).toThrow()
  })
})

describe('toIsoDate', () => {
  it('fuellt auf zwei Stellen auf', () => {
    expect(toIsoDate(2025, 1, 5)).toBe('2025-01-05')
  })
})

describe('easterSunday', () => {
  // Bekannte Ostersonntage (gregorianisch), inkl. der Extreme 2008 (frueh)
  // und 2038 (spaetestmoeglich, 25.04.).
  const known: Array<[number, string]> = [
    [2000, '2000-04-23'],
    [2008, '2008-03-23'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25']
  ]

  it.each(known)('Ostersonntag %i', (year, iso) => {
    expect(easterSunday(year)).toBe(iso)
  })

  it('faellt immer auf einen Sonntag', () => {
    for (let year = 1990; year <= 2060; year++) {
      expect(weekdayOf(easterSunday(year))).toBe(0)
    }
  })
})

describe('nationwideHolidays', () => {
  it('leitet die beweglichen Feiertage 2025 korrekt ab', () => {
    const names = nationwideHolidayNames(2025)
    expect(names.get('2025-04-18')).toBe('Karfreitag')
    expect(names.get('2025-04-21')).toBe('Ostermontag')
    expect(names.get('2025-05-29')).toBe('Christi Himmelfahrt')
    expect(names.get('2025-06-09')).toBe('Pfingstmontag')
  })

  it('enthaelt die festen Feiertage', () => {
    const days = nationwideHolidays(2026)
    for (const iso of ['2026-01-01', '2026-05-01', '2026-10-03', '2026-12-25', '2026-12-26']) {
      expect(days.has(iso)).toBe(true)
    }
    // Landesfeiertage bewusst nicht enthalten.
    expect(days.has('2026-10-31')).toBe(false) // Reformationstag
    expect(days.has('2026-11-01')).toBe(false) // Allerheiligen
  })

  it('haelt die Wochentage der beweglichen Feiertage ein', () => {
    for (let year = 2020; year <= 2040; year++) {
      const names = nationwideHolidayNames(year)
      const karfreitag = [...names].find(([, name]) => name.includes('Karfreitag'))
      const himmelfahrt = [...names].find(([, name]) => name.includes('Christi Himmelfahrt'))
      expect(karfreitag && weekdayOf(karfreitag[0])).toBe(5) // Freitag
      expect(himmelfahrt && weekdayOf(himmelfahrt[0])).toBe(4) // Donnerstag
    }
  })

  it('fasst zwei Feiertage am selben Tag zusammen (01.05.2008)', () => {
    // Ostern 2008 am 23.03. -> Christi Himmelfahrt faellt auf den Tag der Arbeit.
    expect(nationwideHolidayNames(2008).get('2008-05-01')).toBe(
      'Tag der Arbeit / Christi Himmelfahrt'
    )
    expect(nationwideHolidays(2008).size).toBe(8)
  })

  it('liefert 9 Feiertage im Normaljahr', () => {
    expect(nationwideHolidays(2025).size).toBe(9)
  })
})

describe('holidayNameFor', () => {
  it('benennt Feiertage und ignoriert Werktage', () => {
    expect(holidayNameFor('2025-10-03')).toBe('Tag der Deutschen Einheit')
    expect(holidayNameFor('2025-04-21')).toBe('Ostermontag')
    expect(holidayNameFor('2025-04-22')).toBeNull()
    expect(holidayNameFor('kein-datum')).toBeNull()
  })
})

describe('isNonWorkingDay', () => {
  it('erkennt Wochenenden', () => {
    expect(isNonWorkingDay('2025-06-14')).toBe(true) // Samstag
    expect(isNonWorkingDay('2025-06-15')).toBe(true) // Sonntag
    expect(isNonWorkingDay('2025-06-16')).toBe(false) // Montag
  })

  it('erkennt bundesweite Feiertage an Werktagen', () => {
    expect(isNonWorkingDay('2025-04-21')).toBe(true) // Ostermontag
    expect(isNonWorkingDay('2025-10-03')).toBe(true) // Freitag, Einheit
    expect(isNonWorkingDay('2025-12-25')).toBe(true)
    expect(isNonWorkingDay('2025-12-26')).toBe(true)
    expect(isNonWorkingDay('2025-12-29')).toBe(false)
  })

  it('wirft bei ungueltigem Datum statt still Werktag zu melden', () => {
    expect(() => isNonWorkingDay('2025-02-30')).toThrow()
  })
})
