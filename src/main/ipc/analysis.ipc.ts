import { ipcMain, BrowserWindow } from 'electron'
import { runAnalysis, getAnalysisHistory, getAllAnalyses } from '../services/analysis.service'
import { abortAllStreams } from '../services/ollama-client.service'
import {
  resolveActiveModel,
  setSelectedModel as setSelectedModelInResolver,
  getSelectedModel as getSelectedModelFromResolver
} from '../services/model-resolver.service'
import { logger } from '../services/logger.service'
import { friendlyError } from './_error-mapping'
import type { AnalysisMode } from '@shared/types'

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
    async (event, docId: string, mode: string, userQuestion?: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No window found')

      // Resolve active model with precise error messages
      const resolution = await resolveActiveModel()
      if (resolution.kind !== 'ok') {
        logger.warn('analysis.ipc', 'Cannot run analysis: ' + resolution.kind, {
          docId,
          mode
        })
        win.webContents.send('analysis:error', resolution.message)
        return null
      }
      const model = resolution.model

      logger.info('analysis.ipc', 'Running analysis', { docId, mode, model })

      try {
        const result = await runAnalysis(docId, mode as AnalysisMode, win, model, userQuestion)
        logger.info('analysis.ipc', 'Analysis completed', {
          docId,
          mode,
          analysisId: result.analysis.id,
          durationMs: result.analysis.durationMs,
          aborted: result.aborted
        })
        if (!win.isDestroyed()) {
          win.webContents.send('analysis:complete', result)
        }
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
        if (!win.isDestroyed()) {
          win.webContents.send('analysis:error', userFacing)
        }
        return null
      }
    }
  )

  ipcMain.handle('analysis:abort', () => {
    logger.info('analysis.ipc', 'Analysis abort requested')
    abortAllStreams()
  })

  ipcMain.handle('analysis:getHistory', (_event, docId: string) => {
    return getAnalysisHistory(docId)
  })

  ipcMain.handle('analysis:getAll', () => {
    return getAllAnalyses()
  })
}
