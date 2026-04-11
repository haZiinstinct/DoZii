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
import { registerLicenseIpc } from './ipc/license.ipc'
import { registerExporterIpc } from './ipc/exporter.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { closeDb } from './db'
import { logger, initLogger } from './services/logger.service'
import { abortAllStreams } from './services/ollama-client.service'

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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // CSP: blocks ALL external requests - only localhost:11434 (Ollama) allowed.
  session.defaultSession.webRequest.onHeadersReceived((_details, callback) => {
    callback({
      responseHeaders: {
        ...(_details.responseHeaders || {}),
        'Content-Security-Policy': [buildCsp()]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    logger.info('main', 'Main window ready')
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('main', 'Renderer process gone', { reason: details.reason })
    // Cancel any in-flight Ollama streams - otherwise they keep running and
    // throw on every chunk trying to send to the dead webContents.
    abortAllStreams()
  })

  mainWindow.on('closed', () => {
    // Abort any in-flight streams targeting this window
    abortAllStreams()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

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
  registerLicenseIpc()
  registerExporterIpc()
  registerSystemIpc()

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
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
