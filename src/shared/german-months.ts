/**
 * Deutsche Monatsnamen - eine Quelle fuer Fristen-Radar, Anker-Parser und
 * Schwaerzung. Vorher gab es drei eigene Tabellen, die auseinanderliefen.
 */

/** Volle Monatsnamen in Kleinschreibung, mit und ohne Umlaut. */
export const MONTHS_FULL: Readonly<Record<string, number>> = {
  januar: 1,
  februar: 2,
  maerz: 3,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12
}

/**
 * Zusaetzlich Abkuerzungen und Varianten ("Jaenner", "Mrz", "Sept") fuer
 * Leser, die Modellausgaben tolerant auswerten. Umlaute gefaltet.
 */
export const MONTHS_LENIENT: Readonly<Record<string, number>> = {
  ...MONTHS_FULL,
  jaenner: 1,
  jan: 1,
  feb: 2,
  marz: 3,
  mrz: 3,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sept: 9,
  sep: 9,
  okt: 10,
  nov: 11,
  dez: 12
}

/** Volle Namen mit grossem Anfangsbuchstaben, als Regex-Alternation. */
export const MONTHS_FULL_CAPITALIZED_PATTERN = Object.keys(MONTHS_FULL)
  .map((name) => name[0].toUpperCase() + name.slice(1))
  .join('|')
