import { ipcMain, BrowserWindow } from 'electron'
import {
  checkOllamaStatus,
  listModels,
  pullModel,
  deleteModel
} from '../services/ollama-client.service'
import {
  detectOllamaInstallation,
  startOllamaServer,
  stopOllamaServer
} from '../services/ollama-launcher.service'
import {
  setSelectedModel as setResolverSelectedModel,
  getSelectedModel as getResolverSelectedModel
} from '../services/model-resolver.service'
import { updateSettings } from '../services/settings.service'
import { logger } from '../services/logger.service'

export function registerOllamaIpc(): void {
  ipcMain.handle('ollama:status', async () => {
    return checkOllamaStatus()
  })

  ipcMain.handle('ollama:detectInstallation', () => {
    return detectOllamaInstallation()
  })

  ipcMain.handle('ollama:start', async () => {
    logger.info('ollama.ipc', 'Start requested')
    return startOllamaServer()
  })

  ipcMain.handle('ollama:stop', async () => {
    logger.info('ollama.ipc', 'Stop requested')
    return stopOllamaServer()
  })

  ipcMain.handle('ollama:listModels', async () => {
    return listModels()
  })

  ipcMain.handle('ollama:pullModel', async (event, name: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    await pullModel(name, win)
  })

  ipcMain.handle('ollama:deleteModel', async (_event, name: string) => {
    await deleteModel(name)
    // If the deleted model was currently selected, reset it in BOTH
    // the in-memory resolver AND the persisted settings store.
    if (getResolverSelectedModel() === name) {
      setResolverSelectedModel('')
      try {
        updateSettings({ selectedModel: '' })
      } catch (err) {
        logger.warn('ollama.ipc', 'Failed to clear selectedModel in settings', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
      logger.info('ollama.ipc', 'Selected model was deleted, cleared selection', { name })
    }
  })

  ipcMain.handle('ollama:selectModel', (_event, name: string) => {
    setResolverSelectedModel(name)
    // Persist the choice so it survives restarts
    try {
      updateSettings({ selectedModel: name })
    } catch (err) {
      logger.warn('ollama.ipc', 'Failed to persist selectedModel', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  })
}
