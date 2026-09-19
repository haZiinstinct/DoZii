/**
 * Die Zufriedenheitsformel - der einzige Teil eines Arbeitszeugnisses, der
 * sich ohne Modell ausrechnen laesst.
 *
 * Weil ein Zeugnis wohlwollend formuliert sein muss, hat sich eine feste
 * Staffelung eingebuergert. "stets zu unserer vollsten Zufriedenheit" ist
 * eine Eins, "zu unserer Zufriedenheit" eine Vier. Das ist Konvention, keine
 * Ermessensfrage: es haengt an den kleinen Woertern stets, voll und vollst.
 *
 * Warum das hier in Code steht und nicht im Prompt: die Messung hat gezeigt,
 * dass die Modelle die Formel zuverlaessig FINDEN und dann falsch UMRECHNEN.
 * granite4.1:8b zitierte "stets zu unserer vollsten Zufriedenheit" und nannte
 * das Note 4; granite4.1:3b antwortete bei fuenf von sechs Zeugnissen stumpf
 * mit einer Drei. Die Zuordnung Wendung -> Note ist eine Tabelle, und eine
 * Tabelle gehoert nicht in ein Sprachmodell.
 */

export type FormelGrade = 1 | 2 | 3 | 4 | 5 | 6

export interface FormelMatch {
  /** Die Fundstelle im Originalwortlaut - Grundlage fuer "im Text zeigen". */
  text: string
  grade: FormelGrade
  /**
   * `hauptformel` ist die Zufriedenheitsformel, aus der sich die Note direkt
   * ergibt. `verhalten` ist die eigene Staffelung der Verhaltensbeurteilung.
   * `warnung` sind Wendungen, die schlecht sind, aber fuer sich genommen
   * keine Note festlegen - "war bemueht" als Nebensatz etwa.
   */
  kind: 'hauptformel' | 'verhalten' | 'warnung'
  /** Zeichenposition im durchsuchten Text. */
  index: number
}

export interface FormelResult {
  /** Alle gefundenen Wendungen, in Reihenfolge des Auftretens. */
  matches: FormelMatch[]
  /**
   * Note der Hauptformel, falls eindeutig.
   *
   * Das ist NICHT die Gesamtnote des Zeugnisses: versteckte Codes und
   * fehlende Abschnitte ziehen sie weiter herunter. Nach oben ist sie aber
   * eine Grenze - eine Gesamtnote BESSER als die Hauptformel gibt es nicht.
   */
  hauptformelGrade?: FormelGrade
  /** Note der Verhaltensbeurteilung, falls eindeutig. */
  verhaltenGrade?: FormelGrade
  /**
   * Mehrere Hauptformeln mit unterschiedlicher Note. Kommt vor, wenn ein
   * Zeugnis Zwischenzeugnis-Textbausteine mitschleppt. Dann wird nichts
   * ueberschrieben - der Nutzer soll die Widerspruechlichkeit sehen.
   */
  ambiguous: boolean
}

/**
 * Bausteine, aus denen die Muster gebaut werden. Zeugnisse werden aus PDFs
 * gelesen, deshalb darf zwischen den Woertern auch ein Zeilenumbruch stehen.
 */
const WS = '[\\s\\u00a0]+'
/** "unserer", "meiner", "unseren" - je nachdem, wer unterschreibt. */
const POSS = '(?:unser|mein|ihr)[a-zäöü]*'
/** "stets", "immer", "jederzeit", "durchweg" - die Steigerung der Haeufigkeit. */
const ALWAYS = '(?:stets|immer|jederzeit|durchweg|durchgehend)'

function re(body: string): RegExp {
  return new RegExp(body, 'iu')
}

/**
 * Die Muster, vom SPEZIFISCHSTEN zum allgemeinsten. Die Reihenfolge ist
 * tragend: "zu unserer Zufriedenheit" steckt in "stets zu unserer
 * Zufriedenheit" drin. Wird zuerst das kuerzere geprueft, wird aus jeder Drei
 * eine Vier.
 */
interface Pattern {
  re: RegExp
  grade: FormelGrade
  kind: FormelMatch['kind']
}

