import { copyFileSync } from 'fs'

/**
 * Minimales Migrationssystem auf Basis von PRAGMA user_version.
 *
 * Regeln:
 * - Jede Migration läuft in einer eigenen Transaktion und hebt user_version an.
 * - Migration 1 ist die Baseline: idempotentes CREATE TABLE IF NOT EXISTS.
 *   Dadurch landen frische DBs UND Bestands-DBs (user_version=0, Tabellen
 *   existieren bereits) identisch bei Version 1.
 * - Ab Version 2 wird vor der Migration ein Datei-Backup erstellt
 *   (dozii.db.bak-v<n>), WAL vorher eingeklappt.
 *
 * Das SqliteDb-Interface ist eine strukturelle Teilmenge von better-sqlite3
 * (Produktion) und node:sqlite DatabaseSync (Tests) - so brauchen Unit-Tests
 * kein für die Electron-ABI kompiliertes Native-Modul.
 */

export interface SqliteDb {
  exec(sql: string): unknown
  prepare(sql: string): { get(...params: unknown[]): unknown }
}

interface Migration {
  version: number
  up: (db: SqliteDb) => void
}

const BASELINE_SQL = `
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    word_count INTEGER,
    detected_language TEXT,
    extracted_text TEXT NOT NULL DEFAULT '',
    thumbnail_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    prompt TEXT NOT NULL,
    result TEXT NOT NULL,
    structured_result TEXT,
    model_used TEXT NOT NULL,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model_used TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS first_impressions (
    document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    recommended_mode TEXT NOT NULL,
    first_impression TEXT NOT NULL,
    model_used TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_document ON chat_messages(document_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_analyses_document ON analyses(document_id);
  CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);
  CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
`

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(BASELINE_SQL)
    }
  }
  // Zukünftige Migrationen hier anhängen, z.B.:
  // { version: 2, up: (db) => { db.exec('ALTER TABLE documents ADD COLUMN ...') } }
]

export interface MigrationResult {
  from: number
  to: number
}

function getUserVersion(db: SqliteDb): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number | bigint }
  return Number(row.user_version)
}

function backupBeforeMigration(db: SqliteDb, dbPath: string, targetVersion: number): void {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  copyFileSync(dbPath, `${dbPath}.bak-v${targetVersion}`)
}

/**
 * Führt alle ausstehenden Migrationen aus. Wirft bei Fehlern - der Aufrufer
 * entscheidet, wie er den Nutzer informiert. Nach einem Fehler ist die DB
 * unverändert (Rollback pro Migration, Backup ab v2).
 * dbPath: Pfad der DB-Datei für Backups; weglassen bei In-Memory-DBs (Tests).
 */
export function runMigrations(db: SqliteDb, opts?: { dbPath?: string }): MigrationResult {
  const from = getUserVersion(db)
  let current = from

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue

    if (migration.version > 1 && opts?.dbPath) {
      backupBeforeMigration(db, opts.dbPath, migration.version)
    }

    db.exec('BEGIN')
    try {
      migration.up(db)
      db.exec(`PRAGMA user_version = ${migration.version}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    current = migration.version
  }

  return { from, to: current }
}
