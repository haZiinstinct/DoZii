import { useEffect, useState } from 'react'
import {
  Settings,
  Cpu,
  HardDrive,
  Monitor,
  Circle,
  Download,
  Check,
  Loader2,
  Play,
  AlertCircle,
  FileText,
  FolderOpen,
  Trash2,
  Sun,
  Moon,
  Laptop,
  Key,
  Award,
  Square
} from 'lucide-react'
import type {
  AppSettings,
  HardwareInfo,
  LicenseInfo,
  LicenseTier,
  OllamaModel,
  SuggestedModel,
  ThemeMode
} from '@shared/types'
import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useTheme } from '@/hooks/useTheme'

const profileLabels: Record<string, string> = {
  minimal: 'Minimal',
  light: 'Leicht',
  medium: 'Mittel',
  strong: 'Stark',
  power: 'Power'
}

// Curated list: 4 CPU + 4 GPU models, schwach -> stark.
// Alle CPU-Modelle laufen auf normalen Laptops (4-8 GB RAM),
// alle GPU-Modelle brauchen eine dedizierte Grafikkarte.
const cpuModels: SuggestedModel[] = [
  {
    name: 'gemma3:1b',
    displayName: 'Gemma 3 (1B)',
    size: '~0.8 GB',
    minRamGb: 4,
    runtime: 'cpu',
    strengths: 'Ultraleicht - laeuft auf jedem alten Laptop'
  },
  {
    name: 'gemma2:2b',
    displayName: 'Gemma 2 (2B)',
    size: '~1.6 GB',
    minRamGb: 6,
    runtime: 'cpu',
    strengths: 'Googles bestes Deutsch-Mini'
  },
  {
    name: 'llama3.2:3b',
    displayName: 'Llama 3.2 (3B)',
    size: '~2 GB',
    minRamGb: 8,
    runtime: 'cpu',
    strengths: 'Bewaehrt, zuverlaessig, Meta-Qualitaet'
  },
  {
    name: 'qwen2.5:3b',
    displayName: 'Qwen 2.5 (3B)',
    size: '~2 GB',
    minRamGb: 8,
    runtime: 'cpu',
    strengths: 'Stark bei Deutsch + JSON (Empfehlung)'
  }
]

const gpuModels: SuggestedModel[] = [
  {
    name: 'qwen2.5:7b',
    displayName: 'Qwen 2.5 (7B)',
    size: '~4.7 GB',
    minRamGb: 10,
    minVramGb: 8,
    runtime: 'gpu',
    strengths: 'Top Deutsch + JSON (Empfehlung Mittel)'
  },
  {
    name: 'llama3.1:8b',
    displayName: 'Llama 3.1 (8B)',
    size: '~4.9 GB',
    minRamGb: 12,
    minVramGb: 8,
    runtime: 'gpu',
    strengths: 'Meta-Klassiker, bewaehrt'
  },
  {
    name: 'mistral-small:24b',
    displayName: 'Mistral Small (24B)',
    size: '~14 GB',
    minRamGb: 24,
    minVramGb: 16,
    runtime: 'gpu',
    strengths: 'Primaer fuer Arbeitszeugnisse (Empfehlung Stark)'
  },
  {
    name: 'llama3.1:70b',
    displayName: 'Llama 3.1 (70B)',
    size: '~40 GB',
    minRamGb: 64,
    minVramGb: 48,
    runtime: 'gpu',
    strengths: 'Power-User Maximum'
  }
]

const tierInfo: Record<LicenseTier, { label: string; color: string; desc: string }> = {
  free: {
    label: 'Free',
    color: 'text-brand-text-dim',
    desc: 'Kostenlos mit Basis-Modi. Upgrade fuer Arbeitszeugnis-Decoder und mehr.'
  },
  pro: {
    label: 'Pro',
    color: 'text-brand-cyan',
    desc: 'Alle Analyse-Modi + PDF-Export + Bulk-Import freigeschaltet.'
  },
  business: {
    label: 'Business',
    color: 'text-brand-amber',
    desc: 'Pro + Multi-User + Prompt-Library + Priority Support.'
  }
}

