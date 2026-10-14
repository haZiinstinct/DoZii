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
// Schutz vor Error-Loops: ab dieser Größe wird in eine Folgedatei des Tages
// gewechselt, nach MAX_PARTS_PER_DAY Dateien nicht mehr auf Disk geschrieben
// (Konsole läuft weiter). Check alle 200 Einträge, um statSync zu sparen.
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024
const MAX_PARTS_PER_DAY = 2
const SIZE_CHECK_INTERVAL = 200
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
  /** Tag (YYYY-MM-DD, UTC wie die Zeitstempel) der aktuellen Datei. */
  private currentDay = ''
  /** 0 = dozii-TAG.log, 1 = dozii-TAG.1.log, ... */
  private currentPart = 0
  private buffer: LogEntry[] = []
  private initialized = false
  private writesSinceSizeCheck = 0
  private fileSizeExceeded = false

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

  private rotateFile(day = new Date().toISOString().slice(0, 10), part = 0): void {
    if (!this.logsDir) return
    this.currentDay = day
    this.currentPart = part
    const suffix = part === 0 ? '' : `.${part}`
    this.currentFile = join(this.logsDir, `dozii-${day}${suffix}.log`)
    this.fileSizeExceeded = false
    this.writesSinceSizeCheck = 0
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
    console.log(`${prefix} ${entry.timestamp} [${entry.source}] ${entry.message}`, entry.meta ?? '')

    // Tageswechsel zur Laufzeit: frueher wurde nur beim Start rotiert - wer die
    // App ueber Mitternacht offen liess, schrieb weiter in die Vortagsdatei.
    const day = entry.timestamp.slice(0, 10)
    if (this.logsDir && day !== this.currentDay) {
      this.rotateFile(day)
      this.cleanupOldLogs()
    }

    // Write to file
    if (!this.currentFile || this.fileSizeExceeded) return
    try {
      if (++this.writesSinceSizeCheck >= SIZE_CHECK_INTERVAL) {
        this.writesSinceSizeCheck = 0
        const size = statSync(this.currentFile).size
        if (size > MAX_LOG_FILE_BYTES) {
          const next = this.currentPart + 1
          const full = next >= MAX_PARTS_PER_DAY
          appendFileSync(
            this.currentFile,
            JSON.stringify({
              ts: new Date().toISOString(),
              lvl: 'warn',
              src: 'logger',
              msg: full
                ? `Log-Limit (${MAX_PARTS_PER_DAY} x ${MAX_LOG_FILE_BYTES} Bytes) erreicht - Datei-Logging bis morgen pausiert`
                : `Log-Limit (${MAX_LOG_FILE_BYTES} Bytes) erreicht - weiter in Folgedatei ${next}`
            }) + '\n',
            'utf8'
          )
          if (full) {
            this.fileSizeExceeded = true
            return
          }
          this.rotateFile(day, next)
        }
      }
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
