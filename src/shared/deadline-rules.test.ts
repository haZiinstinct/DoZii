import { describe, it, expect } from 'vitest'
import { defaultRuleFor, isEmploymentContext } from './deadline-rules'

describe('defaultRuleFor', () => {
  it('Widerspruch: ein Monat, auch wenn das Dokument eine fehlende Belehrung erwaehnt', () => {
    const rule = defaultRuleFor(
      'widerspruch',
      'Dieser Bescheid ergeht ohne Rechtsbehelfsbelehrung.'
    )
    expect(rule).toMatchObject({ periodValue: 1, periodUnit: 'month' })
  })

  it('Klage im Verwaltungsrecht: ein Monat', () => {
    expect(defaultRuleFor('klage', 'Widerspruchsbescheid der Stadt Hagen')).toMatchObject({
      periodValue: 1,
      periodUnit: 'month',
      legalBasis: '§ 74 Abs. 1 VwGO'
    })
  })

  it('Klage gegen eine Arbeitgeberkuendigung: drei Wochen nach § 4 KSchG', () => {
    const rule = defaultRuleFor('klage', 'hiermit kündigen wir das Arbeitsverhältnis fristgerecht')
    expect(rule).toMatchObject({ periodValue: 3, periodUnit: 'week', legalBasis: '§ 4 KSchG' })
    expect(rule?.note).toContain('Arbeitsgericht')
  })

  it('Kuendigung, Zahlung, Mitwirkung: kein Regelwert', () => {
    expect(defaultRuleFor('kuendigung')).toBeNull()
    expect(defaultRuleFor('zahlung')).toBeNull()
    expect(defaultRuleFor('mitwirkung')).toBeNull()
  })
})

describe('isEmploymentContext', () => {
  it('erkennt Arbeitsrecht auch mit Umlauten', () => {
    expect(isEmploymentContext('Ihr Arbeitsverhältnis')).toBe(true)
    expect(isEmploymentContext('Steuerbescheid 2025')).toBe(false)
    expect(isEmploymentContext(undefined)).toBe(false)
  })
})
