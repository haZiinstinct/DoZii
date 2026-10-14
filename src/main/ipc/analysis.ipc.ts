import { ipcMain, BrowserWindow } from 'electron'
import { runAnalysis, getAnalysisHistory, getAllAnalyses } from '../services/analysis.service'
import { abortRun, withRun } from '../services/stream-run'
import {
  resolveActiveModel,
  setSelectedModel as setSelectedModelInResolver,
  getSelectedModel as getSelectedModelFromResolver
} from '../services/model-resolver.service'
import { logger } from '../services/logger.service'
import { friendlyError } from './_error-mapping'
import { MAX_USER_QUESTION_CHARS } from '../config/constants'
import { isValidAnalysisMode, isValidId, sanitizeAnalysisExtra } from './_validators'

// Re-export for backwards compatibility (other IPC modules import these)
export function setSelectedModel(model: string): void {
  setSelectedModelInResolver(model)
}

export function getSelectedModel(): string {
  return getSelectedModelFromResolver()
}

export function registerAnalysisIpc(): void {
  ipcMain.handle(
    'analysis:run',
    async (
      event,
      docId: string,
      mode: string,
      userQuestion?: string,
      rawExtra?: unknown,
      runId?: unknown
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No window found')

      // Jedes Event traegt die Lauf-ID; der Renderer verwirft fremde.
      if (!isValidId(runId)) {
        logger.warn('analysis.ipc', 'Analysis request without valid run id rejected', { docId })
        win.webContents.send('analysis:error', 'Ungültige Analyse-Anfrage')
        return null
      }
      const send = (channel: string, payload: unknown): void => {
        if (!win.isDestroyed()) win.webContents.send(channel, payload, runId)
      }

      if (!isValidId(docId) || !isValidAnalysisMode(mode)) {
        logger.warn('analysis.ipc', 'Invalid analysis request rejected', { docId, mode })
        send('analysis:error', 'Ungültige Analyse-Anfrage')
        return null
      }
      if (userQuestion !== undefined) {
        if (typeof userQuestion !== 'string' || userQuestion.length > MAX_USER_QUESTION_CHARS) {
          send('analysis:error', `Die Frage ist zu lang (max. ${MAX_USER_QUESTION_CHARS} Zeichen)`)
          return null
        }
      }
      const extra = sanitizeAnalysisExtra(rawExtra, MAX_USER_QUESTION_CHARS)
      if (mode === 'letter' && !extra.letterKind) {
        send('analysis:error', 'Es wurde keine Briefart ausgewählt.')
        return null
      }

      // Resolve active model with precise error messages
      const resolution = await resolveActiveModel()
      if (resolution.kind !== 'ok') {
        logger.warn('analysis.ipc', 'Cannot run analysis: ' + resolution.kind, {
          docId,
          mode
        })
        send('analysis:error', resolution.message)
        return null
      }
      const model = resolution.model

      logger.info('analysis.ipc', 'Running analysis', { docId, mode, model })

      try {
        const result = await withRun('analysis', runId, () =>
          runAnalysis(docId, mode, win, model, userQuestion, extra)
        )
        logger.info('analysis.ipc', 'Analysis completed', {
          docId,
          mode,
          analysisId: result.analysis.id,
          durationMs: result.analysis.durationMs,
          aborted: result.aborted
        })
        send('analysis:complete', result)
        return result
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Analyse fehlgeschlagen'
        const userFacing = friendlyError(raw)
        logger.error('analysis.ipc', 'Analysis failed', {
          docId,
          mode,
          error: raw,
          userFacing,
          stack: err instanceof Error ? err.stack : undefined
        })
        send('analysis:error', userFacing)
        return null
      }
    }
  )

  // Nur den eigenen Lauf - ein laufender Modell-Download bleibt unberuehrt.
  ipcMain.handle('analysis:abort', (_event, runId?: unknown) => {
    const aborted = abortRun('analysis', isValidId(runId) ? runId : undefined)
    logger.info('analysis.ipc', 'Analysis abort requested', { aborted })
  })

  ipcMain.handle('analysis:getHistory', (_event, docId: string) => {
    if (!isValidId(docId)) return []
    return getAnalysisHistory(docId)
  })

  ipcMain.handle('analysis:getAll', () => {
    return getAllAnalyses()
  })
}
