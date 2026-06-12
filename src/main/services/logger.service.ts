import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, appendFileSync, readdirSync, statSync, unlinkSync } from 'fs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  source: string
  message: string
  meta?: unknown
}

const MAX_LOG_FILES = 14 // Keep last 14 days
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m' // red
}
const COLOR_RESET = '\x1b[0m'

class Logger {
  private logsDir: string | null = null
  private currentFile: string | null = null
  private buffer: LogEntry[] = []
  private initialized = false

  private init(): void {
    if (this.initialized) return
    try {
      this.logsDir = join(app.getPath('userData'), 'logs')
      mkdirSync(this.logsDir, { recursive: true })
      this.rotateFile()
      this.cleanupOldLogs()
      this.initialized = true

      // Flush any buffered entries (logged before init)
      for (const entry of this.buffer) {
        this.writeEntry(entry)
      }
      this.buffer = []
    } catch (err) {
      console.error('Logger init failed:', err)
    }
  }

  private rotateFile(): void {
    if (!this.logsDir) return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    this.currentFile = join(this.logsDir, `dozii-${today}.log`)
  }

  private cleanupOldLogs(): void {
    if (!this.logsDir) return
    try {
      const files = readdirSync(this.logsDir)
        .filter((f) => f.startsWith('dozii-') && f.endsWith('.log'))
        .map((f) => ({
          name: f,
          path: join(this.logsDir!, f),
          mtime: statSync(join(this.logsDir!, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime)

      const toDelete = files.slice(MAX_LOG_FILES)
      for (const file of toDelete) {
        try {
          unlinkSync(file.path)
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  private writeEntry(entry: LogEntry): void {
    // Mirror to console with colors
    const color = LEVEL_COLORS[entry.level]
    const prefix = `${color}[${entry.level.toUpperCase()}]${COLOR_RESET}`
    // eslint-disable-next-line no-console
    console.log(
      `${prefix} ${entry.timestamp} [${entry.source}] ${entry.message}`,
      entry.meta ?? ''
    )

    // Write to file
    if (!this.currentFile) return
    try {
      const line = JSON.stringify({
        ts: entry.timestamp,
        lvl: entry.level,
        src: entry.source,
        msg: entry.message,
        ...(entry.meta !== undefined ? { meta: entry.meta } : {})
      })
      appendFileSync(this.currentFile, line + '\n', 'utf8')
    } catch {
      /* ignore write errors to prevent logging loops */
    }
  }

  private log(level: LogLevel, source: string, message: string, meta?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      meta
    }

    if (!this.initialized) {
      // Buffer until app is ready
      this.buffer.push(entry)
      if (app.isReady()) {
        this.init()
      }
      return
    }

    this.writeEntry(entry)
  }

  debug(source: string, message: string, meta?: unknown): void {
    this.log('debug', source, message, meta)
  }

  info(source: string, message: string, meta?: unknown): void {
    this.log('info', source, message, meta)
  }

  warn(source: string, message: string, meta?: unknown): void {
    this.log('warn', source, message, meta)
  }

  error(source: string, message: string, meta?: unknown): void {
    this.log('error', source, message, meta)
  }

  getLogsDir(): string | null {
    if (!this.initialized) this.init()
    return this.logsDir
  }

  getCurrentLogFile(): string | null {
    if (!this.initialized) this.init()
    return this.currentFile
  }
}

export const logger = new Logger()

// Delayed initialization: app.getPath() only works after app is ready
export function initLogger(): void {
  logger.info('logger', 'Logger initialized')
}
