import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AnalysisMode,
  AnalysisRunResult,
  AppSettings,
  ChatMessage,
  DoziiDocument,
  FirstImpression,
  HardwareInfo,
  LogLevel,
  OllamaConnectionStatus,
  OllamaInstallation,
  OllamaModel,
  OllamaStartResult,
  PullProgress,
  SystemMetrics
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
    reImport: (
      id: string
    ): Promise<{ ok: true; doc: DoziiDocument } | { ok: false; error: string }> =>
      ipcRenderer.invoke('documents:reImport', id),
    getFirstImpression: (id: string): Promise<FirstImpression | null> =>
      ipcRenderer.invoke('documents:getFirstImpression', id),
    generateFirstImpression: (id: string): Promise<FirstImpression | null> =>
      ipcRenderer.invoke('documents:generateFirstImpression', id),
    getFilePath: (file: File): string => webUtils.getPathForFile(file),
    getAll: (): Promise<DoziiDocument[]> => ipcRenderer.invoke('documents:getAll'),
    getById: (id: string): Promise<DoziiDocument | undefined> =>
      ipcRenderer.invoke('documents:getById', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('documents:delete', id)
  },

  // Analysis
  analysis: {
    run: (
      docId: string,
      mode: AnalysisMode,
      userQuestion?: string
    ): Promise<AnalysisRunResult | null> =>
      ipcRenderer.invoke('analysis:run', docId, mode, userQuestion),
    abort: (): Promise<void> => ipcRenderer.invoke('analysis:abort'),
    onChunk: subscribe<string>('analysis:chunk'),
    onPhase: subscribe<'analyzing' | 'verifying'>('analysis:phase'),
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

  // Export
  exporter: {
    analysisAsPdf: (analysisId: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('exporter:analysisAsPdf', analysisId)
  },

  // System metrics (live hardware + runtime info for the Sidebar indicator)
  system: {
    getMetrics: (): Promise<SystemMetrics> => ipcRenderer.invoke('system:getMetrics')
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
