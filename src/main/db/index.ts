import { app, dialog } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrations'
import { logger } from '../services/logger.service'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

export function getDb() {
  if (_db) return _db

  const dbPath = join(app.getPath('userData'), 'dozii.db')
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')

  try {
    const result = runMigrations(_sqlite, { dbPath })
    if (result.from !== result.to) {
      logger.info('db', 'Datenbank migriert', { from: result.from, to: result.to })
    }
  } catch (err) {
    // Nie mit halbmigrierter DB weiterlaufen - Fehler zeigen und beenden.
    logger.error('db', 'Datenbank-Migration fehlgeschlagen', {
      error: err instanceof Error ? err.message : String(err)
    })
    _sqlite.close()
    _sqlite = null
    dialog.showErrorBox(
      'DoZii - Datenbankfehler',
      'Die Datenbank konnte nicht aktualisiert werden.\n\n' +
        `Details: ${err instanceof Error ? err.message : String(err)}\n\n` +
        `Datenbank-Datei: ${dbPath}\n` +
        'Ein automatisches Backup (.bak-v*) liegt ggf. im selben Ordner.'
    )
    app.quit()
    throw err
  }

  _db = drizzle(_sqlite, { schema })
  return _db
}

export function closeDb() {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

export { schema }
