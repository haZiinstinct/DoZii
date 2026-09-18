/**
 * Shared types used across main process, preload, and renderer.
 * This is the single source of truth for data shapes that cross the IPC boundary.
 */

import type { LanguageCode } from './languages'

// ============================================================================
// Analysis Modes
// ============================================================================

export type AnalysisMode =
  | 'plain'
  | 'grammar'
  | 'formulation'
  | 'arbeitszeugnis'
  | 'contract'
  | 'summary'
  | 'freeform'
  | 'letter'

/**
 * Reihenfolge wie in der UI angeboten: "Einfach erklaert" zuerst, weil es der
 * Modus fuer die Zielgruppe ist (Behoerdenpost verstehen). `letter` fehlt
 * bewusst - der Antwort-Generator wird nicht als Analyse-Modus angeboten,
 * sondern aus einem Ergebnis heraus gestartet.
 */
export const ANALYSIS_MODES = [
  'plain',
  'grammar',
  'formulation',
  'arbeitszeugnis',
  'contract',
  'summary',
  'freeform'
] as const satisfies readonly AnalysisMode[]

/** Alle Modi inkl. `letter` - fuer IPC-Validierung. */
export const ALL_ANALYSIS_MODES = [...ANALYSIS_MODES, 'letter'] as const

/** Briefarten des Antwort-Generators. */
export type LetterKind =
  | 'widerspruch'
  | 'einspruch'
  | 'zeugnis-nachbesserung'
  | 'mahnung-antwort'
  | 'kuendigung'
  | 'fristverlaengerung'
  | 'allgemein'

export const LETTER_KINDS = [
  'widerspruch',
  'einspruch',
  'zeugnis-nachbesserung',
  'mahnung-antwort',
  'kuendigung',
  'fristverlaengerung',
  'allgemein'
] as const satisfies readonly LetterKind[]

/**
 * Zusatzparameter fuer `analysis:run`. Bewusst ein Objekt statt weiterer
 * Positionsargumente, damit spaetere Modi ohne Signaturbruch dazukommen.
 */
export interface AnalysisExtra {
  /** Nur fuer mode 'letter': welche Briefart erzeugt werden soll. */
  letterKind?: LetterKind
  /** Optionale Vor-Analyse, auf die der Brief sich stuetzt (z.B. Zeugnis-Decoder). */
  sourceAnalysisId?: string
  /** Freitext des Nutzers ("mein Aktenzeichen ist ...", "ich war krank"). */
  userNotes?: string
}

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

/**
 * Listen-Variante ohne `extractedText`. Die Historie lud frueher jedes
 * Dokument samt Volltext in den Renderer - bei ein paar hundert Dokumenten
 * sind das schnell zweistellige Megabyte ueber IPC. Die Volltextsuche laeuft
 * jetzt im Main-Prozess (SQL), die Liste traegt nur noch einen Snippet.
 */
export interface DocumentSummary {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  pageCount: number | null
  wordCount: number | null
  detectedLanguage: string | null
  createdAt: string
  updatedAt: string
  /** Erste ~200 Zeichen des extrahierten Textes, fuer die Vorschau in der Liste. */
  snippet: string
}

/** Ergebnis eines Imports aus der Zwischenablage / eines eingefuegten Textes. */
export interface TextImportPayload {
  text: string
  /** Optionaler Titel; leer -> automatisch aus der ersten Zeile abgeleitet. */
  title?: string
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

/** Schriftgroesse der Oberflaeche - die Zielgruppe ist teils aelter. */
export type FontScale = 'normal' | 'large' | 'xlarge'

export interface AppSettings {
  ollamaUrl: string
  selectedModel: string
  language: LanguageCode
  theme: ThemeMode
  ocrLanguages: string[]
  ocrQuality: 'fast' | 'balanced' | 'best'
  firstLaunchDone: boolean
  /**
   * Automatischer Update-Check beim Start (GitHub Releases). Der einzige
   * Netzwerk-Call der App ausser Ollama - deshalb abschaltbar.
   */
  autoUpdateCheck: boolean
  /**
   * Ein-Klick-Flow: nach dem Import direkt in den vom Ersteindruck
   * empfohlenen Modus springen, statt den Nutzer Modi waehlen zu lassen.
   */
  autoAnalyze: boolean
  /** Schriftgroesse (Barrierefreiheit). */
  fontScale: FontScale
  /** Erhoehter Kontrast (Barrierefreiheit). */
  highContrast: boolean
  /** Beim Export personenbezogene Daten standardmaessig schwaerzen. */
  redactOnExport: boolean
  /**
   * num_ctx automatisch aus dem Kontextfenster des Modells ableiten
   * (statt fest 8192). Abschaltbar fuer Nutzer mit knappem RAM.
   */
  autoContextWindow: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  selectedModel: '',
  language: 'de',
  theme: 'dark',
  ocrLanguages: ['deu', 'eng'],
  ocrQuality: 'balanced',
  firstLaunchDone: false,
  autoUpdateCheck: true,
  autoAnalyze: true,
  fontScale: 'normal',
  highContrast: false,
  redactOnExport: false,
  autoContextWindow: true
}

// ============================================================================
// Updates
// ============================================================================

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; version: string }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

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

