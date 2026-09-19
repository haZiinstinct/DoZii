/**
 * Markdown -> RTF. Word-kompatibler Export ohne neue Abhaengigkeit.
 *
 * Bewusst RTF statt DOCX: RTF ist reiner Text, braucht also keine
 * ZIP-Bibliothek, und Word, LibreOffice und WordPad oeffnen es direkt.
 * Der Kern ist das Escaping - deutsche Behoerdenpost ist voller Umlaute,
 * und RTF transportiert alles jenseits von ASCII nur als \\u<dezimal>?.
 *
 * Keine Node-/DOM-APIs -> reine Logik, ohne electron testbar.
 */

/** Kopf mit Schriftarten-Tabelle. */
const RTF_HEADER = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}'

/**
 * Farbtabelle als eigene Gruppe (der Kopf bleibt unveraendert):
 * cf1 = Fliesstext, cf2 = Inline-Code, cf3 = Zitat. Ohne zweite Schriftart
 * ist Farbe die einzige Moeglichkeit, Code optisch abzusetzen.
 */
const RTF_COLORTBL =
  '{\\colortbl;\\red26\\green26\\blue31;\\red140\\green38\\blue38;\\red102\\green102\\blue102;}'

/** Schriftgroesse in Punkt (RTF selbst rechnet in Halbpunkten). */
const DEFAULT_FONT_SIZE = 11
const MIN_FONT_SIZE = 6
const MAX_FONT_SIZE = 72

/** Einzug einer Listenebene in Twips (284 Twips ~ 0,5 cm). */
const LIST_INDENT = 284

/** Maximale Einrueckungstiefe verschachtelter Listen. */
const MAX_LIST_LEVEL = 3

export interface RtfDocOptions {
  /** Wird als Dokumenttitel (\info) gesetzt UND als Ueberschrift vorangestellt. */
  title?: string
  /** Grundschriftgroesse in Punkt, Standard 11. */
  fontSize?: number
}

/**
 * Escaping fuer RTF-Text. Alles jenseits von ASCII wird zu \\u<dezimal>?,
 * wobei das '?' der Ersatz fuer Leser ohne Unicode-Unterstuetzung ist
 * (siehe \\uc1 im Dokumentkopf).
 */
export function escapeRtf(text: string): string {
  let out = ''
  // for...of laeuft ueber Codepoints - Surrogatpaare bleiben zusammen.
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0

    // Emoji & Co. liegen ausserhalb der BMP; RTF kennt dafuer kein
    // Einzel-Escape, also ein schlichtes Fragezeichen statt Muell.
    if (cp > 0xffff) {
      out += '?'
      continue
    }
    if (char === '\\') {
      out += '\\\\'
      continue
    }
    if (char === '{') {
      out += '\\{'
      continue
    }
    if (char === '}') {
      out += '\\}'
      continue
    }
    if (char === '\n') {
      out += '\\line '
      continue
    }
    if (char === '\t') {
      out += '\\tab '
      continue
    }
    // Uebrige Steuerzeichen (inkl. CR) haben in RTF nichts verloren.
    if (cp < 32) continue
    if (cp < 128) {
      out += char
      continue
    }
    // RTF liest \u als vorzeichenbehaftete 16-Bit-Zahl.
    out += `\\u${cp > 32767 ? cp - 65536 : cp}?`
  }
  return out
}

