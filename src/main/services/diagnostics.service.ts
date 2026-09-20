/**
 * Sammelt die Angaben fuer den Diagnosebericht.
 *
 * Statt Telemetrie im Hintergrund: der Nutzer loest den Bericht aus, sieht
 * ihn vollstaendig und verschickt ihn selbst. Die App baut hier nur den Text
 * zusammen - verschickt wird nichts. Das Zusammensetzen selbst steht in
 * @shared/diagnostic-report und ist ohne Electron testbar.
 */

import os from 'os'
import { app } from 'electron'
import { readFileSync } from 'fs'
import { detectHardware } from './hardware-detector.service'
import {
  checkOllamaStatus,
  getOllamaUrl,
  listModels,
  listLoadedModels
} from './ollama-client.service'
import { getSettings } from './settings.service'
import { logger } from './logger.service'
import { usableVramGb } from '@shared/hardware-profile'
import { buildDiagnosticReport, sanitizeLogLine } from '@shared/diagnostic-report'
import type { DiagnosticInput } from '@shared/diagnostic-report'

const SOURCE = 'diagnostics.service'

/** Wie viele Fehlerzeilen der Bericht hoechstens mitnimmt. */
const MAX_ERROR_LINES = 15

/**
 * Die Version von Ollama. Nicht ueber den Client, weil der kein /api/version
 * anbietet - ein direkter Aufruf ist hier ehrlicher als ein Umweg.
 */
async function ollamaVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/version`, {
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return null
    const body = (await res.json()) as { version?: unknown }
    return typeof body.version === 'string' ? body.version : null
  } catch {
    return null
  }
}

/**
 * Liest die letzten Fehler aus der laufenden Logdatei.
 *
 * Jede Zeile ist ein JSON-Objekt; gebraucht werden Zeitpunkt, Quelle und
 * Meldung. Der Meta-Block bleibt bewusst draussen - dort landen Prompts,
 * Zitate und Dateinamen.
 */
function recentErrors(): string[] {
  const file = logger.getCurrentLogFile()
  if (!file) return []
  try {
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    const out: string[] = []
    for (let i = lines.length - 1; i >= 0 && out.length < MAX_ERROR_LINES; i--) {
      try {
        const e = JSON.parse(lines[i]) as { ts?: string; lvl?: string; src?: string; msg?: string }
        if (e.lvl !== 'error' && e.lvl !== 'warn') continue
        const when = typeof e.ts === 'string' ? e.ts.slice(0, 19).replace('T', ' ') : '?'
        out.push(sanitizeLogLine(`[${e.lvl}] ${when} ${e.src ?? '?'}: ${e.msg ?? ''}`))
      } catch {
        // Halbe Zeile am Dateiende - ueberspringen.
      }
    }
    return out.reverse()
  } catch (err) {
    logger.warn(SOURCE, 'Logdatei nicht lesbar', {
      error: err instanceof Error ? err.message : String(err)
    })
    return []
  }
}

/**
 * Baut den Bericht. Wirft nicht: ein Diagnosewerkzeug, das beim Diagnostizieren
 * abstuerzt, ist wertlos - fehlende Teile stehen als "unbekannt" drin.
 */
export async function createDiagnosticReport(): Promise<string> {
  const hardware = await detectHardware()
  const status = await checkOllamaStatus()

  const installed = status.connected
    ? await listModels()
        .then((m) => m.map((x) => x.name))
        .catch(() => [])
    : []
  const loadedRaw = status.connected ? await listLoadedModels().catch(() => []) : []

  const input: DiagnosticInput = {
    appVersion: app.getVersion(),
    os: { platform: process.platform, release: os.release(), arch: process.arch },
    cpu: { model: hardware.cpu.model, logicalCpus: hardware.cpu.logicalCpus },
    ramTotalGb: hardware.ram.totalGb,
    ramFreeGb: hardware.ram.freeGb,
    gpu: hardware.gpu,
    usableVramGb: usableVramGb(hardware.gpu),
    profile: hardware.profile,
    recommendedModel: hardware.recommendedModel,
    selectedModel: getSettings().selectedModel,
    ollamaReachable: status.connected,
    ollamaVersion: status.connected ? await ollamaVersion() : null,
    installedModels: installed,
    loadedModels: loadedRaw.map((m) => ({
      name: m.name,
      runningOn: m.sizeVram === 0 ? 'cpu' : m.sizeVram >= m.size * 0.95 ? 'gpu' : 'hybrid',
      vramPercent:
        m.size > 0 ? Math.max(0, Math.min(100, Math.round((m.sizeVram / m.size) * 100))) : 0
    })),
    recentErrors: recentErrors()
  }

  logger.info(SOURCE, 'Diagnosebericht erstellt', {
    gpuVendor: hardware.gpu?.vendor,
    detectedVia: hardware.gpu?.detectedVia,
    profile: hardware.profile
  })

  return buildDiagnosticReport(input)
}
