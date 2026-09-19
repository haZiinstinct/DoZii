/**
 * Klausel-Radar - die Stolperfallen, die sich ohne Modell finden lassen.
 *
 * Der Vertrags-Prompt fuehrt einen Klausel-Katalog, aber die Messung zeigt,
 * dass die Modelle ihn unzuverlaessig anwenden: granite4.1:3b fand 28,6 % der
 * kritischen Klauseln und stufte das Gesamtrisiko viermal in Folge auf
 * "medium" - auch bei einer Kaution ueber vier Nettokaltmieten. Wer sein
 * Mietverhaeltnis danach beurteilt, bekommt eine Entwarnung, die nicht
 * stimmt.
 *
 * Deshalb werden die schwerwiegendsten Klauseln hier zusaetzlich gesucht.
 * Das Radar ERSETZT die Modellanalyse nicht - es garantiert nur einen Boden,
 * der auf jedem Rechner gleich ist, vom Buero-Laptop bis zum Gaming-PC.
 *
 * Aufgenommen wird eine Regel nur, wenn sie sich am Wortlaut sicher
 * festmachen laesst. Alles, wofuer man den Vertrag verstehen muss, bleibt
 * Sache des Modells: ein Fehlalarm kostet hier mehr als eine Luecke, weil er
 * die echten Funde entwertet.
 */

export type KlauselSeverity = 'red' | 'yellow'

export interface KlauselFinding {
  /** Stabiler Schluessel, zugleich i18n-Schluessel unter `contract.radar.<id>`. */
  id: string
  severity: KlauselSeverity
  /** Die Fundstelle im Originalwortlaut - Grundlage fuer "im Text zeigen". */
  quote: string
  /** Zeichenposition im durchsuchten Text. */
  index: number
  /** Einschlaegige Norm, soweit eindeutig. Wird woertlich angezeigt. */
  law?: string
}

const WS = '[\\s\\u00a0]+'

/** Wortzahlen, wie sie in Vertraegen stehen. */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  ein: 1,
  eine: 1,
  einer: 1,
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
  zwoelf: 12,
  zwölf: 12,
  vierundzwanzig: 24
}

function parseAmount(raw: string): number | undefined {
  const word = NUMBER_WORDS[raw.toLowerCase()]
  if (word !== undefined) return word
  const num = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(num) ? num : undefined
}

const AMOUNT = `(${Object.keys(NUMBER_WORDS).join('|')}|\\d+(?:[.,]\\d+)?)`

/**
 * Liefert den Satz um eine Fundstelle. Ein nackter Treffer wie "vier
 * Nettokaltmieten" ist als Beleg zu duenn - man muss sehen, worauf er sich
 * bezieht.
 */
function sentenceAround(text: string, index: number, length: number): string {
  const before = text.lastIndexOf('.', index)
  const after = text.indexOf('.', index + length)
  const start = before === -1 ? 0 : before + 1
  const end = after === -1 ? text.length : after + 1
  return text.slice(start, end).trim().replace(/\s+/g, ' ')
}

/** Steht die Fundstelle im Umfeld eines der Stichwoerter? */
function nearAny(text: string, index: number, words: string[], radius = 250): boolean {
  const window = text.slice(Math.max(0, index - radius), index + radius).toLowerCase()
  return words.some((w) => window.includes(w.toLowerCase()))
}

interface Rule {
  id: string
  severity: KlauselSeverity
  pattern: RegExp
  law?: string
  /** Zusaetzliche Pruefung; false verwirft den Treffer. */
  accept?: (match: RegExpMatchArray, text: string) => boolean
}

