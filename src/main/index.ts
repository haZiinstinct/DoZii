import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerWindowIpc } from './ipc/window.ipc'
import { registerHardwareIpc } from './ipc/hardware.ipc'
import { registerOllamaIpc } from './ipc/ollama.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { markExistingInstallAsOnboarded } from './services/settings.service'
import { registerDocumentsIpc } from './ipc/documents.ipc'
import { registerAnalysisIpc } from './ipc/analysis.ipc'
import { registerChatIpc } from './ipc/chat.ipc'
import { registerLogsIpc } from './ipc/logs.ipc'
import { registerExporterIpc } from './ipc/exporter.ipc'
import { registerDeadlinesIpc } from './ipc/deadlines.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { registerDiagnosticsIpc } from './ipc/diagnostics.ipc'
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
 *
 * Gilt nur fuer Antworten mit HTTP-Kopfzeilen (Dev-Server). Die gebaute App
 * laedt per file:// - dort zaehlt das Meta-Tag, das electron.vite.config.ts
 * (productionCsp) im Build verschaerft.
 */
function buildCsp(): string {
  const scriptSrc = is.dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  // Ollama spricht nur der Hauptprozess an; der Renderer braucht keinen Zugang.
  const connectSrc = is.dev ? "connect-src 'self' http://localhost:11434" : "connect-src 'self'"
  return (
    "default-src 'self'; " +
    `${connectSrc}; ` +
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

  // Analyse-Ergebnisse werden als Markdown gerendert und koennen Links aus dem
  // Dokument enthalten - also aus einer Quelle, der nicht zu trauen ist. Ohne
  // Pruefung liesse sich darueber eine beliebige URL oder ein file:-Pfad im
  // System oeffnen.
  win.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      } else {
        logger.warn('main', 'Link mit unerlaubtem Protokoll blockiert', {
          protocol: url.protocol
        })
      }
    } catch {
      logger.warn('main', 'Ungueltige Link-Adresse blockiert')
    }
    return { action: 'deny' }
  })

  /*
   * Das Fenster verlaesst nie die eigene Oberflaeche. Ein Link im gerenderten
   * Markdown, ein Drag&Drop einer URL oder ein Redirect wuerde sonst eine
   * fremde Seite IN das Fenster laden - mit Zugriff auf window.api.
   * Die App navigiert intern nur ueber den Hash (HashRouter), das loest
   * will-navigate nicht aus.
   */
  const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const isOwnPage = (target: string): boolean => {
    try {
      const url = new URL(target)
      if (devUrl) return url.origin === new URL(devUrl).origin
      return url.protocol === 'file:' && url.pathname.endsWith('/renderer/index.html')
    } catch {
      return false
    }
  }
  const blockForeignNavigation = (event: Electron.Event, target: string): void => {
    if (isOwnPage(target)) return
    event.preventDefault()
    logger.warn('main', 'Navigation aus der App heraus blockiert')
  }
  win.webContents.on('will-navigate', blockForeignNavigation)
  win.webContents.on('will-redirect', blockForeignNavigation)

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
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

/**
 * Nur eine Instanz: zweite Starts fokussieren das bestehende Fenster.
 * Verhindert konkurrierende Zugriffe auf dozii.db und Settings.
 *
 * Alles Weitere steckt in main() und laeuft nur mit dem Lock. Frueher ging es
 * nach app.quit() einfach weiter: die zweite Instanz registrierte noch ihre
 * Handler, initialisierte Logger und DB und oeffnete womoeglich ein Fenster,
 * bevor sie wirklich beendet war.
 */
function main(): void {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
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
    // Bestandsnutzer nicht nachtraeglich durch den Assistenten schicken.
    markExistingInstallAsOnboarded()
    registerDocumentsIpc()
    registerAnalysisIpc()
    registerChatIpc()
    registerLogsIpc()
    registerExporterIpc()
    registerDeadlinesIpc()
    registerSystemIpc()
    registerDiagnosticsIpc()
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
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  main()
}
