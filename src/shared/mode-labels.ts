import type { AnalysisMode } from './types'

/**
 * Deutsche Bezeichnungen der Analyse-Modi fuer Exporte (Dateiname, Titel,
 * PDF-Kopf). Eine Tabelle statt drei: in einer davon fehlten plain, contract
 * und letter - deren PDFs hiessen dann "Analyse". Der Typ erzwingt, dass jeder
 * Modus einen Namen hat.
 */
export const MODE_EXPORT_LABELS: Readonly<Record<AnalysisMode, string>> = {
  plain: 'Einfach erklaert',
  grammar: 'Rechtschreibung & Grammatik',
  formulation: 'Bessere Formulierungen',
  arbeitszeugnis: 'Arbeitszeugnis-Decoder',
  contract: 'Vertrags-Check',
  summary: 'Zusammenfassung',
  freeform: 'Freie Frage',
  letter: 'Briefentwurf'
}

/** Name fuer einen gespeicherten Modus-String (aeltere Datensaetze: Fallback). */
export function modeExportLabel(mode: string): string {
  return (MODE_EXPORT_LABELS as Record<string, string>)[mode] ?? 'Analyse'
}
