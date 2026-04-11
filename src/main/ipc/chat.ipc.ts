import { ipcMain, BrowserWindow } from 'electron'
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory
} from '../services/chat.service'
import { abortAllStreams } from '../services/ollama-client.service'
import { resolveActiveModel } from '../services/model-resolver.service'
import { logger } from '../services/logger.service'
import { friendlyError } from './_error-mapping'

export function registerChatIpc(): void {
  ipcMain.handle('chat:send', async (event, documentId: string, userMessage: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window found')

    const resolution = await resolveActiveModel()
    if (resolution.kind !== 'ok') {
      logger.warn('chat.ipc', 'Cannot send chat: ' + resolution.kind, { documentId })
      if (!win.isDestroyed()) {
        win.webContents.send('chat:error', resolution.message)
      }
      return null
    }
    const model = resolution.model

    try {
      const result = await sendChatMessage(documentId, userMessage, model, win)
      if (!win.isDestroyed()) {
        win.webContents.send('chat:complete', result)
      }
      return result
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Chat fehlgeschlagen'
      const userFacing = friendlyError(raw)
      logger.error('chat.ipc', 'Chat send failed', {
        documentId,
        error: raw,
        userFacing,
        stack: err instanceof Error ? err.stack : undefined
      })
      if (!win.isDestroyed()) {
        win.webContents.send('chat:error', userFacing)
      }
      return null
    }
  })

  ipcMain.handle('chat:abort', () => {
    logger.info('chat.ipc', 'Chat abort requested')
    abortAllStreams()
  })

  ipcMain.handle('chat:getHistory', (_event, documentId: string) => {
    return getChatHistory(documentId)
  })

  ipcMain.handle('chat:clearHistory', (_event, documentId: string) => {
    clearChatHistory(documentId)
  })
}