// ============================================================================
// Fristen-Radar
// ============================================================================

/**
 * Fristarten, die DoZii kennt. Die Dauer kommt NICHT vom Modell, sondern aus
 * dem Regelkatalog in `@shared/deadline-rules` - Modelle rechnen mit Daten
 * notorisch falsch. Das Modell liefert nur den Anker (Startdatum + Zitat).
 */
export type DeadlineKind =
  | 'widerspruch'
  | 'einspruch'
  | 'klage'
  | 'zahlung'
  | 'widerruf'
  | 'kuendigung'
  | 'mitwirkung'
  | 'sonstige'

export type DeadlineConfidence = 'high' | 'medium' | 'low'

/** Zeiteinheit einer Frist. */
export type DeadlinePeriodUnit = 'day' | 'week' | 'month' | 'year'

/**
 * Roh-Anker, wie ihn das Modell aus dem Dokument liest. Enthaelt bewusst
 * KEIN berechnetes Enddatum - das macht `computeDeadline` deterministisch.
 */
export interface DeadlineAnchor {
  kind: DeadlineKind
  /** Kurzbezeichnung fuer die UI, z.B. "Widerspruch gegen den Bescheid". */
  label: string
  /** Bezugsdatum (Bescheiddatum, Zustellung, Rechnungsdatum) als ISO-Datum. */
  startDateIso: string | null
  /** Woertliches Zitat, aus dem das Startdatum stammt. */
  startDateQuote: string | null
  /** Woertliche Fristangabe aus dem Text, z.B. "innerhalb eines Monats". */
  periodText: string | null
  periodValue: number | null
  periodUnit: DeadlinePeriodUnit | null
  /** Bereits im Dokument genanntes konkretes Enddatum (hat Vorrang). */
  explicitDueDateIso: string | null
  /** Woertliches Zitat der Fristklausel - Beleg fuer den Nutzer. */
  quote: string
  confidence: DeadlineConfidence
}

/** Berechnete, gespeicherte Frist. */
export interface Deadline {
  id: string
  documentId: string
  kind: DeadlineKind
  label: string
  /** Enddatum als ISO-Datum (YYYY-MM-DD), bereits auf Werktag geschoben. */
  dueDateIso: string
  startDateIso: string | null
  periodText: string | null
  quote: string
  confidence: DeadlineConfidence
  /** 'explicit' = Datum stand im Dokument, 'computed' = aus Regel berechnet. */
  source: 'explicit' | 'computed'
  /** Hinweis zur Berechnung, z.B. "auf Montag verschoben (Fristende Samstag)". */
  note: string | null
  createdAt: string
}

export interface DeadlineWithDocument extends Deadline {
  filename: string
}

// ============================================================================
// Export
// ============================================================================

export type ExportFormat = 'pdf' | 'markdown' | 'rtf' | 'txt'

export interface ExportRequest {
  analysisId: string
  format: ExportFormat
  /** Personenbezogene Daten vor dem Export maskieren. */
  redact: boolean
}

export interface ExportResult {
  ok: boolean
  path?: string
  error?: string
  /** Anzahl geschwaerzter Fundstellen (nur wenn redact aktiv war). */
  redactedCount?: number
}

// ============================================================================
// Analyse-Fortschritt (Phasen-Events)
// ============================================================================

/**
 * Was die Analyse gerade tut. Frueher nur 'analyzing' | 'verifying' - mit
 * Chunking und Fristensuche braucht die UI mehr Zwischenstaende, sonst steht
 * bei langen Dokumenten minutenlang "Analysiere..." ohne Fortschritt.
 */
export type AnalysisPhaseEvent =
  | { kind: 'analyzing' }
  | { kind: 'verifying' }
  | { kind: 'chunk'; current: number; total: number }
  | { kind: 'merging' }
  | { kind: 'deadlines' }
