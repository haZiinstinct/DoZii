/**
 * Zusammenfuehrung der Fristanker aus Regelwerk (Fristen-Radar) und Modell.
 * Eigene Datei ohne Electron-Abhaengigkeit, damit die Eval denselben Weg
 * misst wie die App.
 */

import { addPeriod } from './deadline-calc'
import { parseGermanDate } from './fristen-radar'
import type { DeadlineAnchor } from './types'

/**
 * Fuehrt die Anker aus dem Regelwerk und die aus dem Modell zusammen.
 *
 * Das Regelwerk hat je Fristart Vorrang. Grund ist die Messung an denselben
 * sechs Bescheiden: das Regelwerk berechnete jedes gefundene Datum exakt und
 * meldete beim Bescheid ohne Frist nichts, waehrend granite4.1:8b dort eine
 * Frist erfand und granite4.1:3b bei zwei Bescheiden gar nichts fand.
 *
 * Das Modell bleibt trotzdem noetig: es findet Fristarten, die das Regelwerk
 * nicht abdeckt - etwa eine Zahlungsfrist neben der Widerspruchsfrist.
 *
 * Ausnahme: liegt das Bezugsdatum des Regel-Ankers mehr als zwei Jahre
 * zurueck und hat das Modell fuer dieselbe Fristart ein spaeteres, gewinnt
 * das Modell. So ein Regel-Anker hat fast immer ein falsches Datum gegriffen
 * (Geburtsdatum, Datum eines Vorbescheids) - und haette eine Frist als
 * "abgelaufen" gemeldet, die noch laeuft.
 */
export function mergeAnchors(
  fromRules: DeadlineAnchor[],
  fromModel: DeadlineAnchor[],
  today?: string,
  documentText?: string
): DeadlineAnchor[] {
  const staleBefore = today ? addPeriod(today, -24, 'month') : null
  const rules = fromRules.map((rule) => {
    if (!staleBefore || rule.explicitDueDateIso || !rule.startDateIso) return rule
    if (rule.startDateIso >= staleBefore) return rule
    const newer = fromModel.find(
      (m) =>
        m.kind === rule.kind &&
        m.startDateIso !== null &&
        m.startDateIso > rule.startDateIso! &&
        m.startDateIso <= today! &&
        startDateIsBacked(m, documentText)
    )
    return newer ?? rule
  })
  const covered = new Set(rules.map((a) => a.kind))
  return [...rules, ...fromModel.filter((a) => !covered.has(a.kind))]
}

/**
 * Das Startdatum eines Modell-Ankers ist nur belegt, wenn sein Zitat woertlich
 * im Dokument steht UND genau dieses Datum enthaelt. Die Belegpruefung in
 * parseDeadlineAnchors deckt nur das Fristzitat ab - ohne diese Pruefung
 * koennte ein Dokument dem Modell ein spaeteres Datum unterschieben und so
 * den Regel-Anker verdraengen.
 */
function startDateIsBacked(anchor: DeadlineAnchor, documentText?: string): boolean {
  const quote = anchor.startDateQuote
  if (!documentText || !quote) return false
  const squash = (v: string): string => v.replace(/\s+/g, ' ').toLowerCase()
  if (!squash(documentText).includes(squash(quote))) return false
  return parseGermanDate(quote) === anchor.startDateIso
}
