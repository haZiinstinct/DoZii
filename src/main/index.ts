import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerWindowIpc } from './ipc/window.ipc'
import { registerHardwareIpc } from './ipc/hardware.ipc'
import { registerOllamaIpc } from './ipc/ollama.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerDocumentsIpc } from './ipc/documents.ipc'
import { registerAnalysisIpc } from './ipc/analysis.ipc'
import { registerChatIpc } from './ipc/chat.ipc'
import { registerLogsIpc } from './ipc/logs.ipc'
import { registerExporterIpc } from './ipc/exporter.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { registerUpdateIpc } from './ipc/update.ipc'
import { initUpdater } from './services/updater.service'
import { closeDb, getDb } from './db'
import { logger, initLogger } from './services/logger.service'
import { abortAllStreams } from './services/ollama-client.service'
import { shutdownOcr } from './services/ocr.service'

/**
 * Build the Content-Security-Policy. In production we drop `'unsafe-inline'`
 * for scripts (keeping it only for styles because Tailwind injects them).
 * In dev we allow inline scripts because Vite HMR needs them.
 */
function buildCsp(): string {
  const scriptSrc = is.dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  return (
    "default-src 'self'; " +
    "connect-src 'self' http://localhost:11434; " +
    "font-src 'self'; " +
    "img-src 'self' data: blob:; " +
    "style-src 'self' 'unsafe-inline'; " +
    scriptSrc
  )
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win

  // CSP: blocks ALL external requests - only localhost:11434 (Ollama) allowed.
  session.defaultSession.webRequest.onHeadersReceived((_details, callback) => {
    callback({
      responseHeaders: {
        ...(_details.responseHeaders || {}),
        'Content-Security-Policy': [buildCsp()]
      }
    })
  })

  win.on('ready-to-show', () => {
    win.show()
    logger.info('main', 'Main window ready')
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('main', 'Renderer process gone', { reason: details.reason })
    // Cancel any in-flight Ollama streams - otherwise they keep running and
    // throw on every chunk trying to send to the dead webContents.
    abortAllStreams()
  })

  win.on('closed', () => {
    // Abort any in-flight streams targeting this window
    abortAllStreams()
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Nur eine Instanz: zweite Starts fokussieren das bestehende Fenster.
// Verhindert konkurrierende Zugriffe auf dozii.db und Settings.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// Global error handlers BEFORE app.whenReady
process.on('uncaughtException', (err) => {
  logger.error('main', 'Uncaught exception', {
    message: err.message,
    stack: err.stack
  })
})

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled rejection', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('org.hazii.dozii')
  initLogger()
  logger.info('main', 'App starting', {
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node
  })

  // Register all IPC handlers
  registerWindowIpc()
  registerHardwareIpc()
  registerOllamaIpc()
  registerSettingsIpc()
  registerDocumentsIpc()
  registerAnalysisIpc()
  registerChatIpc()
  registerLogsIpc()
  registerExporterIpc()
  registerSystemIpc()
  registerUpdateIpc()
  initUpdater()

  // DB eager initialisieren: Migrationen sollen beim Start laufen (und bei
  // Fehlern sofort sichtbar scheitern), nicht erst beim ersten DB-Zugriff.
  getDb()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  logger.info('main', 'App shutting down')
  abortAllStreams()
  void shutdownOcr()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
