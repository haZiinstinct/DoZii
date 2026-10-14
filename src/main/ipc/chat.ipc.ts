import { ipcMain, BrowserWindow } from 'electron'
import { sendChatMessage, getChatHistory, clearChatHistory } from '../services/chat.service'
import { abortRun, withRun } from '../services/stream-run'
import { resolveActiveModel } from '../services/model-resolver.service'
import { logger } from '../services/logger.service'
import { friendlyError } from './_error-mapping'
import { MAX_CHAT_MESSAGE_CHARS } from '../config/constants'
import { isValidId } from './_validators'

export function registerChatIpc(): void {
  ipcMain.handle(
    'chat:send',
    async (event, documentId: string, userMessage: string, runId?: unknown) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No window found')
      // Jedes Event traegt die Lauf-ID; der Renderer verwirft fremde.
      const send = (channel: string, payload: unknown): void => {
        if (!win.isDestroyed()) win.webContents.send(channel, payload, runId)
      }

      if (!isValidId(documentId) || !isValidId(runId) || typeof userMessage !== 'string') {
        logger.warn('chat.ipc', 'Invalid chat request rejected', { documentId })
        send('chat:error', 'Ungültige Chat-Anfrage')
        return null
      }
      if (userMessage.length > MAX_CHAT_MESSAGE_CHARS) {
        send('chat:error', `Die Nachricht ist zu lang (max. ${MAX_CHAT_MESSAGE_CHARS} Zeichen)`)
        return null
      }

      const resolution = await resolveActiveModel()
      if (resolution.kind !== 'ok') {
        logger.warn('chat.ipc', 'Cannot send chat: ' + resolution.kind, { documentId })
        send('chat:error', resolution.message)
        return null
      }
      const model = resolution.model

      try {
        const result = await withRun('chat', runId, () =>
          sendChatMessage(documentId, userMessage, model, win)
        )
        send('chat:complete', result)
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
        send('chat:error', userFacing)
        return null
      }
    }
  )

  ipcMain.handle('chat:abort', (_event, runId?: unknown) => {
    const aborted = abortRun('chat', isValidId(runId) ? runId : undefined)
    logger.info('chat.ipc', 'Chat abort requested', { aborted })
  })

  ipcMain.handle('chat:getHistory', (_event, documentId: string) => {
    if (!isValidId(documentId)) return []
    return getChatHistory(documentId)
  })

  ipcMain.handle('chat:clearHistory', (_event, documentId: string) => {
    if (!isValidId(documentId)) return
    clearChatHistory(documentId)
  })
}
