import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { GpuInfo, HardwareInfo, HardwareProfile } from '@shared/types'
import { logger } from './logger.service'

const execFileAsync = promisify(execFile)

async function detectNvidiaGpu(): Promise<GpuInfo | null> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 5000 }
    )
    const output = stdout.trim()
    if (!output) return null
    const [name, vramStr] = output.split(',').map((s) => s.trim())
    const gpu: GpuInfo = {
      name: name || 'NVIDIA GPU',
      vramMb: parseInt(vramStr || '0', 10),
      vendor: 'nvidia'
    }
    logger.info('hardware-detector', 'nvidia-smi detected GPU', gpu)
    return gpu
  } catch (err) {
    logger.debug('hardware-detector', 'nvidia-smi probe failed', {
      code: (err as NodeJS.ErrnoException)?.code,
      message: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

async function detectAmdGpu(): Promise<GpuInfo | null> {
  try {
    const { stdout } = await execFileAsync('rocm-smi', ['--showmeminfo', 'vram', '--csv'], {
      encoding: 'utf8',
      timeout: 5000
    })
    const output = stdout.trim()
    if (!output) return null
    const lines = output.split('\n')
    if (lines.length < 2) return null
    const totalMatch = lines[1]?.match(/(\d+)/)
    const vramMb = totalMatch ? parseInt(totalMatch[1], 10) / (1024 * 1024) : 0
    const gpu: GpuInfo = {
      name: 'AMD GPU',
      vramMb: Math.round(vramMb),
      vendor: 'amd'
    }
    logger.info('hardware-detector', 'rocm-smi detected GPU', gpu)
    return gpu
  } catch (err) {
    logger.debug('hardware-detector', 'rocm-smi probe failed', {
      code: (err as NodeJS.ErrnoException)?.code,
      message: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

/**
 * Classify GPU vendor from a device name string.
 */
function classifyGpuVendor(name: string): GpuInfo['vendor'] {
  const nameLower = name.toLowerCase()
  if (
    nameLower.includes('nvidia') ||
    nameLower.includes('geforce') ||
    nameLower.includes('rtx') ||
    nameLower.includes('gtx') ||
    nameLower.includes('quadro')
  ) {
    return 'nvidia'
  }
  if (nameLower.includes('amd') || nameLower.includes('radeon') || nameLower.includes('firepro')) {
    return 'amd'
  }
  if (nameLower.includes('intel') || nameLower.includes('arc')) {
    return 'intel'
  }
  return 'unknown'
}

/**
 * Windows GPU detection via the registry QWORD `HardwareInformation.qwMemorySize`.
 *
 * Why not Win32_VideoController.AdapterRAM? That property is a DWORD (32-bit uint)
 * which caps at ~4.29 GB - a 12/24 GB GPU shows as 4 GB. Microsoft deprecated it
 * years ago. The registry value is a QWORD (64-bit) and reports the real VRAM.
 *
 * Registry path:
 *   HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\NNNN
 * where NNNN are numeric subkeys per installed display adapter.
 */
async function detectWindowsGpuViaPowerShell(): Promise<GpuInfo | null> {
  if (process.platform !== 'win32') return null
  try {
    // Enumerate all display adapter subkeys, read qwMemorySize + DriverDesc,
    // pick the one with the largest VRAM. WMI fallback for integrated GPUs
    // that don't expose qwMemorySize.
    const script = `
$path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'
$gpu = Get-ChildItem $path -ErrorAction SilentlyContinue |
  ForEach-Object {
    $p = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
    if ($p -and $p.'HardwareInformation.qwMemorySize' -and $p.DriverDesc) {
      [PSCustomObject]@{
        Name = $p.DriverDesc
        VramBytes = [int64]$p.'HardwareInformation.qwMemorySize'
      }
    }
  } |
  Sort-Object VramBytes -Descending |
  Select-Object -First 1
if ($gpu) {
  $gpu | ConvertTo-Json -Compress
} else {
  # Fallback: WMI CIM (capped at 4 GB but works for integrated GPUs)
  $wmi = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    Sort-Object AdapterRAM -Descending |
    Select-Object -First 1
  if ($wmi) {
    [PSCustomObject]@{
      Name = $wmi.Name
      VramBytes = [int64]$wmi.AdapterRAM
    } | ConvertTo-Json -Compress
  }
}
`.trim()

    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 10000 }
    )
    const output = stdout.trim()

    if (!output) return null

    const parsed = JSON.parse(output) as { Name?: string; VramBytes?: number }
    const name = parsed.Name?.trim() || 'Unknown GPU'
    const vramBytes = Number(parsed.VramBytes ?? 0)
    const vramMb = Math.round(vramBytes / (1024 * 1024))
    const vendor = classifyGpuVendor(name)

    const gpu: GpuInfo = { name, vramMb, vendor }
    logger.info('hardware-detector', 'Windows registry detected GPU', {
      ...gpu,
      vramBytes
    })
    return gpu
  } catch (err) {
    logger.debug('hardware-detector', 'Windows GPU probe failed', {
      code: (err as NodeJS.ErrnoException)?.code,
      message: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

async function detectGpu(): Promise<GpuInfo | null> {
  return (
    (await detectNvidiaGpu()) || (await detectAmdGpu()) || (await detectWindowsGpuViaPowerShell())
  )
}

// GPU + CPU-Modell aendern sich zur Laufzeit nicht -> einmal erkennen und cachen.
// Verhindert wiederholte (blockierende) PowerShell/Tool-Aufrufe bei jedem
// hardware:detect bzw. Metrics-Poll.
let cachedGpu: GpuInfo | null | undefined
async function detectGpuCached(): Promise<GpuInfo | null> {
  if (cachedGpu === undefined) {
    cachedGpu = await detectGpu()
  }
  return cachedGpu
}

function determineProfile(ramGb: number, gpu: GpuInfo | null): HardwareProfile {
  const vramGb = gpu ? gpu.vramMb / 1024 : 0

  if (ramGb >= 64 || vramGb >= 24) return 'power'
  if (ramGb >= 32 || vramGb >= 12) return 'strong'
  if (ramGb >= 16 || vramGb >= 6) return 'medium'
  if (ramGb >= 8) return 'light'
  return 'minimal'
}

const MODEL_MAP: Record<HardwareProfile, string> = {
  minimal: 'gemma3:1b',
  light: 'qwen2.5:3b', // was llama3.2:3b - Qwen is stronger at German + JSON
  medium: 'qwen2.5:7b', // was llama3.1:8b - Qwen is stronger at German + JSON
  strong: 'mistral-small:24b',
  power: 'llama3.1:70b'
}

export async function detectHardware(): Promise<HardwareInfo> {
  const cpus = os.cpus()
  const totalRam = os.totalmem()
  const freeRam = os.freemem()
  const totalGb = Math.round((totalRam / (1024 * 1024 * 1024)) * 10) / 10
  const freeGb = Math.round((freeRam / (1024 * 1024 * 1024)) * 10) / 10

  // cpus.length = logical CPUs (including hyperthreading).
  // For "threads" use the same. For a physical-core estimate divide by 2 as a
  // rough heuristic (can't detect hyperthreading reliably from Node).
  const logicalCpus = cpus.length
  const threads = logicalCpus

  const gpu = await detectGpuCached()
  const profile = determineProfile(totalGb, gpu)

  const info: HardwareInfo = {
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      logicalCpus,
      threads
    },
    ram: { totalGb, freeGb },
    gpu,
    os: {
      platform: process.platform,
      version: os.release(),
      arch: os.arch()
    },
    profile,
    recommendedModel: MODEL_MAP[profile]
  }

  logger.info('hardware-detector', 'Hardware detected', {
    profile,
    ramGb: totalGb,
    logicalCpus,
    hasGpu: !!gpu,
    gpuVendor: gpu?.vendor
  })

  return info
}