/** Erzeugt ein vollstaendiges, in Word oeffenbares RTF-Dokument. */
export function markdownToRtf(markdown: string, opts: RtfDocOptions = {}): string {
  const base = resolveFontSize(opts.fontSize)
  const title = opts.title?.trim() ?? ''

  const parts: string[] = [RTF_HEADER, RTF_COLORTBL]
  if (title) {
    parts.push(`{\\info{\\title ${escapeRtf(title)}}}`)
  }
  // \uc1: zu jedem \u<dezimal> gehoert genau EIN Ersatzzeichen.
  parts.push(`\\uc1\\f0\\fs${base}`)
  if (title) {
    parts.push(paragraph(headingProps(1, base), escapeRtf(title)))
  }
  parts.push(...renderBlocks(markdown, base))
  parts.push('}')

  // Zeilenumbrueche zwischen den Gruppen ignoriert jeder RTF-Leser; sie
  // machen die Datei aber im Editor lesbar.
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Bloecke
// ---------------------------------------------------------------------------

function renderBlocks(markdown: string, base: number): string[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  let quote: string[] = []
  let code: string[] | null = null

  const flushPara = (): void => {
    if (para.length === 0) return
    // Zeilenumbrueche des Autors bleiben als \line erhalten: bei Briefen
    // waeren Anschrift und Grussformel sonst zu einem Block verklebt.
    out.push(paragraph(`\\sa120\\fs${base}`, para.join('\\line ')))
    para = []
  }
  const flushQuote = (): void => {
    if (quote.length === 0) return
    out.push(
      paragraph(
        `\\li${LIST_INDENT}\\ri${LIST_INDENT}\\sa120\\i\\cf3\\fs${base}`,
        quote.join('\\line ')
      )
    )
    quote = []
  }
  const flushCode = (): void => {
    if (code === null) return
    out.push(paragraph(`\\li${LIST_INDENT}\\sa120\\cf2\\fs${base - 2}`, code.join('\\line ')))
    code = null
  }
  const flushText = (): void => {
    flushPara()
    flushQuote()
  }

  for (const raw of lines) {
    // Codefence-Inhalt wird woertlich durchgereicht, kein Markdown darin.
    if (code !== null) {
      if (/^\s*```/.test(raw)) flushCode()
      else code.push(escapeRtf(raw))
      continue
    }
    if (/^\s*```/.test(raw)) {
      flushText()
      code = []
      continue
    }

    if (raw.trim() === '') {
      flushText()
      continue
    }

    // Trennlinie vor der Listenregel pruefen, sonst schluckt '***' die Zeile.
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) {
      flushText()
      out.push(paragraph(`\\brdrb\\brdrs\\brdrw10\\brsp20\\sa120\\fs${base}`, ''))
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(raw)
    if (heading) {
      flushText()
      out.push(paragraph(headingProps(heading[1].length, base), renderInline(heading[2].trim())))
      continue
    }

    const quoted = /^\s*>\s?(.*)$/.exec(raw)
    if (quoted) {
      flushPara()
      quote.push(renderInline(quoted[1].trim()))
      continue
    }
    flushQuote()

    const checklist = /^([ \t]*)[-*]\s+\[([ xX])\]\s*(.*)$/.exec(raw)
    if (checklist) {
      flushPara()
      // ASCII-Kaestchen statt Unicode-Ballot-Box: deren ANSI-Ersatz waere
      // nur '?' - unbrauchbar fuer eine Checkliste zum Abhaken.
      const box = checklist[2] === ' ' ? '[ ]' : '[x]'
      out.push(
        listParagraph(indentLevel(checklist[1]), `${box}\\tab `, renderInline(checklist[3]), base)
      )
      continue
    }

    const bullet = /^([ \t]*)[-*]\s+(.*)$/.exec(raw)
    if (bullet) {
      flushPara()
      out.push(
        listParagraph(indentLevel(bullet[1]), '\\bullet\\tab ', renderInline(bullet[2]), base)
      )
      continue
    }

    const ordered = /^([ \t]*)(\d{1,3})[.)]\s+(.*)$/.exec(raw)
    if (ordered) {
      flushPara()
      out.push(
        listParagraph(
          indentLevel(ordered[1]),
          `${ordered[2]}.\\tab `,
          renderInline(ordered[3]),
          base
        )
      )
      continue
    }

    // Alles uebrige (inkl. Tabellenzeilen) ist Fliesstext.
    para.push(renderInline(raw.trim()))
  }

  // Unbeendeter Codefence: Inhalt trotzdem ausgeben statt verlieren.
  flushCode()
  flushText()
  return out
}

/** `{\pard<props> <inhalt>\par}` - die Gruppe kapselt die Zeichenformate. */
function paragraph(props: string, content: string): string {
  return `{\\pard${props} ${content}\\par}`
}

function headingProps(level: number, base: number): string {
  const index = Math.min(Math.max(level, 1), 3) - 1
  const sizes = [base + 12, base + 8, base + 4]
  const before = [240, 200, 160]
  const after = [120, 100, 80]
  return `\\sb${before[index]}\\sa${after[index]}\\b\\fs${sizes[index]}`
}

function listParagraph(level: number, marker: string, content: string, base: number): string {
  // Haengender Einzug: die Folgezeilen fluchten mit dem Text, nicht mit dem Marker.
  return paragraph(
    `\\fi-${LIST_INDENT}\\li${LIST_INDENT * (level + 1)}\\sa60\\fs${base}`,
    `${marker}${content}`
  )
}

/** Zwei Leerzeichen (oder ein Tab) pro Listenebene, wie in Markdown ueblich. */
function indentLevel(prefix: string): number {
  const spaces = prefix.replace(/\t/g, '  ').length
  return Math.min(Math.floor(spaces / 2), MAX_LIST_LEVEL)
}

function resolveFontSize(pt: number | undefined): number {
  const value = typeof pt === 'number' && Number.isFinite(pt) ? Math.round(pt) : DEFAULT_FONT_SIZE
  return Math.min(Math.max(value, MIN_FONT_SIZE), MAX_FONT_SIZE) * 2
}

// ---------------------------------------------------------------------------
// Inline-Formatierung
// ---------------------------------------------------------------------------

/**
 * Loest `**fett**`, `*kursiv*` und Inline-`code` auf und escaped alles
 * dazwischen. Rekursiv, damit Verschachtelung funktioniert; die RTF-Gruppe
 * `{...}` begrenzt das Format automatisch, ein Zuruecksetzen entfaellt.
 */
function renderInline(text: string): string {
  let out = ''
  let plain = ''
  let i = 0

  const flush = (): void => {
    if (plain) {
      out += escapeRtf(plain)
      plain = ''
    }
  }

  while (i < text.length) {
    const char = text[i]

    if (char === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        // Code wird nicht weiter interpretiert - Sternchen bleiben Sternchen.
        out += `{\\cf2 ${escapeRtf(text.slice(i + 1, end))}}`
        i = end + 1
        continue
      }
    }

    if (char === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out += `{\\b ${renderInline(text.slice(i + 2, end))}}`
        i = end + 2
        continue
      }
    }

    if (char === '*') {
      const end = findClosingStar(text, i + 1)
      if (end !== -1) {
        flush()
        out += `{\\i ${renderInline(text.slice(i + 1, end))}}`
        i = end + 1
        continue
      }
    }

    plain += char
    i++
  }

  flush()
  return out
}

/**
 * Sucht das schliessende einzelne '*'. Doppelte Sternchen gehoeren zu einer
 * Fett-Auszeichnung und werden uebersprungen, damit `*kursiv mit **fett***`
 * nicht an der falschen Stelle endet.
 */
function findClosingStar(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] !== '*') continue
    if (text[i + 1] === '*') {
      i++
      continue
    }
    return i > from ? i : -1
  }
  return -1
}
