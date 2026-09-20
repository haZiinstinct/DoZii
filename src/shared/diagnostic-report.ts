/**
 * Der Diagnosebericht - und warum es keine Telemetrie gibt.
 *
 * DoZii macht keine einzige ausgehende Verbindung ausser zu Ollama auf dem
 * eigenen Rechner. "100 % offline" ist kein Werbesatz, sondern der Grund,
 * warum jemand seine Kuendigung oder sein Arbeitszeugnis hier hineinlegt.
 * Hintergrund-Telemetrie wuerde genau das aufgeben - bei der Gruppe, die am
 * meisten zu verlieren hat.
 *
 * Trotzdem muss man erfahren, ob die App auf fremder Hardware laeuft. Der
 * Weg dahin ist ein Bericht, den der Mensch AUSLOEST, VOLLSTAENDIG SIEHT und
 * SELBST verschickt. Die App schickt weiterhin nichts.
 *
 * Deshalb steht hier nur, was zur Fehlersuche taugt: Hardware, Versionen,
 * Zeiten, Fehlermeldungen. Kein Dokumentinhalt, keine Dateinamen, keine
 * Kennung, die den Rechner wiedererkennbar macht.
 */

import type { GpuInfo, HardwareProfile } from './types'

export interface DiagnosticInput {
  appVersion: string
  os: { platform: string; release: string; arch: string }
  cpu: { model: string; logicalCpus: number }
  ramTotalGb: number
  ramFreeGb: number
  gpu: GpuInfo | null
  /** VRAM, das fuer die Einstufung zaehlt - 0 bei Intel und unbekannt. */
  usableVramGb: number
  profile: HardwareProfile
  recommendedModel: string
  selectedModel: string
  ollamaReachable: boolean
  ollamaVersion: string | null
  installedModels: string[]
  loadedModels: Array<{ name: string; runningOn: string; vramPercent: number }>
  /** Die letzten Fehlerzeilen aus dem Log, bereits von Inhalten befreit. */
  recentErrors: string[]
}

function yesNo(value: boolean): string {
  return value ? 'ja' : 'nein'
}

function line(label: string, value: string | number): string {
  return `${(label + ':').padEnd(22)}${value}`
}

/**
 * Beschreibt die Grafikkarte samt Erkennungsweg.
 *
 * Der Erkennungsweg ist der eigentliche Zweck des Berichts: steht dort
 * "NVIDIA ueber windows-registry", hat nvidia-smi nicht gegriffen und der
 * Hersteller wurde nur aus dem Geraetenamen geraten.
 */
function describeGpu(gpu: GpuInfo | null, usableVramGb: number): string[] {
  if (!gpu) return [line('Grafikkarte', 'keine erkannt')]
  const out = [
    line('Grafikkarte', gpu.name),
    line('  Hersteller', gpu.vendor),
    line('  VRAM', `${Math.round((gpu.vramMb / 1024) * 10) / 10} GB`),
    line('  erkannt ueber', gpu.detectedVia ?? 'unbekannt')
  ]
  if (usableVramGb === 0) {
    out.push(line('  wird genutzt', 'nein - Ollama beschleunigt nur NVIDIA (CUDA) und AMD (ROCm)'))
  }
  return out
}

/**
 * Baut den Berichtstext. Reine Funktion: was hier herauskommt, sieht der
 * Nutzer eins zu eins, bevor er entscheidet, ob er es weitergibt.
 */
export function buildDiagnosticReport(input: DiagnosticInput): string {
  const parts: string[] = []

  parts.push('DoZii - Diagnosebericht')
  parts.push('='.repeat(56))
  parts.push('')
  parts.push('Dieser Bericht enthaelt KEINE Dokumentinhalte und keine Dateinamen.')
  parts.push('Er wird nur verschickt, wenn du ihn selbst verschickst.')
  parts.push('')

  parts.push('-- App --')
  parts.push(line('Version', input.appVersion))
  parts.push(line('System', `${input.os.platform} ${input.os.release} (${input.os.arch})`))
  parts.push('')

  parts.push('-- Hardware --')
  parts.push(line('Prozessor', `${input.cpu.model} (${input.cpu.logicalCpus} Kerne)`))
  parts.push(line('Arbeitsspeicher', `${input.ramTotalGb} GB, davon frei ${input.ramFreeGb} GB`))
  parts.push(...describeGpu(input.gpu, input.usableVramGb))
  parts.push(line('Eingestufte Stufe', input.profile))
  parts.push('')

  parts.push('-- Modelle --')
  parts.push(line('Empfohlen', input.recommendedModel))
  parts.push(
    line(
      'Gewaehlt',
      input.selectedModel === input.recommendedModel
        ? `${input.selectedModel} (= Empfehlung)`
        : input.selectedModel
    )
  )
  parts.push(line('Ollama erreichbar', yesNo(input.ollamaReachable)))
  parts.push(line('Ollama-Version', input.ollamaVersion ?? 'unbekannt'))
  parts.push(
    line(
      'Installiert',
      input.installedModels.length > 0 ? input.installedModels.join(', ') : 'keine'
    )
  )
  if (input.loadedModels.length > 0) {
    for (const m of input.loadedModels) {
      parts.push(
        line('  geladen', `${m.name} - laeuft auf ${m.runningOn} (${m.vramPercent} % VRAM)`)
      )
    }
  } else {
    parts.push(line('  geladen', 'keines'))
  }
  parts.push('')

  parts.push('-- Letzte Fehler --')
  if (input.recentErrors.length === 0) {
    parts.push('keine')
  } else {
    parts.push(...input.recentErrors)
  }

  return parts.join('\n')
}

/**
 * Entfernt aus einer Logzeile alles, was Inhalt sein koennte.
 *
 * Der Logger schreibt strukturierte Meldungen, aber Fehlertexte aus Ollama
 * oder aus dem Dateisystem koennen Pfade und Textausschnitte enthalten. Was
 * hier nicht sicher als technisch erkennbar ist, fliegt raus - lieber eine
 * Zeile zu wenig im Bericht als ein Satz aus dem Arbeitszeugnis.
 */
export function sanitizeLogLine(raw: string): string {
  return (
    raw
      // Windows- und Unix-Pfade auf den letzten Teil kuerzen.
      .replace(/[A-Za-z]:\\[^\s"']+/g, '<pfad>')
      .replace(/\/(?:home|Users)\/[^\s"']+/g, '<pfad>')
      // Alles in Anfuehrungszeichen kann ein Dokumentausschnitt sein.
      .replace(/"[^"]{40,}"/g, '"<text entfernt>"')
      .replace(/'[^']{40,}'/g, "'<text entfernt>'")
      .trim()
  )
}

/** Vorausgefuellte GitHub-Issue-Adresse. Geoeffnet wird sie erst auf Klick. */
export function githubIssueUrl(repoUrl: string, report: string): string {
  const body = [
    '**Was ist passiert?**',
    '',
    '',
    '**Was hast du erwartet?**',
    '',
    '',
    '<details><summary>Diagnosebericht</summary>',
    '',
    '```',
    report,
    '```',
    '',
    '</details>'
  ].join('\n')
  const base = repoUrl.replace(/\/+$/, '')
  return `${base}/issues/new?title=${encodeURIComponent('[Bericht] ')}&body=${encodeURIComponent(body)}`
}
