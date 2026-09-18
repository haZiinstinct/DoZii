import { readFile } from 'fs/promises'
import { basename } from 'path'
import { MAX_TEXT_IMPORT_CHARS } from '../config/constants'
import { decodeTextBytes, parseEml } from '@shared/eml-parse'

export interface TextExtractResult {
  text: string
  /** Textdateien und Mails haben keine Seiten. */
  pageCount: number | null
}

async function readTextFile(filePath: string): Promise<Buffer> {
  try {
    return await readFile(filePath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    const name = basename(filePath)
    if (code === 'ENOENT') {
      throw new Error(`Die Datei "${name}" wurde nicht gefunden.`, { cause: err })
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Keine Leseberechtigung für "${name}".`, { cause: err })
    }
    if (code === 'EISDIR') {
      throw new Error(`"${name}" ist ein Ordner, keine Datei.`, { cause: err })
    }
    throw new Error(`Die Datei "${name}" konnte nicht gelesen werden${code ? ` (${code})` : ''}.`, {
      cause: err
    })
  }
}

/**
 * Bytes in Text wandeln. Zweistufige Heuristik:
 * 1. Ein BOM entscheidet eindeutig (UTF-8, UTF-16LE, UTF-16BE) - dann kein Raten.
 * 2. Ohne BOM uebernimmt `decodeTextBytes`: UTF-8 versuchen und bei gehaeuften
 *    Ersatzzeichen (U+FFFD) auf Windows-1252 zurueckfallen. Behoerdenportale und
 *    aeltere Windows-Programme speichern .txt haeufig noch in dieser Codepage.
 */
function decodeBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // Node kennt kein utf16be - Bytepaare tauschen und als LE lesen.
    const rest = buf.subarray(2)
    const even = rest.length - (rest.length % 2)
    return Buffer.from(rest.subarray(0, even)).swap16().toString('utf16le')
  }
  return decodeTextBytes(buf)
}

/** Sehr lange Dateien abschneiden - das Modell sieht ohnehin nur einen Ausschnitt. */
function limitLength(text: string): string {
  if (text.length <= MAX_TEXT_IMPORT_CHARS) return text
  return (
    text.slice(0, MAX_TEXT_IMPORT_CHARS).trimEnd() +
    `\n\n[Hinweis: Der Text wurde nach ${MAX_TEXT_IMPORT_CHARS.toLocaleString('de-DE')} Zeichen ` +
    'abgeschnitten - die Datei ist zu lang für eine vollständige Analyse.]'
  )
}

/** Liest .txt und .md als Klartext ein. */
export async function extractPlainText(filePath: string): Promise<TextExtractResult> {
  const buf = await readTextFile(filePath)
  return { text: limitLength(decodeBuffer(buf).trim()), pageCount: null }
}

/**
 * Liest eine .eml-Datei und liefert den Mailtext mit vorangestelltem
 * Von/An/Datum/Betreff-Kopf (siehe `parseEml`).
 */
export async function extractEml(filePath: string): Promise<TextExtractResult> {
  const buf = await readTextFile(filePath)
  const parsed = parseEml(decodeBuffer(buf))
  const text = parsed.body.trim()
  if (text === '') {
    throw new Error(
      `Aus der E-Mail "${basename(filePath)}" konnte kein Text gelesen werden - sie enthält vermutlich nur Anhänge.`
    )
  }
  return { text: limitLength(text), pageCount: null }
}