const RULES: readonly Rule[] = [
  {
    // § 551 Abs. 1 BGB: bei Wohnraum hoechstens drei Nettokaltmieten.
    id: 'kautionZuHoch',
    severity: 'red',
    law: '§ 551 Abs. 1 BGB',
    pattern: new RegExp(
      `${AMOUNT}${WS}(?:Netto)?(?:kalt|monats)?mieten`.replace('mieten', 'mieten?'),
      'giu'
    ),
    accept: (m, text) => {
      const amount = parseAmount(m[1])
      if (amount === undefined || amount <= 3) return false
      // Nur im Umfeld einer Sicherheitsleistung - "vier Monatsmieten Rueckstand"
      // ist etwas anderes als eine zu hohe Kaution.
      return nearAny(text, m.index ?? 0, ['kaution', 'sicherheitsleistung', 'mietsicherheit'])
    }
  },
  {
    // Endrenovierung unabhaengig vom Zustand - vom BGH gekippt.
    id: 'endrenovierung',
    severity: 'red',
    law: '§ 307 BGB',
    pattern: new RegExp(
      `(?:vollst(?:ä|ae)ndig${WS}renoviert|Endrenovierung|besenrein${WS}und${WS}renoviert)`,
      'giu'
    ),
    accept: (m, text) =>
      nearAny(text, m.index ?? 0, [
        'auszug',
        'rückgabe',
        'rueckgabe',
        'beendigung',
        'ende des mietverhältnisses'
      ])
  },
  {
    // § 74 Abs. 2 HGB: Wettbewerbsverbot ohne Karenzentschaedigung ist nichtig.
    id: 'wettbewerbOhneKarenz',
    severity: 'red',
    law: '§ 74 Abs. 2 HGB',
    pattern: new RegExp(
      `(?:keine?${WS}Karenzentsch(?:ä|ae)digung|Karenzentsch(?:ä|ae)digung${WS}wird${WS}nicht${WS}gezahlt|ohne${WS}Karenzentsch(?:ä|ae)digung)`,
      'giu'
    )
  },
  {
    // Pauschalabgeltung aller Ueberstunden ist intransparent und unwirksam.
    id: 'ueberstundenPauschal',
    severity: 'red',
    law: '§ 307 Abs. 1 BGB',
    pattern: new RegExp(
      `(?:s(?:ä|ae)mtliche|alle)${WS}(?:geleisteten${WS})?(?:(?:Ü|Ue|ü|ue)berstunden|Mehrarbeit)[^.]{0,120}?abgegolten`,
      'giu'
    )
  },
  {
    // § 309 Nr. 9 BGB: stillschweigende Verlaengerung hoechstens um ein Jahr,
    // und seit 2022 bei Verbrauchervertraegen nur noch auf unbestimmte Zeit
    // mit Monatsfrist (§ 309 Nr. 9 b BGB).
    id: 'verlaengerungZuLang',
    severity: 'red',
    law: '§ 309 Nr. 9 BGB',
    pattern: new RegExp(
      `verl(?:ä|ae)ngert${WS}sich[^.]{0,80}?um${WS}(?:weitere${WS})?${AMOUNT}${WS}(?:Monate|Jahre?)`,
      'giu'
    ),
    accept: (m) => {
      const amount = parseAmount(m[1])
      if (amount === undefined) return false
      // Seit Maerz 2022 darf sich ein Verbrauchervertrag nur noch auf
      // unbestimmte Zeit verlaengern, kuendbar mit Monatsfrist. Eine
      // Verlaengerung um ein volles Jahr ist damit nicht mehr zulaessig -
      // zwoelf Monate sind der Fall, nicht die Grenze.
      const isMonths = /Monate/i.test(m[0])
      return isMonths ? amount >= 12 : amount >= 1
    }
  },
  {
    // § 309 Nr. 13 BGB: strengere Form als Textform ist unwirksam.
    id: 'kuendigungNurSchriftlich',
    severity: 'yellow',
    law: '§ 309 Nr. 13 BGB',
    pattern: new RegExp(
      `(?:nur${WS})?(?:per|mittels|durch)${WS}(?:Einschreiben|eingeschriebenen${WS}Brief)`,
      'giu'
    ),
    accept: (m, text) => nearAny(text, m.index ?? 0, ['kündigung', 'kuendigung', 'widerruf'])
  },
  {
    // § 309 Nr. 7 BGB: Haftung fuer Vorsatz und grobe Fahrlaessigkeit laesst
    // sich in AGB nicht ausschliessen.
    id: 'haftungGrobeFahrlaessigkeit',
    severity: 'red',
    law: '§ 309 Nr. 7 BGB',
    pattern: new RegExp(
      `Haftung[^.]{0,160}?ausgeschlossen[^.]{0,160}?(?:grobe(?:r|n)?${WS}Fahrl(?:ä|ae)ssigkeit|Vorsatz)`,
      'giu'
    )
  },
  {
    // Einseitige Preisaenderung ohne Anlass und ohne Kuendigungsrecht.
    id: 'einseitigePreisaenderung',
    severity: 'yellow',
    law: '§ 307 BGB',
    pattern: new RegExp(
      `(?:Preise|Entgelte|Beitr(?:ä|ae)ge|Geb(?:ü|ue)hren)[^.]{0,120}?jederzeit[^.]{0,80}?(?:(?:ä|ae)ndern|anpassen|erh(?:ö|oe)hen)`,
      'giu'
    )
  }
]

/**
 * Durchsucht einen Vertragstext nach den Klauseln aus dem Katalog.
 * Doppelte Fundstellen derselben Regel werden zusammengefasst - dieselbe
 * Warnung dreimal untereinander hilft niemandem.
 */
export function scanKlauseln(text: string): KlauselFinding[] {
  const findings: KlauselFinding[] = []
  const seen = new Set<string>()

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    for (const m of text.matchAll(rule.pattern)) {
      if (rule.accept && !rule.accept(m, text)) continue
      if (seen.has(rule.id)) break
      seen.add(rule.id)
      findings.push({
        id: rule.id,
        severity: rule.severity,
        quote: sentenceAround(text, m.index ?? 0, m[0].length),
        index: m.index ?? 0,
        law: rule.law
      })
    }
  }

  return findings.sort((a, b) => a.index - b.index)
}

/**
 * Welches Gesamtrisiko der Fund mindestens rechtfertigt.
 *
 * Gemessener Anlass: bei einer Kaution ueber vier Nettokaltmieten meldete das
 * kleine Modell "mittleres Risiko". Eine rote Klausel im Text macht daraus
 * ein hohes - unabhaengig davon, was das Modell geantwortet hat.
 */
export function minimumRisk(findings: KlauselFinding[]): 'high' | 'medium' | undefined {
  if (findings.some((f) => f.severity === 'red')) return 'high'
  if (findings.length > 0) return 'medium'
  return undefined
}
