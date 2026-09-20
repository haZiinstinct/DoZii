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
  Download,
  Clock
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { HardwareInfo } from '@shared/types'
import { findModel } from '@shared/model-catalog'
import { usableVramGb } from '@shared/hardware-profile'

type OllamaState = 'checking' | 'connected' | 'installed-not-running' | 'not-installed'

export function WelcomeWizard({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [ollamaState, setOllamaState] = useState<OllamaState>('checking')
  const [scanning, setScanning] = useState(true)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  /** null = noch nicht geprueft (Ollama war nicht erreichbar). */
  const [modelInstalled, setModelInstalled] = useState<boolean | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullPercent, setPullPercent] = useState(0)
  const [pullError, setPullError] = useState<string | null>(null)

  const refreshOllama = async (): Promise<OllamaState> => {
    const [status, installation] = await Promise.all([
      window.api.ollama.getStatus(),
      window.api.ollama.detectInstallation()
    ])
    if (status.connected) return 'connected'
    if (installation.installed) return 'installed-not-running'
    return 'not-installed'
  }

  /** Liegt das empfohlene Modell schon lokal? */
  const refreshModel = async (recommended: string): Promise<void> => {
    try {
      const models = await window.api.ollama.listModels()
      const wanted = recommended.replace(/:latest$/, '')
      setModelInstalled(models.some((m) => m.name.replace(/:latest$/, '') === wanted))
    } catch {
      setModelInstalled(null)
    }
  }

  useEffect(() => {
    async function scan() {
      const [hw, ollama] = await Promise.all([window.api.hardware.detect(), refreshOllama()])
      setHardware(hw)
      setOllamaState(ollama)
      if (ollama === 'connected') await refreshModel(hw.recommendedModel)
      setScanning(false)
    }
    scan()
  }, [])

  // Fortschritt des Downloads. Ollama meldet completed/total in Bytes.
  useEffect(() => {
    return window.api.ollama.onPullProgress((p) => {
      if (p.total && p.total > 0 && typeof p.completed === 'number') {
        setPullPercent(Math.min(100, Math.round((p.completed / p.total) * 100)))
      }
    })
  }, [])

  const handlePullModel = async (): Promise<void> => {
    if (!hardware) return
    setPulling(true)
    setPullError(null)
    setPullPercent(0)
    try {
      await window.api.ollama.pullModel(hardware.recommendedModel)
      await refreshModel(hardware.recommendedModel)
    } catch (err) {
      setPullError(err instanceof Error ? err.message : t('welcome.modelFailed'))
    } finally {
      setPulling(false)
    }
  }

  const handleStartOllama = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const result = await window.api.ollama.start()
      if (result.started) {
        const state = await refreshOllama()
        setOllamaState(state)
        if (state !== 'connected') {
          setStartError(t('welcome.startFailedConnect'))
        }
      } else {
        setStartError(result.error ?? t('welcome.startFailed'))
      }
    } catch (err) {
      setStartError(err instanceof Error ? err.message : t('welcome.startFailed'))
    } finally {
      setStarting(false)
    }
  }

  /**
   * Keine Karte, die Ollama beschleunigt. `hardware.profile` taugt dafuer
   * nicht: 'light' kommt auch bei einer zu kleinen echten Karte heraus.
   */
  const cpuOnly = hardware ? usableVramGb(hardware.gpu) === 0 : false

  const handleContinue = async () => {
    await window.api.settings.update({ firstLaunchDone: true })
    onDone?.()
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
            <p className="text-brand-text-dim">{t('welcome.subtitle')}</p>
          </div>

          {/* Privacy badge */}
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/5 px-4 py-2">
            <Shield size={14} className="text-brand-green" aria-hidden="true" />
            <span className="text-xs font-medium text-brand-green">{t('welcome.privacy')}</span>
          </div>

          {/* Hardware scan */}
          <div className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
              {t('welcome.systemScan')}
            </h2>

            {scanning ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
                <span className="text-sm text-brand-text-dim">{t('welcome.scanning')}</span>
              </div>
            ) : (
              hardware && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-brand-cyan" />
                    <span className="text-sm text-brand-text">{hardware.cpu.model}</span>
                    <span className="ms-auto text-xs text-brand-text-dim">
                      {t('settings.threads', { count: hardware.cpu.threads })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HardDrive size={16} className="text-brand-cyan" />
                    <span className="text-sm text-brand-text">{hardware.ram.totalGb} GB RAM</span>
                    <span className="ms-auto text-xs text-brand-text-dim">
                      {t('settings.ramFree', { n: hardware.ram.freeGb })}
                    </span>
                  </div>
                  {/*
                    Ohne brauchbare Karte stand hier frueher gar nichts - der
                    Nutzer sah CPU, RAM, Modell und direkt den Download. Die
                    Zeile bleibt deshalb stehen und sagt, was Sache ist.
                  */}
                  {cpuOnly ? (
                    <div className="flex items-center gap-3">
                      <Monitor size={16} className="text-brand-amber" />
                      <span className="text-sm text-brand-text">{t('hardware.runsCpu')}</span>
                      {hardware.gpu && (
                        <span className="ms-auto truncate text-xs text-brand-text-dim">
                          {hardware.gpu.name}
                        </span>
                      )}
                    </div>
                  ) : (
                    hardware.gpu && (
                      <div className="flex items-center gap-3">
                        <Monitor size={16} className="text-brand-cyan" />
                        <span className="text-sm text-brand-text">{hardware.gpu.name}</span>
                        <span className="ms-auto text-xs text-brand-text-dim">
                          {Math.round(hardware.gpu.vramMb / 1024)} GB VRAM
                        </span>
                      </div>
                    )
                  )}

                  <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
                    <p className="text-xs text-brand-text-dim">{t('welcome.recommended')}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-brand-cyan">
                      {hardware.recommendedModel}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-text-dim">
                      {t('hardware.profile')}: {t(`profile.${hardware.profile}`)}
                    </p>
                  </div>

                  {/*
                    Die Zahl steht vor dem 2,5-GB-Download, nicht danach. Wer
                    keine Karte hat, soll wissen, dass ein Zeugnis eine
                    Kaffeepause ist - gesperrt wird trotzdem nichts.
                  */}
                  {cpuOnly && (
                    <div className="flex items-start gap-2 rounded-xl border border-brand-amber/20 bg-brand-amber/5 p-3">
                      <Clock
                        size={12}
                        className="mt-0.5 flex-shrink-0 text-brand-amber"
                        aria-hidden="true"
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-brand-amber">
                          {t('welcome.cpuOnly')}
                        </p>
                        <p className="text-xs leading-relaxed text-brand-text-dim">
                          {t('welcome.cpuOnlyHint')}
                        </p>
                      </div>
                    </div>
                  )}
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
                {ollamaState === 'checking' && t('welcome.ollamaChecking')}
                {ollamaState === 'connected' && t('welcome.ollamaConnected')}
                {ollamaState === 'installed-not-running' && t('welcome.ollamaInactive')}
                {ollamaState === 'not-installed' && t('welcome.ollamaNotFound')}
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
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    {t('welcome.startingOllama')}
                  </>
                ) : (
                  <>
                    <Play size={14} aria-hidden="true" />
                    {t('welcome.startOllama')}
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
                <Download size={14} aria-hidden="true" />
                {t('sidebar.download')}
              </button>
            )}

            {startError && <p className="text-xs text-brand-red">{startError}</p>}
          </div>

          {/*
            Der eigentliche Abgrund beim Erststart: Ollama laeuft, aber es
            ist kein Modell da - und die App kann trotzdem nichts. Deshalb
            steht der Download hier und nicht erst in den Einstellungen.
          */}
          {ollamaState === 'connected' && hardware && modelInstalled === false && (
            <div className="space-y-2 rounded-xl border border-brand-border bg-brand-card/40 px-4 py-3">
              <p className="text-sm text-brand-text">
                {t('welcome.modelMissing', {
                  model: hardware.recommendedModel,
                  size: findModel(hardware.recommendedModel)?.sizeGb ?? '?'
                })}
              </p>
              <p className="text-xs text-brand-text-dim">{t('welcome.modelOnce')}</p>

              {pulling ? (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-brand-darker">
                    <div
                      className="h-full bg-brand-cyan transition-all duration-300"
                      style={{ width: `${pullPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-brand-text-dim">
                    {t('welcome.modelLoading', { percent: pullPercent })}
                  </p>
                </div>
              ) : (
                <button
                  onClick={handlePullModel}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-3 text-sm font-semibold text-brand-cyan transition-all hover:bg-brand-cyan/20"
                >
                  <Download size={14} aria-hidden="true" />
                  {t('welcome.modelDownload')}
                </button>
              )}

              {pullError && <p className="text-xs text-brand-red">{pullError}</p>}
            </div>
          )}

          {ollamaState === 'connected' && modelInstalled === true && (
            <p className="text-center text-xs text-brand-green">{t('welcome.modelReady')}</p>
          )}

          {/* Continue button */}
          {/*
            Wer ohne Modell weitergeht, soll wissen, was ihn erwartet -
            statt auf einer Seite zu landen, die nichts tut.
          */}
          {!scanning && modelInstalled !== true && (
            <p className="text-center text-xs text-brand-amber">{t('welcome.continueWithout')}</p>
          )}

          <button
            onClick={handleContinue}
            disabled={scanning || pulling}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan px-8 py-4 text-lg font-semibold text-brand-dark transition-all duration-200 hover:bg-brand-cyan-dim hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('welcome.continue')}
            <ArrowRight size={18} className="rtl-flip" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
