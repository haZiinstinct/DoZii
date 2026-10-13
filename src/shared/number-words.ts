/**
 * Zahlwoerter, wie sie in Bescheiden und Vertraegen stehen ("binnen vierzehn
 * Tagen", "mit einer Frist von drei Monaten"). Gemeinsam fuer Fristen- und
 * Klausel-Radar - zwei getrennte Tabellen waren auseinandergelaufen.
 */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  ein: 1,
  eine: 1,
  einem: 1,
  einen: 1,
  einer: 1,
  eines: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fuenf: 5,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwoelf: 12,
  zwölf: 12,
  vierzehn: 14,
  fuenfzehn: 15,
  fünfzehn: 15,
  zwanzig: 20,
  einundzwanzig: 21,
  vierundzwanzig: 24,
  dreissig: 30,
  dreißig: 30,
  sechzig: 60,
  neunzig: 90
}

/** Regex-Alternation aller Zahlwoerter, laengste zuerst. */
export const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')

/** Zahlwort (gross/klein egal) oder undefined. */
export function numberWordValue(raw: string): number | undefined {
  return NUMBER_WORDS[raw.toLowerCase()]
}
