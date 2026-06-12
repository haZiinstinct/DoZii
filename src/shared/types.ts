/**
 * Shared types used across main process, preload, and renderer.
 * This is the single source of truth for data shapes that cross the IPC boundary.
 */

// ============================================================================
// Analysis Modes
// ============================================================================

export type AnalysisMode = 'grammar' | 'formulation' | 'arbeitszeugnis' | 'summary' | 'freeform'

// ============================================================================
// Hardware
// ============================================================================

export type HardwareProfile = 'minimal' | 'light' | 'medium' | 'strong' | 'power'
export type GpuVendor = 'nvidia' | 'amd' | 'intel' | 'unknown'

export interface GpuInfo {
  name: string
  vramMb: number
  vendor: GpuVendor
}

export interface HardwareInfo {
  cpu: {
    model: string
    logicalCpus: number
    threads: number
  }
  ram: {
    totalGb: number
    freeGb: number
  }
  gpu: GpuInfo | null
  os: {
    platform: string
    version: string
    arch: string
  }
  profile: HardwareProfile
  recommendedModel: string
}

// ============================================================================
// Documents (mirrors DB schema)
// ============================================================================

export interface DoziiDocument {
  id: string
  filename: string
  originalPath: string
  mimeType: string
  fileSize: number
  pageCount: number | null
  wordCount: number | null
  detectedLanguage: string | null
  extractedText: string
  thumbnailPath: string | null
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Analysis results (mirrors DB schema)
// ============================================================================

export interface Analysis {
  id: string
  documentId: string
  mode: string
  prompt: string
  result: string
  structuredResult: string | null
  modelUsed: string
  durationMs: number | null
  createdAt: string
}

export interface AnalysisRunResult {
  analysis: Analysis
  aborted: boolean
}

// ============================================================================
// Chat messages
// ============================================================================

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  documentId: string
  role: ChatRole
  content: string
  modelUsed: string | null
  createdAt: string
}

// ============================================================================
// Ollama
// ============================================================================

export interface OllamaConnectionStatus {
  connected: boolean
  error?: string
}

export interface OllamaInstallation {
  installed: boolean
  binaryPath: string | null
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
}

export interface OllamaStartResult {
  started: boolean
  error?: string
}

export interface PullProgress {
  status: string
  completed?: number
  total?: number
}

// ============================================================================
// First Impression (auto-generated classification on document import)
// ============================================================================

export type DocumentTypeCategory =
  | 'arbeitszeugnis'
  | 'vertrag'
  | 'brief'
  | 'rechnung'
  | 'bescheid'
  | 'zeugnis'
  | 'bewerbung'
  | 'sonstiges'

export interface FirstImpression {
  documentId: string
  documentType: DocumentTypeCategory | string
  recommendedMode: AnalysisMode
  firstImpression: string
  modelUsed: string
  createdAt: string
}

export type ModelRuntime = 'cpu' | 'gpu'

export interface SuggestedModel {
  name: string // Ollama tag, e.g. 'qwen2.5:7b'
  displayName: string // Human-friendly name
  size: string // '~4.7 GB'
  minRamGb: number // For graying out on insufficient hardware
  minVramGb?: number // Optional, for GPU models
  runtime: ModelRuntime // Which tab
  strengths: string // 'Stark in Deutsch + JSON'
  recommended?: boolean // Show EMPFOHLEN badge
  budgetLaptopFriendly?: boolean // Runs on weak hardware + can still decode Arbeitszeugnisse
}

// ============================================================================
// Settings (persisted)
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'system'

export interface AppSettings {
  ollamaUrl: string
  selectedModel: string
  language: 'de' | 'en'
  theme: ThemeMode
  ocrLanguages: string[]
  ocrQuality: 'fast' | 'balanced' | 'best'
  firstLaunchDone: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  selectedModel: '',
  language: 'de',
  theme: 'dark',
  ocrLanguages: ['deu', 'eng'],
  ocrQuality: 'balanced',
  firstLaunchDone: false
}

// ============================================================================
// Logs
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// ============================================================================
// Pull progress events
// ============================================================================

export type PullProgressEvent = PullProgress

// ============================================================================
// System metrics (live hardware + runtime info for the Sidebar indicator)
// ============================================================================

export interface LoadedModelInfo {
  name: string
  sizeBytes: number
  sizeVramBytes: number
  runningOn: 'gpu' | 'cpu' | 'hybrid'
  vramPercent: number
}

export interface SystemMetrics {
  cpuLoadPercent: number
  ramUsedGb: number
  ramTotalGb: number
  ramUsedPercent: number
  loadedModels: LoadedModelInfo[]
  activeStreamCount: number
}
