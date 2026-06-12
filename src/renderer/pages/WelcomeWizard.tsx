import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cpu,
  HardDrive,
  Monitor,
  Circle,
  ArrowRight,
  Shield,
  Play,
  Loader2,
  Download
} from 'lucide-react'
import type { HardwareInfo } from '@shared/types'

const profileLabels: Record<string, string> = {
  minimal: 'Minimal',
  light: 'Leicht',
  medium: 'Mittel',
  strong: 'Stark',
  power: 'Power'
}

type OllamaState = 'checking' | 'connected' | 'installed-not-running' | 'not-installed'

export function WelcomeWizard() {
  const navigate = useNavigate()
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [ollamaState, setOllamaState] = useState<OllamaState>('checking')
  const [scanning, setScanning] = useState(true)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const refreshOllama = async (): Promise<OllamaState> => {
    const [status, installation] = await Promise.all([
      window.api.ollama.getStatus(),
      window.api.ollama.detectInstallation()
    ])
    if (status.connected) return 'connected'
    if (installation.installed) return 'installed-not-running'
    return 'not-installed'
  }

  useEffect(() => {
    async function scan() {
      const [hw, ollama] = await Promise.all([window.api.hardware.detect(), refreshOllama()])
      setHardware(hw)
      setOllamaState(ollama)
      setScanning(false)
    }
    scan()
  }, [])

  const handleStartOllama = async () => {
    setStarting(true)
    setStartError(null)
    const result = await window.api.ollama.start()
    if (result.started) {
      const state = await refreshOllama()
      setOllamaState(state)
    } else {
      setStartError(result.error ?? 'Ollama konnte nicht gestartet werden')
    }
    setStarting(false)
  }

  const handleContinue = async () => {
    await window.api.settings.update({ firstLaunchDone: true })
    navigate('/')
  }

  return (
    <div className="flex h-screen flex-col bg-brand-dark">
      {/* Titlebar area */}
      <div className="titlebar-drag h-12 border-b border-brand-border bg-brand-darker" />

      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg animate-fade-up space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="mb-2 font-mono text-4xl font-bold text-brand-cyan">DoZii</h1>
            <p className="text-brand-text-dim">
              Lokale Dokumentenanalyse - 100% offline, 100% privat
            </p>
          </div>

          {/* Privacy badge */}
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/5 px-4 py-2">
            <Shield size={14} className="text-brand-green" />
            <span className="text-xs font-medium text-brand-green">
              Keine Daten verlassen deinen Rechner
            </span>
          </div>

          {/* Hardware scan */}
          <div className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
              System-Erkennung
            </h2>

            {scanning ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
                <span className="text-sm text-brand-text-dim">Hardware wird erkannt...</span>
              </div>
            ) : (
              hardware && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-brand-cyan" />
                    <span className="text-sm text-brand-text">{hardware.cpu.model}</span>
                    <span className="ml-auto text-xs text-brand-text-dim">
                      {hardware.cpu.threads} Threads
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HardDrive size={16} className="text-brand-cyan" />
                    <span className="text-sm text-brand-text">{hardware.ram.totalGb} GB RAM</span>
                    <span className="ml-auto text-xs text-brand-text-dim">
                      {hardware.ram.freeGb} GB frei
                    </span>
                  </div>
                  {hardware.gpu && (
                    <div className="flex items-center gap-3">
                      <Monitor size={16} className="text-brand-cyan" />
                      <span className="text-sm text-brand-text">{hardware.gpu.name}</span>
                      <span className="ml-auto text-xs text-brand-text-dim">
                        {Math.round(hardware.gpu.vramMb / 1024)} GB VRAM
                      </span>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
                    <p className="text-xs text-brand-text-dim">Empfohlenes Modell</p>
                    <p className="mt-1 font-mono text-lg font-bold text-brand-cyan">
                      {hardware.recommendedModel}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-text-dim">
                      Profil: {profileLabels[hardware.profile] ?? hardware.profile}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Ollama status + actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-card/40 px-4 py-3">
              <Circle
                size={8}
                className={
                  ollamaState === 'checking'
                    ? 'fill-brand-amber text-brand-amber'
                    : ollamaState === 'connected'
                      ? 'fill-brand-green text-brand-green'
                      : ollamaState === 'installed-not-running'
                        ? 'fill-brand-amber text-brand-amber'
                        : 'fill-brand-red text-brand-red'
                }
              />
              <span className="text-sm text-brand-text">
                {ollamaState === 'checking' && 'Ollama wird geprueft...'}
                {ollamaState === 'connected' && 'Ollama laeuft auf localhost:11434'}
                {ollamaState === 'installed-not-running' && 'Ollama installiert aber nicht aktiv'}
                {ollamaState === 'not-installed' && 'Ollama nicht gefunden'}
              </span>
            </div>

            {/* Start button */}
            {ollamaState === 'installed-not-running' && (
              <button
                onClick={handleStartOllama}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-3 text-sm font-semibold text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Ollama startet...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Ollama jetzt starten
                  </>
                )}
              </button>
            )}

            {/* Download link */}
            {ollamaState === 'not-installed' && (
              <button
                onClick={() => window.open('https://ollama.com/download', '_blank')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
              >
                <Download size={14} />
                Ollama herunterladen
              </button>
            )}

            {startError && <p className="text-xs text-brand-red">{startError}</p>}
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={scanning}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan px-8 py-4 text-lg font-semibold text-brand-dark transition-all duration-200 hover:bg-brand-cyan-dim hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Starten
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
