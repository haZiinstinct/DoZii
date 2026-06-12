import os from 'os'
import {
  getActiveStreamCount,
  listLoadedModels,
  type LoadedModelRaw
} from './ollama-client.service'
import { detectHardware } from './hardware-detector.service'
import type { SystemMetrics, LoadedModelInfo } from '@shared/types'

// ============================================================================
// CPU delta sampling
// ============================================================================
// os.loadavg() returns [0, 0, 0] on Windows, so we have to compute CPU load
// ourselves by diffing two snapshots of os.cpus() times.

type CpuSample = ReturnType<typeof os.cpus>
let lastCpuSample: CpuSample | null = null

function sampleCpuLoad(): number {
  const current = os.cpus()
  if (!lastCpuSample || lastCpuSample.length !== current.length) {
    lastCpuSample = current
    return 0 // first call has no delta
  }

  let totalDelta = 0
  let idleDelta = 0
  for (let i = 0; i < current.length; i++) {
    const prev = lastCpuSample[i]
    const now = current[i]
    if (!prev || !now) continue
    const prevTotal =
      prev.times.user + prev.times.nice + prev.times.sys + prev.times.idle + prev.times.irq
    const nowTotal =
      now.times.user + now.times.nice + now.times.sys + now.times.idle + now.times.irq
    totalDelta += nowTotal - prevTotal
    idleDelta += now.times.idle - prev.times.idle
  }

  lastCpuSample = current
  if (totalDelta <= 0) return 0
  const loadPercent = ((totalDelta - idleDelta) / totalDelta) * 100
  return Math.max(0, Math.min(100, Math.round(loadPercent)))
}

// ============================================================================
// Runtime VRAM reference (from initial hardware detection)
// ============================================================================
// We capture the detected GPU's total VRAM once so we can compute VRAM %.
// The hardware detector is called lazily to avoid circular init issues.

let gpuVramTotalMb = -1 // -1 = not yet detected; 0 = no GPU; >0 = detected

function getGpuVramTotalMb(): number {
  if (gpuVramTotalMb < 0) {
    try {
      const hw = detectHardware()
      gpuVramTotalMb = hw.gpu?.vramMb ?? 0
    } catch {
      gpuVramTotalMb = 0
    }
  }
  return gpuVramTotalMb
}

// ============================================================================
// Loaded model classification
// ============================================================================

function classifyLoadedModel(raw: LoadedModelRaw): LoadedModelInfo {
  const totalVramMb = getGpuVramTotalMb()
  const vramMb = raw.sizeVram / (1024 * 1024)

  // runningOn: gpu if all weights fit in VRAM, cpu if no VRAM at all,
  // hybrid if only part of the model is in VRAM.
  let runningOn: LoadedModelInfo['runningOn']
  if (raw.sizeVram === 0) {
    runningOn = 'cpu'
  } else if (raw.sizeVram >= raw.size * 0.95) {
    runningOn = 'gpu'
  } else {
    runningOn = 'hybrid'
  }

  const vramPercent = totalVramMb > 0 ? Math.round((vramMb / totalVramMb) * 100) : 0

  return {
    name: raw.name,
    sizeBytes: raw.size,
    sizeVramBytes: raw.sizeVram,
    runningOn,
    vramPercent: Math.max(0, Math.min(100, vramPercent))
  }
}

// ============================================================================
// Public API
// ============================================================================

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const cpuLoadPercent = sampleCpuLoad()

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const ramTotalGb = Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10
  const ramUsedGb = Math.round(((totalMem - freeMem) / (1024 * 1024 * 1024)) * 10) / 10
  const ramUsedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100)

  const raw = await listLoadedModels()
  const loadedModels = raw.map(classifyLoadedModel)

  return {
    cpuLoadPercent,
    ramUsedGb,
    ramTotalGb,
    ramUsedPercent,
    loadedModels,
    activeStreamCount: getActiveStreamCount()
  }
}