export function SettingsPage() {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [licenseKeyInput, setLicenseKeyInput] = useState('')
  const [licenseEmailInput, setLicenseEmailInput] = useState('')
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [licenseActivating, setLicenseActivating] = useState(false)
  const [modelTab, setModelTab] = useState<'cpu' | 'gpu'>('cpu')
  const {
    connected,
    installed,
    binaryPath,
    starting,
    startError,
    startOllama,
    stopping,
    stopError,
    stopOllama
  } = useOllamaStatus()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  useEffect(() => {
    window.api.hardware.detect().then((hw) => {
      setHardware(hw)
      // Auto-select GPU tab if the user has a capable GPU
      if (hw.gpu && hw.gpu.vramMb >= 6 * 1024) {
        setModelTab('gpu')
      }
    })
    window.api.settings.get().then((s) => {
      setSettings(s)
      setSelectedModel(s.selectedModel)
    })
    window.api.license.get().then(setLicense)
    loadModels()
  }, [])

  const loadModels = async () => {
    const m = await window.api.ollama.listModels()
    setModels(m)
  }

  const handleSelectModel = async (name: string) => {
    setSelectedModel(name)
    await window.api.ollama.selectModel(name)
  }

  const handleDeleteClick = (name: string) => {
    if (confirmDelete === name) {
      performDelete(name)
    } else {
      setConfirmDelete(name)
      setDeleteError(null)
      setTimeout(() => {
        setConfirmDelete((current) => (current === name ? null : current))
      }, 3000)
    }
  }

  const performDelete = async (name: string) => {
    setDeleting(name)
    setConfirmDelete(null)
    setDeleteError(null)
    try {
      await window.api.ollama.deleteModel(name)
      await loadModels()
      if (selectedModel === name) setSelectedModel('')
    } catch (err) {
      setDeleteError(
        `Fehler beim Loeschen von ${name}: ${err instanceof Error ? err.message : 'Unbekannt'}`
      )
    } finally {
      setDeleting(null)
    }
  }

  const handlePull = async (name: string) => {
    setPulling(name)
    setPullProgress('Starting...')
    const removeProgress = window.api.ollama.onPullProgress((progress) => {
      if (progress.total && progress.completed) {
        const pct = Math.round((progress.completed / progress.total) * 100)
        setPullProgress(`${progress.status} ${pct}%`)
      } else {
        setPullProgress(progress.status)
      }
    })
    try {
      await window.api.ollama.pullModel(name)
      await loadModels()
    } catch {
      setPullProgress('Fehler beim Download')
      setTimeout(() => setPullProgress(''), 3000)
    } finally {
      setPulling(null)
      removeProgress()
    }
  }

  const handleActivateLicense = async () => {
    if (!licenseKeyInput.trim()) return
    setLicenseActivating(true)
    setLicenseError(null)
    const result = await window.api.license.activate(
      licenseKeyInput.trim(),
      licenseEmailInput.trim() || undefined
    )
    setLicenseActivating(false)
    if (result.ok) {
      setLicense(result.info)
      setLicenseKeyInput('')
      setLicenseEmailInput('')
    } else {
      setLicenseError(result.error ?? 'Aktivierung fehlgeschlagen')
    }
  }

  const handleDeactivateLicense = async () => {
    const info = await window.api.license.deactivate()
    setLicense(info)
  }

  const installedNames = new Set(models.map((m) => m.name))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
          <Settings size={20} />
        </div>
        <h1 className="text-2xl font-bold text-brand-text-bright">Einstellungen</h1>
      </div>

      {/* License */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          <Award size={12} />
          Lizenz
        </h2>

        {license && (
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-darker font-mono text-lg font-bold ${tierInfo[license.tier].color}`}
            >
              {tierInfo[license.tier].label.charAt(0)}
            </div>
            <div className="flex-1">
              <p className={`text-lg font-bold ${tierInfo[license.tier].color}`}>
                DoZii {tierInfo[license.tier].label}
              </p>
              <p className="mt-1 text-xs text-brand-text-dim">{tierInfo[license.tier].desc}</p>
              {license.activatedAt && (
                <p className="mt-2 font-mono text-[10px] text-brand-text-dim">
                  Aktiviert: {new Date(license.activatedAt).toLocaleDateString('de-DE')}
                </p>
              )}
            </div>
            {license.tier !== 'free' && (
              <button
                onClick={handleDeactivateLicense}
                className="rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-red/30 hover:text-brand-red"
              >
                Deaktivieren
              </button>
            )}
          </div>
        )}

        {license?.tier === 'free' && (
          <div className="mt-4 space-y-3 border-t border-brand-border pt-4">
            <p className="text-xs text-brand-text-dim">
              Lizenz-Key eingeben (Format: DOZII-PRO-XXXX-XXXX-XXXX)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="DOZII-PRO-XXXX-XXXX-XXXX"
                className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-2.5 font-mono text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20"
              />
              <input
                type="email"
                value={licenseEmailInput}
                onChange={(e) => setLicenseEmailInput(e.target.value)}
                placeholder="E-Mail (optional)"
                className="w-full rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 sm:w-52"
              />
              <button
                onClick={handleActivateLicense}
                disabled={!licenseKeyInput.trim() || licenseActivating}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-cyan-dim disabled:opacity-40"
              >
                {licenseActivating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                Aktivieren
              </button>
            </div>
            {licenseError && (
              <p className="text-xs text-brand-red">{licenseError}</p>
            )}
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          Theme
        </h2>
        <div className="flex gap-2">
          {(
            [
              { value: 'dark' as ThemeMode, label: 'Dunkel', icon: Moon },
              { value: 'light' as ThemeMode, label: 'Hell', icon: Sun },
              { value: 'system' as ThemeMode, label: 'System', icon: Laptop }
            ]
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setThemeMode(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                themeMode === value
                  ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan'
                  : 'border-brand-border text-brand-text-dim hover:border-brand-border-hover'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Ollama Connection */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          Ollama Verbindung
        </h2>
        <div className="flex items-center gap-3">
          <Circle
            size={10}
            className={
              connected
                ? 'fill-brand-green text-brand-green'
                : starting || stopping
                  ? 'fill-brand-amber text-brand-amber'
                  : 'fill-brand-red text-brand-red'
            }
          />
          <span className="text-brand-text">
            {connected
              ? 'Verbunden'
              : starting
                ? 'Startet...'
                : stopping
                  ? 'Wird gestoppt...'
                  : installed
                    ? 'Nicht aktiv'
                    : 'Nicht installiert'}
          </span>

          {connected && (
            <button
              onClick={stopOllama}
              disabled={stopping}
              title="Ollama-Server stoppen"
              className="flex items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1 text-xs font-medium text-brand-red transition-colors hover:bg-brand-red/20 disabled:opacity-50"
            >
              {stopping ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Square size={10} fill="currentColor" />
              )}
              Stoppen
            </button>
          )}

          <span className="ml-auto font-mono text-sm text-brand-text-dim">localhost:11434</span>
        </div>

        {stopError && (
          <div className="mt-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-3">
            <p className="text-xs text-brand-red">{stopError}</p>
          </div>
        )}

        {installed && binaryPath && (
          <p className="mt-3 truncate font-mono text-xs text-brand-text-dim">{binaryPath}</p>
        )}

        {!connected && installed && (
          <button
            onClick={startOllama}
            disabled={starting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan px-6 py-3 text-sm font-semibold text-brand-dark transition-all duration-200 hover:bg-brand-cyan-dim hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] disabled:opacity-40"
          >
            {starting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Ollama wird gestartet...
              </>
            ) : (
              <>
                <Play size={16} />
                Ollama jetzt starten
              </>
            )}
          </button>
        )}

        {!installed && !starting && (
          <div className="mt-4 rounded-xl border border-brand-amber/20 bg-brand-amber/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-brand-amber" />
              <p className="text-sm text-brand-amber">Ollama ist nicht installiert</p>
            </div>
            <p className="text-xs text-brand-text-dim">
              Lade Ollama von{' '}
              <a
                href="https://ollama.com/download"
                onClick={(e) => {
                  e.preventDefault()
                  window.open('https://ollama.com/download', '_blank')
                }}
                className="text-brand-cyan hover:underline"
              >
                ollama.com/download
              </a>{' '}
              herunter und installiere es. Danach kannst du es hier direkt starten.
            </p>
          </div>
        )}

        {startError && (
          <div className="mt-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-3">
            <p className="text-xs text-brand-red">{startError}</p>
          </div>
        )}
      </section>

      {/* Models */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          Modelle
        </h2>

        {models.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-brand-text-dim">Installiert:</p>
            {models.map((m) => {
              const isDeleting = deleting === m.name
              const isConfirmingDelete = confirmDelete === m.name
              const deleteDisabled = pulling !== null || deleting !== null
              return (
                <div key={m.name} className="flex items-stretch gap-2">
                  <button
                    onClick={() => handleSelectModel(m.name)}
                    disabled={isDeleting}
                    className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:opacity-50 ${
                      selectedModel === m.name
                        ? 'border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan'
                        : 'border-brand-border text-brand-text hover:border-brand-border-hover'
                    }`}
                  >
                    {selectedModel === m.name && <Check size={14} />}
                    <span className="font-mono">{m.name}</span>
                    <span className="ml-auto text-xs text-brand-text-dim">
                      {(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(m.name)}
                    disabled={deleteDisabled}
                    title={
                      pulling
                        ? 'Warte bis der Download abgeschlossen ist'
                        : isConfirmingDelete
                          ? 'Nochmal klicken zum bestaetigen'
                          : 'Modell loeschen'
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      isConfirmingDelete
                        ? 'border-brand-red/40 bg-brand-red/20 text-brand-red'
                        : 'border-brand-border text-brand-text-dim hover:border-brand-red/30 hover:bg-brand-red/5 hover:text-brand-red'
                    }`}
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isConfirmingDelete ? (
                      <>
                        <Trash2 size={12} />
                        Wirklich loeschen?
                      </>
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              )
            })}
            {deleteError && (
              <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-3">
                <p className="text-xs text-brand-red">{deleteError}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-brand-text-dim">Empfohlene Modelle:</p>

          {/* CPU / GPU Tabs */}
          <div className="flex gap-1 rounded-xl border border-brand-border bg-brand-dark/60 p-1">
            <button
              onClick={() => setModelTab('cpu')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                modelTab === 'cpu'
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-brand-text-dim hover:text-brand-text'
              }`}
            >
              <Cpu size={14} />
              CPU ({cpuModels.length})
            </button>
            <button
              onClick={() => setModelTab('gpu')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                modelTab === 'gpu'
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-brand-text-dim hover:text-brand-text'
              }`}
            >
              <Monitor size={14} />
              GPU ({gpuModels.length})
            </button>
          </div>

          {modelTab === 'cpu' && (
            <p className="text-xs text-brand-text-dim">
              Laeuft ohne dedizierte Grafikkarte - nur RAM wird gebraucht.
            </p>
          )}
          {modelTab === 'gpu' && (
            <p className="text-xs text-brand-text-dim">
              Braucht eine GPU mit genug VRAM fuer beste Geschwindigkeit. Laeuft sonst auf CPU-Fallback langsamer.
            </p>
          )}

          {(modelTab === 'cpu' ? cpuModels : gpuModels).map((m) => {
            const isInstalled = installedNames.has(m.name)
            const isPulling = pulling === m.name
            const isRecommended = hardware?.recommendedModel === m.name
            const hasEnoughRam = hardware ? hardware.ram.totalGb >= m.minRamGb : true
            const hasEnoughVram =
              m.minVramGb === undefined ||
              (hardware?.gpu ? hardware.gpu.vramMb / 1024 >= m.minVramGb : false)
            const canRun = hasEnoughRam && hasEnoughVram
            const insufficientReason = !hasEnoughRam
              ? `Erfordert min. ${m.minRamGb} GB RAM`
              : !hasEnoughVram
                ? `Erfordert min. ${m.minVramGb} GB VRAM (GPU)`
                : null

            return (
              <div
                key={m.name}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
                  isRecommended ? 'border-brand-cyan/20 bg-brand-cyan/5' : 'border-brand-border'
                } ${!canRun && !isInstalled ? 'opacity-50' : ''}`}
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-card text-brand-text-dim">
                  {m.runtime === 'cpu' ? <Cpu size={12} /> : <Monitor size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-brand-text">{m.name}</span>
                    {isRecommended && (
                      <span className="rounded bg-brand-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-cyan">
                        EMPFOHLEN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-text-dim">
                    {m.size} | {m.strengths}
                  </p>
                  {!canRun && !isInstalled && (
                    <p className="mt-1 text-xs text-brand-amber">{insufficientReason}</p>
                  )}
                </div>
                {isInstalled ? (
                  <Check size={16} className="text-brand-green" />
                ) : isPulling ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-brand-cyan" />
                    <span className="text-xs text-brand-text-dim">{pullProgress}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePull(m.name)}
                    disabled={!!pulling || !connected || !canRun}
                    title={!canRun ? insufficientReason ?? '' : undefined}
                    className="flex items-center gap-1 rounded-lg bg-brand-cyan/10 px-3 py-1.5 text-xs text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={12} />
                    Pull
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Hardware Info */}
      {hardware && (
        <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
            Hardware
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Cpu size={16} className="mt-0.5 text-brand-cyan" />
              <div>
                <p className="text-sm text-brand-text">{hardware.cpu.model}</p>
                <p className="text-xs text-brand-text-dim">{hardware.cpu.threads} Threads</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HardDrive size={16} className="mt-0.5 text-brand-cyan" />
              <div>
                <p className="text-sm text-brand-text">{hardware.ram.totalGb} GB RAM</p>
                <p className="text-xs text-brand-text-dim">{hardware.ram.freeGb} GB frei</p>
              </div>
            </div>
            {hardware.gpu && (
              <div className="flex items-start gap-3">
                <Monitor size={16} className="mt-0.5 text-brand-cyan" />
                <div>
                  <p className="text-sm text-brand-text">{hardware.gpu.name}</p>
                  <p className="text-xs text-brand-text-dim">
                    {Math.round(hardware.gpu.vramMb / 1024)} GB VRAM
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-brand-cyan/20 font-mono text-[10px] font-bold text-brand-cyan">
                P
              </div>
              <div>
                <p className="text-sm text-brand-text">
                  Profil: {profileLabels[hardware.profile] ?? hardware.profile}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Logs */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          Entwickler & Logs
        </h2>
        <p className="mb-4 text-sm text-brand-text-dim">
          Alle App-Events, Fehler und Stack-Traces werden lokal in taeglich rotierten Log-Dateien
          gespeichert. Nuetzlich fuer Fehlersuche und Entwicklung.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.api.logs.openDirectory()}
            className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <FolderOpen size={14} />
            Logs-Ordner oeffnen
          </button>
          <button
            onClick={async () => {
              const path = await window.api.logs.getCurrentFile()
              if (path) {
                navigator.clipboard?.writeText(path).catch(() => {})
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <FileText size={14} />
            Pfad kopieren
          </button>
        </div>
        {settings && (
          <p className="mt-4 text-[10px] font-mono text-brand-text-dim">
            Settings-Sprache: {settings.language} · OCR: {settings.ocrLanguages.join(', ')}
          </p>
        )}
      </section>
    </div>
  )
}
