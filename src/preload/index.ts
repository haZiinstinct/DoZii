import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AnalysisExtra,
  AnalysisMode,
  AnalysisPhaseEvent,
  AnalysisRunResult,
  AppSettings,
  ChatMessage,
  Deadline,
  DeadlineScanResult,
  DeadlineWithDocument,
  DocumentSummary,
  DoziiDocument,
  ExportRequest,
  ExportResult,
  FirstImpression,
  HardwareInfo,
  LogLevel,
  OllamaConnectionStatus,
  OllamaInstallation,
  OllamaModel,
  OllamaStartResult,
  PullProgress,
  SystemMetrics,
  TextImportPayload,
  UpdateStatus
} from '@shared/types'

/**
 * Subscribe to a main-process event channel. Returns an unsubscribe function.
 * This factorizes the repeated on/removeListener boilerplate.
 */
function subscribe<T>(channel: string) {
  return (callback: (value: T) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: T): void => callback(value)
    ipcRenderer.on(channel, handler)
    return (): void => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

export const api = {
  // Window controls (frameless window)
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized')
  },

  // Documents
  documents: {
    openDialog: (): Promise<string[]> => ipcRenderer.invoke('documents:openDialog'),
    openDirectoryDialog: (): Promise<string[]> =>
      ipcRenderer.invoke('documents:openDirectoryDialog'),
    import: (filePath: string): Promise<DoziiDocument> =>
      ipcRenderer.invoke('documents:import', filePath),
    /** Direkt eingefuegter Text (Zwischenablage) statt einer Datei. */
    importText: (payload: TextImportPayload): Promise<DoziiDocument> =>
      ipcRenderer.invoke('documents:importText', payload),
    reImport: (
      id: string
    ): Promise<{ ok: true; doc: DoziiDocument } | { ok: false; error: string }> =>
      ipcRenderer.invoke('documents:reImport', id),
    getFirstImpression: (id: string): Promise<FirstImpression | null> =>
      ipcRenderer.invoke('documents:getFirstImpression', id),
    generateFirstImpression: (id: string): Promise<FirstImpression | null> =>
      ipcRenderer.invoke('documents:generateFirstImpression', id),
    getFilePath: (file: File): string => webUtils.getPathForFile(file),
    /** Liste ohne Volltext - der Volltext bleibt im Main-Prozess. */
    getAll: (): Promise<DocumentSummary[]> => ipcRenderer.invoke('documents:getAll'),
    /** Volltextsuche in SQLite (Dateiname + Inhalt). */
    search: (query: string): Promise<DocumentSummary[]> =>
      ipcRenderer.invoke('documents:search', query),
    getById: (id: string): Promise<DoziiDocument | undefined> =>
      ipcRenderer.invoke('documents:getById', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('documents:delete', id),
    /** Fortschritt der Texterkennung waehrend eines Imports (nur bei Scans). */
    onImportProgress: subscribe<{ page: number; total: number }>('documents:importProgress'),
    /** Der Ersteindruck wird nach dem Import im Hintergrund erzeugt. */
    onFirstImpression: subscribe<FirstImpression>('documents:firstImpression')
  },

  // Analysis
  analysis: {
    run: (
      docId: string,
      mode: AnalysisMode,
      userQuestion?: string,
      extra?: AnalysisExtra
    ): Promise<AnalysisRunResult | null> =>
      ipcRenderer.invoke('analysis:run', docId, mode, userQuestion, extra),
    abort: (): Promise<void> => ipcRenderer.invoke('analysis:abort'),
    onChunk: subscribe<string>('analysis:chunk'),
    onPhase: subscribe<AnalysisPhaseEvent>('analysis:phase'),
    onComplete: subscribe<AnalysisRunResult>('analysis:complete'),
    onError: subscribe<string>('analysis:error'),
    getHistory: (docId: string) => ipcRenderer.invoke('analysis:getHistory', docId),
    getAll: () => ipcRenderer.invoke('analysis:getAll')
  },

  // Chat (follow-up conversation per document)
  chat: {
    send: (documentId: string, message: string): Promise<ChatMessage | null> =>
      ipcRenderer.invoke('chat:send', documentId, message),
    abort: (): Promise<void> => ipcRenderer.invoke('chat:abort'),
    getHistory: (documentId: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke('chat:getHistory', documentId),
    clearHistory: (documentId: string): Promise<void> =>
      ipcRenderer.invoke('chat:clearHistory', documentId),
    onChunk: subscribe<string>('chat:chunk'),
    onComplete: subscribe<ChatMessage>('chat:complete'),
    onError: subscribe<string>('chat:error')
  },

  // Hardware detection
  hardware: {
    detect: (): Promise<HardwareInfo> => ipcRenderer.invoke('hardware:detect')
  },

  // Ollama
  ollama: {
    getStatus: (): Promise<OllamaConnectionStatus> => ipcRenderer.invoke('ollama:status'),
    detectInstallation: (): Promise<OllamaInstallation> =>
      ipcRenderer.invoke('ollama:detectInstallation'),
    start: (): Promise<OllamaStartResult> => ipcRenderer.invoke('ollama:start'),
    stop: (): Promise<{ stopped: boolean; error?: string }> => ipcRenderer.invoke('ollama:stop'),
    listModels: (): Promise<OllamaModel[]> => ipcRenderer.invoke('ollama:listModels'),
    pullModel: (name: string): Promise<void> => ipcRenderer.invoke('ollama:pullModel', name),
    deleteModel: (name: string): Promise<void> => ipcRenderer.invoke('ollama:deleteModel', name),
    selectModel: (name: string): Promise<void> => ipcRenderer.invoke('ollama:selectModel', name),
    onPullProgress: subscribe<PullProgress>('ollama:pullProgress')
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', partial),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset')
  },

  // Logs
  logs: {
    write: (level: LogLevel, source: string, message: string, meta?: unknown): Promise<void> =>
      ipcRenderer.invoke('logs:write', level, source, message, meta),
    openDirectory: (): Promise<string | null> => ipcRenderer.invoke('logs:openDirectory'),
    getCurrentFile: (): Promise<string | null> => ipcRenderer.invoke('logs:getCurrentFile')
  },

  // Fristen-Radar
  deadlines: {
    /** Gespeicherte Fristen eines Dokuments. */
    forDocument: (documentId: string): Promise<Deadline[]> =>
      ipcRenderer.invoke('deadlines:forDocument', documentId),
    /** Alle noch offenen Fristen, nach Faelligkeit sortiert - fuer die Sidebar. */
    upcoming: (): Promise<DeadlineWithDocument[]> => ipcRenderer.invoke('deadlines:upcoming'),
    /**
     * Dokument erneut nach Fristen durchsuchen (ein kleiner Modell-Durchlauf).
     * `ok: false` heisst "Suche gescheitert", nicht "keine Frist vorhanden".
     */
    scan: (documentId: string): Promise<DeadlineScanResult> =>
      ipcRenderer.invoke('deadlines:scan', documentId),
    /** Fristen als Kalenderdatei speichern. documentId weglassen = alle offenen. */
    exportIcs: (documentId?: string): Promise<ExportResult> =>
      ipcRenderer.invoke('deadlines:exportIcs', documentId),
    /** Feuert, wenn die Hintergrundsuche nach einer Analyse Fristen gefunden hat. */
    onUpdated: subscribe<{ documentId: string; count: number }>('deadlines:updated')
  },

  // Export
  exporter: {
    analysisAsPdf: (analysisId: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('exporter:analysisAsPdf', analysisId),
    /** Export in PDF, Markdown, Text oder Word-kompatibles RTF, optional geschwaerzt. */
    analysis: (request: ExportRequest): Promise<ExportResult> =>
      ipcRenderer.invoke('exporter:analysis', request)
  },

  // System metrics (live hardware + runtime info for the Sidebar indicator)
  system: {
    getMetrics: (): Promise<SystemMetrics> => ipcRenderer.invoke('system:getMetrics')
  },

  // Auto-Update (GitHub Releases)
  update: {
    getState: (): Promise<{ appVersion: string; status: UpdateStatus }> =>
      ipcRenderer.invoke('update:getState'),
    check: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:check'),
    download: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatus: subscribe<UpdateStatus>('update:status')
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