const PATTERNS: readonly Pattern[] = [
  // ---- Note 6: nur als HAUPTAUSSAGE. "hat sich bemueht, den Anforderungen
  // gerecht zu werden" ist die hoeflichste Art, durchgefallen zu sagen.
  {
    re: re(
      `(?:hat${WS}sich|war)${WS}bem(?:ü|ue)ht,?${WS}(?:den|die|allen|unseren|seinen|ihren)` +
        `[^.]{0,80}?gerecht${WS}zu${WS}werden`
    ),
    grade: 6,
    kind: 'hauptformel'
  },

  // ---- Note 5 - die Einschraenkung steht vor der Formel.
  {
    re: re(
      `(?:im${WS}(?:gro(?:ß|ss)en${WS}und${WS}ganzen|(?:gro(?:ß|ss)en${WS})?wesentlichen)|insgesamt)` +
        `${WS}zu${WS}${POSS}${WS}Zufriedenheit`
    ),
    grade: 5,
    kind: 'hauptformel'
  },

  // ---- Note 1 - hoechste Haeufigkeit plus hoechste Steigerung.
  {
    re: re(`${ALWAYS}${WS}zu${WS}${POSS}${WS}(?:vollsten|allerh(?:ö|oe)chsten)${WS}Zufriedenheit`),
    grade: 1,
    kind: 'hauptformel'
  },

  // ---- Note 2 - entweder die Steigerung ODER die Haeufigkeit.
  {
    re: re(`zu${WS}${POSS}${WS}(?:vollsten|allerh(?:ö|oe)chsten)${WS}Zufriedenheit`),
    grade: 2,
    kind: 'hauptformel'
  },
  {
    re: re(`${ALWAYS}${WS}zu${WS}${POSS}${WS}vollen${WS}Zufriedenheit`),
    grade: 2,
    kind: 'hauptformel'
  },

  // ---- Note 3
  { re: re(`zu${WS}${POSS}${WS}vollen${WS}Zufriedenheit`), grade: 3, kind: 'hauptformel' },
  { re: re(`${ALWAYS}${WS}zu${WS}${POSS}${WS}Zufriedenheit`), grade: 3, kind: 'hauptformel' },

  // ---- Note 4 - die nackte Formel, ohne jede Verstaerkung.
  { re: re(`zu${WS}${POSS}${WS}Zufriedenheit`), grade: 4, kind: 'hauptformel' },

  // ---- Warnsignale ohne eigene Note: sie ziehen die Gesamtnote herunter,
  // legen sie aber nicht fest. Ein "war bemueht" im Nebensatz macht aus einer
  // Fuenf keine Sechs.
  { re: re(`(?:hat${WS}sich|war)${WS}bem(?:ü|ue)ht`), grade: 5, kind: 'warnung' },
  { re: re(`gab${WS}zu${WS}keiner${WS}Klage${WS}Anlass`), grade: 5, kind: 'warnung' },

  // ---- Verhalten: eigene Staffelung, gleiche Logik.
  { re: re(`${ALWAYS}${WS}vorbildlich`), grade: 1, kind: 'verhalten' },
  {
    re: re(`${ALWAYS}${WS}(?:einwandfrei|h(?:ö|oe)flich${WS}und${WS}zuvorkommend)`),
    grade: 2,
    kind: 'verhalten'
  },
  { re: re(`vorbildlich`), grade: 2, kind: 'verhalten' },
  { re: re(`einwandfrei`), grade: 3, kind: 'verhalten' },
  { re: re(`ohne${WS}(?:Tadel|Beanstandung)`), grade: 4, kind: 'verhalten' },
  {
    re: re(`(?:gab|bot)${WS}(?:zu${WS})?keinen${WS}Anlass${WS}zu${WS}Beanstandungen`),
    grade: 4,
    kind: 'verhalten'
  }
]

/**
 * Ein kombiniertes Muster, das den Text EINMAL von links nach rechts liest.
 * So verbraucht der Treffer "stets zu unserer Zufriedenheit" die Stelle und
 * das kuerzere Muster kann nicht mehr darin zuschlagen.
 */
const COMBINED = new RegExp(PATTERNS.map((p) => `(${p.re.source})`).join('|'), 'giu')

export function findZeugnisFormeln(text: string): FormelResult {
  const matches: FormelMatch[] = []
  COMBINED.lastIndex = 0

  for (const m of text.matchAll(COMBINED)) {
    // Welche Alternative hat gegriffen? Die Gruppen stehen in derselben
    // Reihenfolge wie PATTERNS.
    const groupIndex = m.slice(1).findIndex((g) => g !== undefined)
    if (groupIndex < 0) continue
    const pattern = PATTERNS[groupIndex]
    matches.push({
      text: m[0],
      grade: pattern.grade,
      kind: pattern.kind,
      index: m.index ?? 0
    })
  }

  return {
    matches,
    hauptformelGrade: unambiguousGrade(matches, 'hauptformel'),
    verhaltenGrade: unambiguousGrade(matches, 'verhalten'),
    ambiguous: isAmbiguous(matches, 'hauptformel')
  }
}

function gradesOf(matches: FormelMatch[], kind: FormelMatch['kind']): FormelGrade[] {
  return [...new Set(matches.filter((m) => m.kind === kind).map((m) => m.grade))]
}

function unambiguousGrade(
  matches: FormelMatch[],
  kind: FormelMatch['kind']
): FormelGrade | undefined {
  const grades = gradesOf(matches, kind)
  return grades.length === 1 ? grades[0] : undefined
}

function isAmbiguous(matches: FormelMatch[], kind: FormelMatch['kind']): boolean {
  return gradesOf(matches, kind).length > 1
}
