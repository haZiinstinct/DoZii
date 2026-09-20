import { describe, it, expect } from 'vitest'
import { buildDiagnosticReport, githubIssueUrl, sanitizeLogLine } from './diagnostic-report'
import type { DiagnosticInput } from './diagnostic-report'

const BASE: DiagnosticInput = {
  appVersion: '1.3.2',
  os: { platform: 'win32', release: '10.0.26100', arch: 'x64' },
  cpu: { model: 'AMD Ryzen 7 5800X', logicalCpus: 16 },
  ramTotalGb: 32,
  ramFreeGb: 18.4,
  gpu: { name: 'AMD Radeon RX 6700 XT', vramMb: 12288, vendor: 'amd', detectedVia: 'rocm-smi' },
  usableVramGb: 12,
  profile: 'strong',
  recommendedModel: 'gemma4:12b',
  selectedModel: 'gemma4:12b',
  ollamaReachable: true,
  ollamaVersion: '0.33.2',
  installedModels: ['gemma4:12b', 'qwen3:4b'],
  loadedModels: [{ name: 'gemma4:12b', runningOn: 'gpu', vramPercent: 68 }],
  recentErrors: []
}

describe('buildDiagnosticReport', () => {
  it('nennt den Erkennungsweg der Grafikkarte', () => {
    // Das ist der eigentliche Zweck des Berichts.
    expect(buildDiagnosticReport(BASE)).toContain('erkannt ueber')
    expect(buildDiagnosticReport(BASE)).toContain('rocm-smi')
  })

  it('macht sichtbar, wenn nvidia-smi nicht gegriffen hat', () => {
    const r = buildDiagnosticReport({
      ...BASE,
      gpu: {
        name: 'NVIDIA GeForce RTX 4070',
        vramMb: 12288,
        vendor: 'nvidia',
        detectedVia: 'windows-registry'
      }
    })
    expect(r).toContain('windows-registry')
  })

  it('sagt, wenn die Karte gar nicht genutzt wird', () => {
    const r = buildDiagnosticReport({
      ...BASE,
      gpu: {
        name: 'Intel(R) Iris(R) Xe',
        vramMb: 16384,
        vendor: 'intel',
        detectedVia: 'windows-registry'
      },
      usableVramGb: 0
    })
    expect(r).toContain('wird genutzt')
    expect(r).toMatch(/nein.*NVIDIA.*AMD/)
  })

  it('kommt ohne Grafikkarte zurecht', () => {
    const r = buildDiagnosticReport({ ...BASE, gpu: null, usableVramGb: 0, profile: 'light' })
    expect(r).toContain('keine erkannt')
  })

  it('vermerkt, wenn Gewaehltes und Empfehlung auseinandergehen', () => {
    const r = buildDiagnosticReport({ ...BASE, selectedModel: 'granite4.1:3b' })
    expect(r).toContain('granite4.1:3b')
    expect(r).not.toContain('= Empfehlung')
  })

  it('sagt ausdruecklich, dass keine Inhalte drinstehen', () => {
    // Der Nutzer soll das lesen koennen, bevor er auf Senden klickt.
    const r = buildDiagnosticReport(BASE)
    expect(r).toContain('KEINE Dokumentinhalte')
    expect(r).toContain('nur verschickt, wenn du ihn selbst verschickst')
  })

  it('nimmt die Fehlerzeilen auf', () => {
    const r = buildDiagnosticReport({ ...BASE, recentErrors: ['ECONNRESET bei /api/chat'] })
    expect(r).toContain('ECONNRESET bei /api/chat')
  })

  it('meldet auch, wenn es keine Fehler gab', () => {
    expect(buildDiagnosticReport(BASE)).toMatch(/Letzte Fehler --\nkeine/)
  })
})

describe('sanitizeLogLine', () => {
  it('kuerzt Windows-Pfade', () => {
    expect(sanitizeLogLine('Datei C:\\Users\\Anna\\Zeugnis.pdf nicht lesbar')).toBe(
      'Datei <pfad> nicht lesbar'
    )
  })

  it('kuerzt Unix-Pfade', () => {
    expect(sanitizeLogLine('open /home/anna/kuendigung.pdf failed')).toBe('open <pfad> failed')
  })

  it('entfernt lange Zitate', () => {
    // Genau so koennte ein Satz aus dem Arbeitszeugnis im Log landen.
    const raw = 'Beleg nicht gefunden: "Herr Meier erledigte die ihm uebertragenen Aufgaben stets"'
    expect(sanitizeLogLine(raw)).toBe('Beleg nicht gefunden: "<text entfernt>"')
  })

  it('laesst kurze technische Angaben stehen', () => {
    expect(sanitizeLogLine('model "qwen3:4b" not found')).toBe('model "qwen3:4b" not found')
  })
})

describe('githubIssueUrl', () => {
  it('baut eine Adresse mit dem Bericht im Rumpf', () => {
    const url = githubIssueUrl('https://github.com/haZiinstinct/DoZii', 'BERICHT')
    expect(url).toContain('/issues/new?')
    expect(url).toContain(encodeURIComponent('BERICHT'))
  })

  it('vertraegt einen Schraegstrich am Ende', () => {
    expect(githubIssueUrl('https://github.com/a/b/', 'x')).toContain('github.com/a/b/issues/new')
  })
})
