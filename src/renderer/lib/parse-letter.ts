/**
 * Parser fuer den Antwort-Generator (Modus 'letter'). Zerlegt das Markdown aus
 * letter.prompt.ts in die sechs Abschnitte und zieht die Platzhalter aus dem
 * Brieftext. Gibt null zurueck, wenn kein Brieftext gefunden wird - dann faellt
 * die UI wie bei den anderen Modi auf das Roh-Markdown zurueck.
 *
 * Bewusst tolerant: kleine Modelle vergessen Abschnitte, nummerieren
 * Ueberschriften, schreiben Umlaute statt der ASCII-Variante aus dem Prompt
 * oder packen den Brief in einen Code-Block. Nur der Brief ist Pflicht.
 */

export interface LetterResult {
  notice: string
  subject: string
  body: string
  placeholders: string[]
  todos: string[]
  checklist: string[]
  help: string[]
}

// ============================================================================
// Ueberschriften-Erkennung
// ============================================================================

/**
 * Ueberschrift auf einen vergleichbaren Kern reduzieren: klein, Umlaute in
 * ASCII (der Prompt schreibt "ergaenzen", Modelle liefern oft "ergänzen"),
 * Nummerierung und Satzzeichen weg.
 */
function normalizeHeading(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface RawSection {
  heading: string
  body: string
}

/** Entfernt einen Code-Block-Rahmen, der den ganzen Text umschliesst. */
function stripOuterFence(markdown: string): string {
  const lines = markdown.trim().split('\n')
  if (lines.length < 2) return markdown
  const first = lines[0].trim()
  const last = lines[lines.length - 1].trim()
  if (first.startsWith('```') && last === '```') {
    return lines.slice(1, -1).join('\n')
  }
  return markdown
}

/** Entfernt Code-Block-Zeilen am Anfang und Ende eines Abschnitts. */
function stripFence(section: string): string {
  const lines = section.split('\n')
  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  if (
    lines.length > 1 &&
    lines[0].trim().startsWith('```') &&
    lines[lines.length - 1].trim() === '```'
  ) {
    lines.shift()
    lines.pop()
  }
  return lines.join('\n').trim()
}

/**
 * Zerlegt das Markdown an den Ueberschriften. Code-Bloecke werden uebersprungen,
 * damit ein eingerahmter Brieftext mit "#"-Zeile den Parser nicht zerreisst.
 */
function splitSections(markdown: string): RawSection[] {
  const sections: RawSection[] = []
  let current: RawSection | null = null
  let inFence = false

  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence
    }
    const headingMatch = inFence ? null : line.match(/^ {0,3}#{1,4}\s+(.+?)\s*#*\s*$/)
    if (headingMatch) {
      if (current) sections.push(current)
      current = { heading: normalizeHeading(headingMatch[1]), body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
  }
  if (current) sections.push(current)
  return sections
}

/** Waehlt den ersten noch freien Abschnitt, dessen Ueberschrift zu einem Alias passt. */
function pickSection(
  sections: readonly RawSection[],
  used: Set<number>,
  aliases: readonly string[],
  mode: 'exact' | 'contains'
): number {
  for (let i = 0; i < sections.length; i++) {
    if (used.has(i)) continue
    const heading = sections[i].heading
    for (const alias of aliases) {
      const hit = mode === 'exact' ? heading === alias : heading.includes(alias)
      if (hit) return i
    }
  }
  return -1
}

// DE- und EN-Ueberschriften des Formats plus die Varianten, die Modelle
// erfahrungsgemaess stattdessen schreiben. Alles in normalisierter Form.
const ALIASES = {
  notice: ['hinweis', 'wichtiger hinweis', 'notice', 'important notice', 'disclaimer'],
  subject: ['betreff', 'betreffzeile', 'subject', 'subject line'],
  body: [
    'brief',
    'briefentwurf',
    'brieftext',
    'entwurf',
    'letter',
    'letter draft',
    'draft letter',
    'draft'
  ],
  todos: [
    'das musst du noch ergaenzen',
    'das musst du noch ausfuellen',
    'noch zu ergaenzen',
    'zu ergaenzen',
    'ergaenzen',
    'platzhalter',
    'what you still need to fill in',
    'what you need to fill in',
    'what you still need to add',
    'still to fill in',
    'placeholders'
  ],
  checklist: [
    'bevor du abschickst',
    'bevor du absendest',
    'vor dem abschicken',
    'checkliste',
    'before you send',
    'before sending',
    'checklist'
  ],
  help: [
    'wo du hilfe bekommst',
    'wo du hilfe findest',
    'anlaufstellen',
    'hilfe',
    'where to get help',
    'where to find help',
    'getting help',
    'help'
  ]
} as const satisfies Record<string, readonly string[]>

type SectionKey = keyof typeof ALIASES

// ============================================================================
// Inhalts-Helfer
// ============================================================================

/** Aufzaehlungspunkte eines Abschnitts (-, *, •). */
function extractBullets(section: string): string[] {
  const lines = section.match(/^\s*[-*•]\s+(.+)$/gm) ?? []
  return lines.map((l) => l.replace(/^\s*[-*•]\s+/, '').trim()).filter(Boolean)
}

/** Wie extractBullets, entfernt zusaetzlich die Checkbox-Marker `[ ]` / `[x]`. */
function extractChecklist(section: string): string[] {
  return extractBullets(section)
    .map((l) => l.replace(/^\[\s*[xX]?\s*\]\s*/, '').trim())
    .filter(Boolean)
}

/** Erste sinnvolle Zeile eines Abschnitts, ohne Label, Auszeichnung und Anfuehrungszeichen. */
function firstLine(section: string): string {
  const raw = section
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('```'))
  if (!raw) return ''
  return raw
    .replace(/^[*_`>\s-]+/, '')
    .replace(/[*_`\s]+$/, '')
    .replace(/^(?:betreff|betreffzeile|subject|subject line)\s*:?\s*\**\s*/i, '')
    .replace(/^["'„»“”]+|["'»«“”]+$/g, '')
    .trim()
}

// ============================================================================
// Oeffentliche API
// ============================================================================

/**
 * Findet die `[...]`-Platzhalter im Brieftext, in der Reihenfolge ihres
 * Auftretens und dedupliziert (Vergleich ohne Gross-/Kleinschreibung).
 * Rueckgabe inklusive Klammern, also z.B. "[Dein Name]" - genau so, wie der
 * Nutzer sie im Brief sucht.
 *
 * Markdown-Links `[Text](url)` sind keine Platzhalter, ebenso wenig
 * Checkbox-Marker, leere Klammern und reine Zahlen (Fussnoten).
 */
export function extractPlaceholders(body: string): string[] {
  const re = /\[([^[\]\n]{1,80})\](?!\()/g
  const seen = new Set<string>()
  const result: string[] = []

  for (const match of body.matchAll(re)) {
    const inner = match[1].trim()
    if (!inner) continue
    if (/^[xX]$/.test(inner)) continue
    if (/^\d+$/.test(inner)) continue
    if (inner.startsWith('^')) continue

    const key = inner.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(`[${inner}]`)
  }
  return result
}

/**
 * Zerlegt einen Briefentwurf. null nur, wenn kein Brieftext gefunden wird -
 * alle anderen Abschnitte duerfen fehlen.
 */
export function parseLetter(markdown: string): LetterResult | null {
  if (!markdown.trim()) return null

  const sections = splitSections(stripOuterFence(markdown))
  if (sections.length === 0) return null

  // Erst alle exakten Treffer vergeben, dann die unscharfen - sonst schnappt
  // sich ein kurzer Alias ("hilfe") eine Ueberschrift, die exakt zu einem
  // anderen Abschnitt gehoert.
  const keys: SectionKey[] = ['notice', 'subject', 'body', 'todos', 'checklist', 'help']
  const used = new Set<number>()
  const found: Partial<Record<SectionKey, string>> = {}

  for (const mode of ['exact', 'contains'] as const) {
    for (const key of keys) {
      if (found[key] !== undefined) continue
      const index = pickSection(sections, used, ALIASES[key], mode)
      if (index >= 0) {
        used.add(index)
        found[key] = sections[index].body
      }
    }
  }

  const body = stripFence(found.body ?? '')
  if (!body) return null

  return {
    notice: (found.notice ?? '').trim().replace(/\n{3,}/g, '\n\n'),
    subject: firstLine(found.subject ?? ''),
    body,
    placeholders: extractPlaceholders(body),
    todos: extractBullets(found.todos ?? ''),
    checklist: extractChecklist(found.checklist ?? ''),
    help: extractBullets(found.help ?? '')
  }
}
