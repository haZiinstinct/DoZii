import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logger } from './logger.service'
import { getSettings } from './settings.service'
import type { UpdateStatus } from '@shared/types'

/**
 * Auto-Update über GitHub Releases (Feed laut publish-Block in electron-builder.yml).
 *
 * Bewusst konservativ: kein Auto-Download. Der Check meldet nur die
 * Versionsnummer; Download und Installation stoesst der Nutzer an.
 * Der Check ist der einzige Netzwerk-Call der App ausser Ollama und
 * laesst sich in den Einstellungen abschalten (autoUpdateCheck).
 */

let currentStatus: UpdateStatus = { state: 'idle' }
let initialized = false

function broadcast(status: UpdateStatus): void {
  currentStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('update:status', status)
    }
  }
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initUpdater(): void {
  if (!app.isPackaged) {
    logger.debug('updater', 'Dev-Build - Auto-Update deaktiviert')
    return
  }
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    logger.info('updater', 'Update verfuegbar', { version: info.version })
    broadcast({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) =>
    broadcast({ state: 'up-to-date', version: info.version })
  )
  autoUpdater.on('download-progress', (progress) =>
    broadcast({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updater', 'Update heruntergeladen', { version: info.version })
    broadcast({ state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    logger.warn('updater', 'Update-Fehler', { error: err.message })
    broadcast({ state: 'error', message: err.message })
  })

  if (getSettings().autoUpdateCheck) {
    // Erst nach dem App-Start pruefen, damit der Start nicht am Netz haengt
    setTimeout(() => {
      void checkForUpdates()
    }, 10_000)
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return { state: 'error', message: 'Update-Check ist im Dev-Build deaktiviert' }
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('updater', 'Update-Check fehlgeschlagen', { error: message })
    broadcast({ state: 'error', message })
  }
  return currentStatus
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
