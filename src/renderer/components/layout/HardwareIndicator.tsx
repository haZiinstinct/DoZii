import { useEffect, useState } from 'react'
import { Cpu, MemoryStick, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { HardwareInfo, LoadedModelInfo } from '@shared/types'
import { useSystemMetrics } from '@/hooks/useSystemMetrics'

/**
 * Pick the "primary" loaded model - the biggest one. Usually there's only
 * one, but Ollama can have multiple loaded at once if the user switches.
 */
function pickPrimaryModel(models: LoadedModelInfo[]): LoadedModelInfo | null {
  if (models.length === 0) return null
  return [...models].sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
}

/**
 * Color a utilization bar based on load: cyan < 80%, amber < 95%, red >= 95%.
 */
function barColor(percent: number): string {
  if (percent >= 95) return 'bg-brand-red'
  if (percent >= 80) return 'bg-brand-amber'
  return 'bg-brand-cyan'
}

interface BarRowProps {
  label: string
  icon: React.ReactNode
  percent: number
  detail?: string
}

function BarRow({ label, icon, percent, detail }: BarRowProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-brand-text-dim">
        <span className="flex h-3 w-3 items-center justify-center">{icon}</span>
        <span className="font-mono uppercase tracking-wider">{label}</span>
        <span className="ml-auto font-mono tabular-nums text-brand-text">{clamped}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-brand-card">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {detail && <p className="pl-[18px] text-[9px] text-brand-text-dim/70">{detail}</p>}
    </div>
  )
}

export function HardwareIndicator() {
  const { t } = useTranslation()
  const { metrics } = useSystemMetrics()
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)

  // Fetch static hardware once for the profile label
  useEffect(() => {
    window.api.hardware
      .detect()
      .then(setHardware)
      .catch(() => {
        /* ignore - indicator still works without profile label */
      })
  }, [])

  const primaryModel = metrics ? pickPrimaryModel(metrics.loadedModels) : null
  const isActive = (metrics?.activeStreamCount ?? 0) > 0

  return (
    <div className="rounded-xl border border-brand-border bg-brand-card/40 p-3">
      {/* Model + runtime badge */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles
          size={11}
          className={
            isActive
              ? 'animate-pulse text-brand-cyan'
              : primaryModel
                ? 'text-brand-cyan'
                : 'text-brand-text-dim/50'
          }
        />
        {primaryModel ? (
          <>
            <span
              className={`flex-1 truncate font-mono text-[11px] ${
                isActive ? 'text-brand-cyan' : 'text-brand-text'
              }`}
              title={primaryModel.name}
            >
              {primaryModel.name}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                primaryModel.runningOn === 'gpu'
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : primaryModel.runningOn === 'hybrid'
                    ? 'bg-brand-amber/20 text-brand-amber'
                    : 'bg-brand-text-dim/20 text-brand-text-dim'
              }`}
              title={
                primaryModel.runningOn === 'gpu'
                  ? t('hardware.runsGpu')
                  : primaryModel.runningOn === 'hybrid'
                    ? t('hardware.runsHybrid')
                    : t('hardware.runsCpu')
              }
            >
              {primaryModel.runningOn}
            </span>
          </>
        ) : (
          <span className="flex-1 text-[11px] text-brand-text-dim/70">
            {metrics ? t('hardware.noModel') : t('hardware.waiting')}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <BarRow label="CPU" icon={<Cpu size={10} />} percent={metrics?.cpuLoadPercent ?? 0} />
        <BarRow
          label="RAM"
          icon={<MemoryStick size={10} />}
          percent={metrics?.ramUsedPercent ?? 0}
          detail={
            metrics
              ? `${metrics.ramUsedGb.toFixed(1)} / ${metrics.ramTotalGb.toFixed(1)} GB`
              : undefined
          }
        />
      </div>

      {/* Profile footer */}
      {hardware && (
        <p className="mt-3 border-t border-brand-border pt-2 text-[9px] uppercase tracking-wider text-brand-text-dim">
          {t('hardware.profile')}:{' '}
          <span className="text-brand-text-dim">{t(`profile.${hardware.profile}`)}</span>
        </p>
      )}
    </div>
  )
}
