import { ipcMain, shell } from 'electron'
import { logger } from '../services/logger.service'
import type { LogLevel } from '@shared/types'

const ALLOWED_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>([
  'debug',
  'info',
  'warn',
  'error'
])

function isValidLevel(level: unknown): level is LogLevel {
  return typeof level === 'string' && ALLOWED_LEVELS.has(level as LogLevel)
}

export function registerLogsIpc(): void {
  // Renderer can forward log entries (errors, unhandled rejections, etc.)
  // SECURITY: level is validated against an allow-list so the renderer cannot
  // invoke arbitrary Logger methods via bracket indexing.
  ipcMain.handle(
    'logs:write',
    (_event, level: unknown, source: unknown, message: unknown, meta?: unknown) => {
      if (!isValidLevel(level)) {
        logger.warn('logs.ipc', 'Received invalid log level from renderer', { level })
        return
      }
      if (typeof source !== 'string' || typeof message !== 'string') {
        logger.warn('logs.ipc', 'Invalid source or message type from renderer')
        return
      }
      logger[level](source, message, meta)
    }
  )

  ipcMain.handle('logs:openDirectory', async () => {
    const dir = logger.getLogsDir()
    if (dir) {
      await shell.openPath(dir)
      return dir
    }
    return null
  })

  ipcMain.handle('logs:getCurrentFile', () => {
    return logger.getCurrentLogFile()
  })
}
