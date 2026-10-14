/**
 * Ein "Lauf" ist eine Analyse oder eine Chat-Antwort, angestossen vom
 * Renderer mit einer eigenen ID. Jeder Lauf hat seinen eigenen
 * AbortController.
 *
 * Vorher gab es nur `client.abort()` aus ollama-js - und das bricht ALLE
 * Streams des Clients ab (auch einen laufenden Modell-Download), erreicht
 * einen Stream aber erst, wenn Ollama die Antwortkopfzeilen geschickt hat.
 * Auf Rechnern ohne Grafikkarte dauert das Minuten; so lange tat "Stopp"
 * nichts.
 *
 * Der Lauf steckt in einem AsyncLocalStorage: alles, was innerhalb von
 * `withRun` passiert (auch tief in analysis.service), sieht ihn ueber
 * `currentRun()`, ohne dass jede Funktion ein Signal durchreichen muss.
 *
 * Dass net.fetch das Signal auch VOR den Kopfzeilen beachtet, laesst sich nur
 * in Electron pruefen: scripts/netfetch-abort-probe.cjs (Stand 1.3.8: Abbruch
 * nach rund 300 ms statt nach der vollen Wartezeit).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export type RunScope = 'analysis' | 'chat'

export interface StreamRun {
  id: string
  scope: RunScope
  controller: AbortController
}

const storage = new AsyncLocalStorage<StreamRun>()

/** Je Bereich hoechstens ein laufender Lauf. */
const active = new Map<RunScope, StreamRun>()

/**
 * Fuehrt `fn` als Lauf aus. Ein noch laufender Lauf im selben Bereich wird
 * vorher abgebrochen - zwei Analysen konkurrieren sonst um Ollama, und die
 * Chunks der alten landen in der neuen.
 */
export async function withRun<T>(scope: RunScope, id: string, fn: () => Promise<T>): Promise<T> {
  active.get(scope)?.controller.abort()
  const run: StreamRun = { id, scope, controller: new AbortController() }
  active.set(scope, run)
  try {
    return await storage.run(run, fn)
  } finally {
    if (active.get(scope) === run) active.delete(scope)
  }
}

/** Der Lauf, in dessen Kontext der Aufrufer gerade steckt, oder undefined. */
export function currentRun(): StreamRun | undefined {
  return storage.getStore()
}

/**
 * Bricht den Lauf eines Bereichs ab. Mit `id` nur, wenn es genau dieser Lauf
 * ist - ein verspaetetes "Stopp" fuer einen alten Lauf trifft so nicht den
 * neuen.
 */
export function abortRun(scope: RunScope, id?: string): boolean {
  const run = active.get(scope)
  if (!run || (id !== undefined && run.id !== id)) return false
  run.controller.abort()
  return true
}

/** Alle Laeufe abbrechen - nur beim Schliessen des Fensters. */
export function abortAllRuns(): void {
  for (const run of active.values()) run.controller.abort()
}
