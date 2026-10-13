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
 * Arbeitsrecht: eine Klage gegen eine Kuendigung des Arbeitgebers geht ans
 * Arbeitsgericht, und dort laufen drei Wochen (§ 4 KSchG) - nicht der Monat
 * der VwGO. Versaeumt ist sie praktisch nicht heilbar.
 */
const ARBEITSRECHT_HINTS = [
  'arbeitsverhaeltnis',
  'arbeitsvertrag',
  'arbeitgeber',
  'arbeitsgericht',
  'kuendigungsschutz',
  'kschg'
]

/** Steht das Dokument im arbeitsrechtlichen Zusammenhang? */
export function isEmploymentContext(hint: string | undefined): boolean {
  return hint ? matches(normalizeHint(hint), ARBEITSRECHT_HINTS) : false
}

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
      /*
       * § 70 Abs. 1 VwGO / § 84 Abs. 1 SGG: ein Monat ab Bekanntgabe.
       *
       * Die Jahresfrist bei fehlender Belehrung (§ 58 Abs. 2 VwGO) bildet
       * DoZii bewusst nicht ab: ob eine Belehrung fehlt, laesst sich am Text
       * nicht sicher erkennen (OCR-Luecke, abgeschnittene Seite) - und ein
       * zu Unrecht versprochenes Jahr kostet den Widerspruch.
       */
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
      if (isEmploymentContext(hint)) {
        return {
          kind,
          periodValue: 3,
          periodUnit: 'week',
          label: 'Kündigungsschutzklage',
          legalBasis: '§ 4 KSchG',
          note: 'Kündigungsschreiben erkannt: Gegen eine Kündigung des Arbeitgebers muss innerhalb von drei Wochen nach Zugang Klage beim Arbeitsgericht erhoben werden. Gerechnet ab dem Datum des Schreibens - maßgeblich ist der Tag, an dem es dir zuging.'
        }
      }
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
