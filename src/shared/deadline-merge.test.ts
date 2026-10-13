import { describe, it, expect } from 'vitest'

import { mergeAnchors } from './deadline-merge'
import type { DeadlineAnchor } from './types'

function anchor(overrides: Partial<DeadlineAnchor>): DeadlineAnchor {
  return {
    kind: 'widerspruch',
    label: 'Widerspruch',
    startDateIso: '2026-03-12',
    startDateQuote: null,
    periodText: 'innerhalb eines Monats',
    periodValue: 1,
    periodUnit: 'month',
    explicitDueDateIso: null,
    quote: 'Widerspruch innerhalb eines Monats',
    confidence: 'medium',
    ...overrides
  }
}

describe('mergeAnchors', () => {
  it('laesst je Fristart den Regel-Anker gewinnen', () => {
    const rule = anchor({ startDateIso: '2026-03-12' })
    const model = anchor({ startDateIso: '2026-03-10' })
    expect(mergeAnchors([rule], [model], '2026-03-20')).toEqual([rule])
  })

  const DOC = 'Geburtsdatum: 05.06.1985\nHagen, 12.03.2026\nWiderspruch innerhalb eines Monats'

  it('nimmt das Modell, wenn der Regel-Anker ein uraltes Datum gegriffen hat', () => {
    const rule = anchor({ startDateIso: '1985-06-05' })
    const model = anchor({ startDateIso: '2026-03-12', startDateQuote: 'Hagen, 12.03.2026' })
    expect(mergeAnchors([rule], [model], '2026-03-20', DOC)).toEqual([model])
  })

  it('glaubt dem Modell-Datum nur, wenn es so im Dokument steht', () => {
    const rule = anchor({ startDateIso: '1985-06-05' })
    const erfunden = anchor({ startDateIso: '2026-03-15', startDateQuote: 'Hagen, 15.03.2026' })
    const falschGelesen = anchor({
      startDateIso: '2026-03-15',
      startDateQuote: 'Hagen, 12.03.2026'
    })
    const ohneZitat = anchor({ startDateIso: '2026-03-12', startDateQuote: null })
    for (const model of [erfunden, falschGelesen, ohneZitat]) {
      expect(mergeAnchors([rule], [model], '2026-03-20', DOC)).toEqual([rule])
    }
  })

  it('nimmt kein Modell-Datum aus der Zukunft', () => {
    const rule = anchor({ startDateIso: '1985-06-05' })
    const model = anchor({ startDateIso: '2026-03-12', startDateQuote: 'Hagen, 12.03.2026' })
    expect(mergeAnchors([rule], [model], '2026-03-01', DOC)).toEqual([rule])
  })

  it('behaelt einen alten Regel-Anker ohne besseren Modell-Anker', () => {
    const rule = anchor({ startDateIso: '1985-06-05' })
    expect(mergeAnchors([rule], [], '2026-03-20')).toEqual([rule])
  })

  it('ergaenzt Fristarten, die nur das Modell gefunden hat', () => {
    const rule = anchor({})
    const zahlung = anchor({ kind: 'zahlung' })
    expect(mergeAnchors([rule], [zahlung], '2026-03-20')).toEqual([rule, zahlung])
  })
})
