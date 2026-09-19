/**
 * Entscheidet, mit welchem num_ctx eine Analyse laeuft.
 *
 * Bisher war num_ctx fest 8192 - unabhaengig davon, ob das Modell 128k kann
 * und wie lang das Dokument ist. Lange Vertraege und Bescheide wurden dadurch
 * gekuerzt, und genau am Ende stehen Kuendigungsfristen und Klauseln.
 *
 * Reine Rechnung, keine Node-/Electron-APIs -> testbar und in beiden
 * Prozessen nutzbar. Der Aufrufer (context-window.service) beschafft
 * Modell-Limit und freien RAM.
 *
 * ACHTUNG Doppelung: MIN_NUM_CTX, MAX_AUTO_NUM_CTX und CTX_TOKENS_PER_FREE_GB
 * stehen mit denselben Werten auch in src/main/config/constants.ts. src/shared
 * darf dort nicht importieren (Main-only). Die Aufloesung der Doppelung
 * (constants.ts re-exportiert aus dieser Datei) macht der Integrator.
 */

/** Untergrenze: nie kleiner als der bisherige Festwert. */
export const MIN_NUM_CTX = 8192
/** Obergrenze fuer die automatische Vergroesserung. */
export const MAX_AUTO_NUM_CTX = 32_768
/** Grobe Schaetzung: vertretbare Kontext-Tokens pro GB freiem RAM. */
export const CTX_TOKENS_PER_FREE_GB = 4096

/**
 * Erlaubte Stufen. Wir springen in Stufen statt auf den exakten Bedarf,
 * damit Ollama das Modell zwischen zwei aehnlich langen Dokumenten nicht
 * jedes Mal mit neuem num_ctx nachladen muss.
 */
export const NUM_CTX_LADDER: readonly number[] = [8192, 12_288, 16_384, 24_576, 32_768]

export interface NumCtxInput {
  /** Kontextfenster des Modells laut Ollama; null = unbekannt. */
  modelContextLimit: number | null
  /** System + User + Antwort-Reserve. */
  neededTokens: number
  freeRamGb: number
  autoEnabled: boolean
  /**
   * Was der Modus mindestens braucht, um ueberhaupt etwas zu liefern:
   * Prompt-Geruest plus Antwort-Reserve plus ein Mindestmass an Dokument.
   *
   * Gilt AUCH bei abgeschalteter Automatik. Der Zeugnis-Prompt misst allein
   * rund 4300 Tokens, die Antwort braucht gemessen 5000 bis 6000 - bei 8192
   * bleibt fuer das Dokument nichts uebrig, und das Modell benotet einen
   * Ausschnitt von drei Zeilen. Der Schalter entscheidet, ob das Fenster fuer
   * lange Dokumente WAECHST, nicht ob ein Modus arbeiten kann.
   *
   * Das Modell-Limit bleibt die harte Grenze - mehr als es kann, geht nicht.
   */
  minimumTokens?: number
}

export interface NumCtxDecision {
  numCtx: number
  /** true, wenn der gewaehlte Wert kleiner ist als der Bedarf - es wird gekuerzt. */
  capped: boolean
  /** Kurze Begruendung fuer Log und Einstellungs-UI. */
  reason: string
}

/** Kleinste Stufe >= tokens; ueber der hoechsten Stufe deren Maximum. */
function ladderStepFor(tokens: number): number {
  for (const step of NUM_CTX_LADDER) {
    if (step >= tokens) return step
  }
  return NUM_CTX_LADDER[NUM_CTX_LADDER.length - 1]
}

/** Groesste Stufe <= limit; darunter die Untergrenze. */
function ladderStepBelow(limit: number): number {
  let best = MIN_NUM_CTX
  for (const step of NUM_CTX_LADDER) {
    if (step <= limit) best = step
  }
  return best
}

/** Nicht-endliche oder negative Werte als 0 behandeln (defensiv gegen os.freemem-Ausreisser). */
function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function pickNumCtx(input: NumCtxInput): NumCtxDecision {
  const { modelContextLimit, neededTokens, freeRamGb, autoEnabled } = input
  const needed = safeNonNegative(neededTokens)
  const limit = modelContextLimit === null ? null : safeNonNegative(modelContextLimit)

  /** Der Festwert, angehoben auf das vom Modus geforderte Minimum. */
  const floor = (): { numCtx: number; note: string } => {
    const wanted = ladderStepFor(Math.max(MIN_NUM_CTX, safeNonNegative(input.minimumTokens ?? 0)))
    if (wanted <= MIN_NUM_CTX) return { numCtx: MIN_NUM_CTX, note: '' }
    // Mehr als das Modell kann, geht nicht.
    const allowed = limit === null ? wanted : Math.min(wanted, ladderStepBelow(limit))
    const numCtx = Math.max(MIN_NUM_CTX, allowed)
    return {
      numCtx,
      note: numCtx > MIN_NUM_CTX ? `; Modus braucht mindestens ${numCtx}` : ''
    }
  }

  if (!autoEnabled) {
    const { numCtx, note } = floor()
    return {
      numCtx,
      capped: needed > numCtx,
      reason: `Automatik aus - fester Kontext ${numCtx}${note}`
    }
  }
  if (modelContextLimit === null) {
    const { numCtx, note } = floor()
    return {
      numCtx,
      capped: needed > numCtx,
      reason: `Kontextfenster des Modells unbekannt - Rueckfall auf ${numCtx}${note}`
    }
  }

  const target = ladderStepFor(needed)
  const ramBudget = Math.floor(safeNonNegative(freeRamGb) * CTX_TOKENS_PER_FREE_GB)

  // Reihenfolge = Prioritaet bei Gleichstand: steht "Bedarf" vorn, begrenzt
  // niemand - der Wert deckt das Dokument ab.
  const bounds: { value: number; label: string }[] = [
    { value: target, label: 'Bedarf' },
    { value: safeNonNegative(modelContextLimit), label: 'Modell-Limit' },
    { value: MAX_AUTO_NUM_CTX, label: 'Obergrenze' },
    { value: ramBudget, label: 'RAM-Budget' }
  ]
  const binding = bounds.reduce((min, b) => (b.value < min.value ? b : min))

  const numCtx = Math.max(ladderStepBelow(binding.value), floor().numCtx)
  const capped = numCtx < needed

  let reason: string
  if (binding.label === 'Bedarf') {
    reason = `Bedarf ${needed} Tokens -> Stufe ${numCtx}`
  } else {
    reason = `Bedarf ${needed} Tokens, begrenzt durch ${binding.label} (${binding.value}) -> ${numCtx}`
  }
  // Untergrenze gilt auch gegen RAM und Modell: ein zu kleines Fenster macht
  // die App auf schwachen Rechnern unbrauchbar. Dann aber ehrlich sagen,
  // dass der Kontext nicht reicht.
  if (binding.value < MIN_NUM_CTX) {
    reason += `; Untergrenze ${MIN_NUM_CTX} greift`
  }
  if (capped) {
    reason += ' - Dokument wird gekuerzt'
  }

  return { numCtx, capped, reason }
}
