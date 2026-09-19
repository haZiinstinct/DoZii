/**
 * Regelkatalog der gesetzlichen Regelfristen.
 *
 * Warum ein Katalog und kein Modell-Output: Sprachmodelle halluzinieren
 * Fristlaengen genauso bereitwillig wie Daten. Das Modell liefert nur den
 * Anker (Bezugsdatum + Zitat), die Dauer kommt aus dieser Tabelle - oder aus
 * einer im Dokument woertlich genannten Frist.
 *
 * Die Regeln sind Regelfaelle, kein Rechtsrat. Sonderfaelle (Zustellung im
 * Ausland, Wiedereinsetzung, abweichende Vertragsklauseln) bildet DoZii
 * bewusst nicht ab - deshalb bleibt das Zitat aus dem Dokument immer sichtbar.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 */

import type { DeadlineKind, DeadlinePeriodUnit } from './types'

export interface DeadlineRule {
  kind: DeadlineKind
  periodValue: number
  periodUnit: DeadlinePeriodUnit
  /** Kurzbezeichnung fuer die UI. */
  label: string
  /** Fundstelle, wird dem Nutzer angezeigt. */
  legalBasis: string
  /** Zusatzhinweis, wenn die Regel auf einer Annahme beruht. */
  note?: string
}

// --- Stichwoerter zur Unterscheidung der Fallgruppen -------------------------

/** Einspruch gegen einen Steuerbescheid (§ 355 AO) statt Bussgeld (§ 67 OWiG). */
const STEUER_HINTS = [
  'steuerbescheid',
  'finanzamt',
  'einkommensteuer',
  'umsatzsteuer',
  'gewerbesteuer',
  'grundsteuer',
  'steuerfestsetzung',
  'steuernummer',
  'abgabenordnung',
  '355 ao'
]

/** Bussgeld-/Ordnungswidrigkeitenverfahren - der Regelfall beim Einspruch. */
const BUSSGELD_HINTS = [
  'bussgeld',
  'bussgeldbescheid',
  'verwarnungsgeld',
  'ordnungswidrigkeit',
  'owig',
  'anhoerungsbogen',
  'zeugenfragebogen',
  'fahrverbot'
]

/**
 * Fehlende oder falsche Rechtsbehelfsbelehrung: dann laeuft statt der
 * Monatsfrist eine Jahresfrist (§ 58 Abs. 2 VwGO, § 66 Abs. 2 SGG).
 */
const KEINE_BELEHRUNG_HINTS = [
  'ohne rechtsbehelfsbelehrung',
  'keine rechtsbehelfsbelehrung',
  'rechtsbehelfsbelehrung fehlt',
  'fehlende rechtsbehelfsbelehrung',
  'fehlerhafte rechtsbehelfsbelehrung',
  'unrichtige rechtsbehelfsbelehrung',
  'falsche rechtsbehelfsbelehrung'
]

/**
 * Vergleichsform: Kleinschreibung, Umlaute/ss transliteriert, Paragraphen und
 * Satzzeichen zu Leerzeichen. So trifft 'bussgeld' auch "Bußgeldbescheid"
 * und '355 ao' auch "§ 355 AO".
 */
function normalizeHint(hint: string): string {
  return hint
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
}

function matches(normalized: string, needles: readonly string[]): boolean {
  return needles.some((needle) => normalized.includes(needle))
}

/**
 * Uebliche gesetzliche Frist fuer diese Fristart, oder null, wenn es keine
 * gibt (Zahlungs-, Kuendigungs- und Mitwirkungsfristen stehen im Dokument,
 * nicht im Gesetz). `hint` ist Dokumenttext oder ein Stichwort daraus und
 * entscheidet die Fallgruppen (Bussgeld vs. Steuer, Belehrung vorhanden).
 */
export function defaultRuleFor(kind: DeadlineKind, hint?: string): DeadlineRule | null {
  const normalized = hint ? normalizeHint(hint) : ''

  switch (kind) {
    case 'widerspruch':
      // § 70 Abs. 1 VwGO / § 84 Abs. 1 SGG: ein Monat ab Bekanntgabe.
      if (matches(normalized, KEINE_BELEHRUNG_HINTS)) {
        return {
          kind,
          periodValue: 1,
          periodUnit: 'year',
          label: 'Widerspruch (ohne Rechtsbehelfsbelehrung)',
          legalBasis: '§ 58 Abs. 2 VwGO / § 66 Abs. 2 SGG',
          note: 'Ohne oder mit fehlerhafter Rechtsbehelfsbelehrung betraegt die Frist ein Jahr.'
        }
      }
      return {
        kind,
        periodValue: 1,
        periodUnit: 'month',
        label: 'Widerspruch',
        legalBasis: '§ 70 Abs. 1 VwGO / § 84 Abs. 1 SGG'
      }

    case 'einspruch':
      // Zwei Fallgruppen mit unterschiedlicher Dauer.
      if (matches(normalized, STEUER_HINTS) && !matches(normalized, BUSSGELD_HINTS)) {
        return {
          kind,
          periodValue: 1,
          periodUnit: 'month',
          label: 'Einspruch gegen den Steuerbescheid',
          legalBasis: '§ 355 Abs. 1 AO'
        }
      }
      // Default ist die kuerzere Bussgeldfrist: zu frueh gewarnt ist harmlos,
      // zu spaet gewarnt kostet das Rechtsmittel.
      return {
        kind,
        periodValue: 2,
        periodUnit: 'week',
        label: 'Einspruch gegen den Bussgeldbescheid',
        legalBasis: '§ 67 Abs. 1 OWiG',
        note: matches(normalized, BUSSGELD_HINTS)
          ? undefined
          : 'Angenommen wurde ein Bussgeldbescheid; bei einem Steuerbescheid gilt ein Monat (§ 355 AO).'
      }

    case 'klage':
      return {
        kind,
        periodValue: 1,
        periodUnit: 'month',
        label: 'Klage',
        legalBasis: '§ 74 Abs. 1 VwGO'
      }

    case 'widerruf':
      return {
        kind,
        periodValue: 14,
        periodUnit: 'day',
        label: 'Widerruf',
        legalBasis: '§ 355 Abs. 2 BGB'
      }

    // Kein gesetzlicher Regelwert - die Dauer muss aus dem Dokument kommen.
    case 'zahlung':
    case 'kuendigung':
    case 'mitwirkung':
    case 'sonstige':
      return null

    default:
      return null
  }
}
