/**
 * Zentrale Definition der unterstuetzten Dateitypen. Vorher dreifach gepflegt
 * (documents.ipc Allow-List + Dialog-Filter, document-store Allow-List + MIME-Map)
 * mit Drift-Risiko.
 *
 * .doc/.xls (alte Office-Binaerformate) fehlen bewusst: mammoth/xlsx koennen
 * sie nicht lesen - der Import gibt stattdessen einen Konvertier-Hinweis.
 */

/** Erlaubte Dateiendungen (mit Punkt, lowercase). */
export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.bmp',
  '.webp'
] as const

export const SUPPORTED_EXTENSION_SET: ReadonlySet<string> = new Set(SUPPORTED_EXTENSIONS)

/** Endungen ohne Punkt - fuer Electron dialog.showOpenDialog filters. */
export const DIALOG_EXTENSIONS = SUPPORTED_EXTENSIONS.map((e) => e.slice(1))

/** Hinweise fuer nicht unterstuetzte Legacy-Office-Formate. */
export const LEGACY_OFFICE_HINTS: Record<string, string> = {
  '.doc': 'Bitte die Datei in Word als .docx speichern und erneut importieren.',
  '.xls': 'Bitte die Datei in Excel als .xlsx speichern und erneut importieren.'
}

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp'
}

export function getMimeType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream'
}

export function isImageExtension(ext: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'].includes(ext.toLowerCase())
}
