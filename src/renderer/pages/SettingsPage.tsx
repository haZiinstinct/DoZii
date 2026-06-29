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
  Square,
  Flag,
  RefreshCw
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import type {
  AppSettings,
  HardwareInfo,
  OllamaModel,
  SuggestedModel,
  ThemeMode,
  UpdateStatus
} from '@shared/types'
import { SUPPORTED_LANGUAGES } from '@shared/languages'
import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useTheme } from '@/hooks/useTheme'
import { applyLanguageDirection } from '@/hooks/useLanguageDirection'

// budgetLaptopFriendly: runs on 8 GB RAM CPU-only, ~30-90s per Arbeitszeugnis.
const cpuModels: SuggestedModel[] = [
  {
    name: 'gemma3:1b',
    displayName: 'Gemma 3 (1B)',
    size: '~0.8 GB',
    minRamGb: 4,
    runtime: 'cpu',
    strengths: 'Ultraleicht - läuft auf jedem alten Laptop'
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
    strengths: 'Bewährt, zuverlässig, Meta-Qualität',
    budgetLaptopFriendly: true
  },
  {
    name: 'qwen2.5:3b',
    displayName: 'Qwen 2.5 (3B)',
    size: '~2 GB',
    minRamGb: 8,
    runtime: 'cpu',
    strengths: 'Stark bei Deutsch + JSON (Empfehlung)',
    budgetLaptopFriendly: true
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
    strengths: 'Meta-Klassiker, bewährt'
  },
  {
    name: 'mistral-small:24b',
    displayName: 'Mistral Small (24B)',
    size: '~14 GB',
    minRamGb: 24,
    minVramGb: 16,
    runtime: 'gpu',
    strengths: 'Primär für Arbeitszeugnisse (Empfehlung Stark)'
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

export function SettingsPage() {
  const { t } = useTranslation()
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [modelTab, setModelTab] = useState<'cpu' | 'gpu'>('cpu')
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
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

  const loadModels = async () => {
    const m = await window.api.ollama.listModels()
    setModels(m)
  }

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
    loadModels()
    window.api.update.getState().then(({ appVersion: v, status }) => {
      setAppVersion(v)
      setUpdateStatus(status)
    })
    const unsubscribe = window.api.update.onStatus(setUpdateStatus)
    return unsubscribe
  }, [])

  const handleToggleAutoUpdate = async () => {
    if (!settings) return
    const next = await window.api.settings.update({ autoUpdateCheck: !settings.autoUpdateCheck })
    setSettings(next)
  }

  const handleSetLanguage = async (language: AppSettings['language']) => {
    i18n.changeLanguage(language)
    applyLanguageDirection(language)
    const next = await window.api.settings.update({ language })
    setSettings(next)
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
        t('settings.deleteFailed', {
          name,
          error: err instanceof Error ? err.message : t('settings.unknown')
        })
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
      setPullProgress(t('settings.downloadError'))
      setTimeout(() => setPullProgress(''), 3000)
    } finally {
      setPulling(null)
      removeProgress()
    }
  }

  const installedNames = new Set(models.map((m) => m.name))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
          <Settings size={20} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-brand-text-bright">{t('settings.title')}</h1>
      </div>

      {/* Updates */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          <RefreshCw size={12} aria-hidden="true" />
          {t('settings.updates')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-brand-text">DoZii {appVersion || '–'}</span>

          {updateStatus.state === 'checking' ? (
            <span className="flex items-center gap-1.5 text-xs text-brand-text-dim">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />{' '}
              {t('settings.updateChecking')}
            </span>
          ) : updateStatus.state === 'available' ? (
            <span className="text-xs text-brand-cyan">
              {t('settings.updateAvailable', { version: updateStatus.version })}
            </span>
          ) : updateStatus.state === 'downloading' ? (
            <span className="flex items-center gap-1.5 text-xs text-brand-cyan">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />{' '}
              {t('settings.updateDownloading', { percent: updateStatus.percent })}
            </span>
          ) : updateStatus.state === 'downloaded' ? (
            <span className="text-xs text-brand-green">
              {t('settings.updateReadyInstall', { version: updateStatus.version })}
            </span>
          ) : updateStatus.state === 'up-to-date' ? (
            <span className="flex items-center gap-1.5 text-xs text-brand-green">
              <Check size={12} aria-hidden="true" /> {t('settings.upToDate')}
            </span>
          ) : updateStatus.state === 'error' ? (
            <span className="text-xs text-brand-red" title={updateStatus.message}>
              {t('settings.updateFailed')}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {updateStatus.state === 'available' && (
              <button
                onClick={() => window.api.update.download()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-cyan-dim"
              >
                <Download size={12} aria-hidden="true" />
                {t('settings.download')}
              </button>
            )}
            {updateStatus.state === 'downloaded' && (
              <button
                onClick={() => window.api.update.install()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-brand-dark transition-colors hover:opacity-90"
              >
                {t('settings.restartInstall')}
              </button>
            )}
            {(updateStatus.state === 'idle' ||
              updateStatus.state === 'up-to-date' ||
              updateStatus.state === 'error') && (
              <button
                onClick={() => window.api.update.check()}
                className="rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
              >
                {t('settings.checkNow')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 border-t border-brand-border pt-4">
          <div>
            <p className="text-sm text-brand-text">{t('settings.autoUpdate')}</p>
            <p className="mt-1 text-xs text-brand-text-dim">{t('settings.autoUpdateHint')}</p>
          </div>
          <button
            onClick={handleToggleAutoUpdate}
            role="switch"
            aria-label={t('settings.autoUpdate')}
            aria-checked={settings?.autoUpdateCheck ?? true}
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              (settings?.autoUpdateCheck ?? true) ? 'bg-brand-cyan' : 'bg-brand-border'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-dark transition-all ${
                (settings?.autoUpdateCheck ?? true) ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('settings.language')}
        </h2>
        <p className="mb-4 text-xs text-brand-text-dim">{t('settings.languageHint')}</p>
        <div
          role="tablist"
          aria-label={t('settings.language')}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {SUPPORTED_LANGUAGES.map(({ code, nativeName }) => {
            const active = (settings?.language ?? 'de') === code
            return (
              <button
                key={code}
                role="tab"
                aria-selected={active}
                onClick={() => handleSetLanguage(code)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan'
                    : 'border-brand-border text-brand-text-dim hover:border-brand-border-hover'
                }`}
              >
                {nativeName}
              </button>
            )
          })}
        </div>
      </section>

      {/* Theme */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('settings.theme')}
        </h2>
        <div role="tablist" aria-label={t('settings.theme')} className="flex gap-2">
          {[
            { value: 'dark' as ThemeMode, label: t('settings.themeDark'), icon: Moon },
            { value: 'light' as ThemeMode, label: t('settings.themeLight'), icon: Sun },
            { value: 'system' as ThemeMode, label: t('settings.themeSystem'), icon: Laptop }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="tab"
              aria-selected={themeMode === value}
              onClick={() => setThemeMode(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                themeMode === value
                  ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan'
                  : 'border-brand-border text-brand-text-dim hover:border-brand-border-hover'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Ollama Connection */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('settings.ollama')}
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
              ? t('settings.connected')
              : starting
                ? t('settings.starting')
                : stopping
                  ? t('settings.stopping')
                  : installed
                    ? t('settings.inactive')
                    : t('settings.notInstalled')}
          </span>

          {connected && (
            <button
              onClick={stopOllama}
              disabled={stopping}
              title={t('settings.stopServer')}
              className="flex items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-2.5 py-1 text-xs font-medium text-brand-red transition-colors hover:bg-brand-red/20 disabled:opacity-50"
            >
              {stopping ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Square size={10} fill="currentColor" aria-hidden="true" />
              )}
              {t('settings.stop')}
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
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                {t('settings.startingServer')}
              </>
            ) : (
              <>
                <Play size={16} aria-hidden="true" />
                {t('settings.startServer')}
              </>
            )}
          </button>
        )}

        {!installed && !starting && (
          <div className="mt-4 rounded-xl border border-brand-amber/20 bg-brand-amber/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-brand-amber" aria-hidden="true" />
              <p className="text-sm text-brand-amber">{t('settings.notInstalledTitle')}</p>
            </div>
            <p className="text-xs text-brand-text-dim">
              {t('settings.notInstalledHintPrefix')}
              <a
                href="https://ollama.com/download"
                onClick={(e) => {
                  e.preventDefault()
                  window.open('https://ollama.com/download', '_blank')
                }}
                className="text-brand-cyan hover:underline"
              >
                ollama.com/download
              </a>
              {t('settings.notInstalledHintSuffix')}
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
          {t('settings.models')}
        </h2>

        {models.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-brand-text-dim">{t('settings.installed')}</p>
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
                    {selectedModel === m.name && <Check size={14} aria-hidden="true" />}
                    <span className="font-mono">{m.name}</span>
                    <span className="ml-auto text-xs text-brand-text-dim">
                      {(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(m.name)}
                    disabled={deleteDisabled}
                    aria-label={t('settings.deleteModel')}
                    title={
                      pulling
                        ? t('settings.waitDownload')
                        : isConfirmingDelete
                          ? t('settings.confirmDeleteHint')
                          : t('settings.deleteModel')
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      isConfirmingDelete
                        ? 'border-brand-red/40 bg-brand-red/20 text-brand-red'
                        : 'border-brand-border text-brand-text-dim hover:border-brand-red/30 hover:bg-brand-red/5 hover:text-brand-red'
                    }`}
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : isConfirmingDelete ? (
                      <>
                        <Trash2 size={12} aria-hidden="true" />
                        {t('settings.confirmDelete')}
                      </>
                    ) : (
                      <Trash2 size={14} aria-hidden="true" />
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
          <p className="text-xs text-brand-text-dim">{t('settings.recommendedModels')}</p>

          {/* CPU / GPU Tabs */}
          <div
            role="tablist"
            aria-label={t('settings.models')}
            className="flex gap-1 rounded-xl border border-brand-border bg-brand-dark/60 p-1"
          >
            <button
              role="tab"
              aria-selected={modelTab === 'cpu'}
              onClick={() => setModelTab('cpu')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                modelTab === 'cpu'
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-brand-text-dim hover:text-brand-text'
              }`}
            >
              <Cpu size={14} aria-hidden="true" />
              CPU ({cpuModels.length})
            </button>
            <button
              role="tab"
              aria-selected={modelTab === 'gpu'}
              onClick={() => setModelTab('gpu')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                modelTab === 'gpu'
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-brand-text-dim hover:text-brand-text'
              }`}
            >
              <Monitor size={14} aria-hidden="true" />
              GPU ({gpuModels.length})
            </button>
          </div>

          {modelTab === 'cpu' && (
            <div className="space-y-2">
              <p className="text-xs text-brand-text-dim">{t('settings.cpuHint')}</p>
              <div className="flex items-start gap-2 rounded-xl border border-brand-amber/20 bg-brand-amber/5 p-3">
                <Flag
                  size={12}
                  className="mt-0.5 flex-shrink-0 text-brand-amber"
                  aria-hidden="true"
                />
                <p className="text-xs text-brand-text-dim leading-relaxed">
                  {t('settings.budgetExplain')}
                </p>
              </div>
            </div>
          )}
          {modelTab === 'gpu' && (
            <p className="text-xs text-brand-text-dim">{t('settings.gpuHint')}</p>
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
              ? t('settings.requiresRam', { n: m.minRamGb })
              : !hasEnoughVram
                ? t('settings.requiresVram', { n: m.minVramGb })
                : null

            return (
              <div
                key={m.name}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity ${
                  isRecommended ? 'border-brand-cyan/20 bg-brand-cyan/5' : 'border-brand-border'
                } ${!canRun && !isInstalled ? 'opacity-50' : ''}`}
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-card text-brand-text-dim">
                  {m.runtime === 'cpu' ? (
                    <Cpu size={12} aria-hidden="true" />
                  ) : (
                    <Monitor size={12} aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-brand-text">{m.name}</span>
                    {isRecommended && (
                      <span className="rounded bg-brand-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-cyan">
                        {t('settings.recommended')}
                      </span>
                    )}
                    {m.budgetLaptopFriendly && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-brand-amber/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-amber"
                        title={t('settings.budgetTitle')}
                      >
                        <Flag size={8} aria-hidden="true" />
                        {t('settings.budgetBadge')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-text-dim">
                    {m.size} | {t(`settings.strengths.${m.name}`)}
                  </p>
                  {!canRun && !isInstalled && (
                    <p className="mt-1 text-xs text-brand-amber">{insufficientReason}</p>
                  )}
                </div>
                {isInstalled ? (
                  <Check size={16} className="text-brand-green" aria-hidden="true" />
                ) : isPulling ? (
                  <div className="flex items-center gap-2">
                    <Loader2
                      size={14}
                      className="animate-spin text-brand-cyan"
                      aria-hidden="true"
                    />
                    <span className="text-xs text-brand-text-dim">{pullProgress}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePull(m.name)}
                    disabled={!!pulling || !connected || !canRun}
                    title={!canRun ? (insufficientReason ?? '') : undefined}
                    className="flex items-center gap-1 rounded-lg bg-brand-cyan/10 px-3 py-1.5 text-xs text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={12} aria-hidden="true" />
                    {t('settings.pull')}
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
            {t('settings.hardware')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Cpu size={16} className="mt-0.5 text-brand-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm text-brand-text">{hardware.cpu.model}</p>
                <p className="text-xs text-brand-text-dim">
                  {t('settings.threads', { count: hardware.cpu.threads })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HardDrive size={16} className="mt-0.5 text-brand-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm text-brand-text">{hardware.ram.totalGb} GB RAM</p>
                <p className="text-xs text-brand-text-dim">
                  {t('settings.ramFree', { n: hardware.ram.freeGb })}
                </p>
              </div>
            </div>
            {hardware.gpu && (
              <div className="flex items-start gap-3">
                <Monitor size={16} className="mt-0.5 text-brand-cyan" aria-hidden="true" />
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
                  {t('settings.profile')}: {t(`profile.${hardware.profile}`)}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Logs */}
      <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('settings.logs')}
        </h2>
        <p className="mb-4 text-sm text-brand-text-dim">{t('settings.logsDesc')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.api.logs.openDirectory()}
            className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <FolderOpen size={14} aria-hidden="true" />
            {t('settings.openLogs')}
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
            <FileText size={14} aria-hidden="true" />
            {t('settings.copyPath')}
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
