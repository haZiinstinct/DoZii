import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, MIGRATIONS } from './migrations'

function tableNames(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name)
}

function userVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number | bigint }
  return Number(row.user_version)
}

// Simuliert eine Bestands-DB aus der unveröffentlichten 3.0.0-Ära:
// Tabellen existieren bereits, user_version steht auf 0.
function createLegacyDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_path TEXT NOT NULL,
      mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, page_count INTEGER,
      word_count INTEGER, detected_language TEXT,
      extracted_text TEXT NOT NULL DEFAULT '', thumbnail_path TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE analyses (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      mode TEXT NOT NULL, prompt TEXT NOT NULL, result TEXT NOT NULL,
      structured_result TEXT, model_used TEXT NOT NULL, duration_ms INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL, model_used TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE first_impressions (
      document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL, recommended_mode TEXT NOT NULL,
      first_impression TEXT NOT NULL, model_used TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO documents (id, filename, original_path, mime_type, file_size, created_at, updated_at)
    VALUES ('doc-1', 'zeugnis.pdf', 'C:/tmp/zeugnis.pdf', 'application/pdf', 1234, '2026-01-01', '2026-01-01');
  `)
  return db
}

describe('runMigrations', () => {
  it('frische DB: legt alle Tabellen an und setzt user_version', () => {
    const db = new DatabaseSync(':memory:')
    const result = runMigrations(db)

    expect(result.from).toBe(0)
    expect(result.to).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['documents', 'analyses', 'chat_messages', 'first_impressions'])
    )
    expect(userVersion(db)).toBe(result.to)
    db.close()
  })

  it('Bestands-DB (3.0.0, user_version=0): Daten bleiben erhalten', () => {
    const db = createLegacyDb()
    expect(userVersion(db)).toBe(0)

    const result = runMigrations(db)

    expect(result.from).toBe(0)
    expect(result.to).toBeGreaterThanOrEqual(1)
    const doc = db.prepare("SELECT filename FROM documents WHERE id = 'doc-1'").get() as {
      filename: string
    }
    expect(doc.filename).toBe('zeugnis.pdf')
    db.close()
  })

  it('zweiter Lauf ist ein No-Op', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db)
    const second = runMigrations(db)
    expect(second.from).toBe(second.to)
    db.close()
  })

  it('v2: Fristen-Tabelle existiert und haengt am Dokument', () => {
    const db = createLegacyDb()
    runMigrations(db)

    expect(tableNames(db)).toContain('deadlines')
    db.exec(`
      INSERT INTO deadlines (id, document_id, kind, label, due_date, quote, confidence, source, created_at)
      VALUES ('d-1', 'doc-1', 'widerspruch', 'Widerspruch', '2026-04-15', 'innerhalb eines Monats', 'high', 'computed', '2026-03-16')
    `)
    const row = db.prepare("SELECT due_date FROM deadlines WHERE id = 'd-1'").get() as {
      due_date: string
    }
    expect(row.due_date).toBe('2026-04-15')
    db.close()
  })

  it('spaetere Migrationen laufen auch auf einer DB, die schon auf v1 stand', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA user_version = 1')
    // Baseline von Hand, wie sie v1 hinterlassen haette
    MIGRATIONS[0].up(db)

    const result = runMigrations(db)

    expect(result.from).toBe(1)
    expect(result.to).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
    expect(tableNames(db)).toContain('deadlines')
    db.close()
  })

  it('v3: Dokumente merken sich, ob der Text aus OCR stammt', () => {
    const db = createLegacyDb()
    runMigrations(db)

    const columns = db
      .prepare('PRAGMA table_info(documents)')
      .all()
      .map((r) => (r as { name: string }).name)
    expect(columns).toContain('ocr_used')

    // Bestandsdokumente bekommen den Default 0 (kein OCR).
    const row = db.prepare("SELECT ocr_used FROM documents WHERE id = 'doc-1'").get() as {
      ocr_used: number
    }
    expect(row.ocr_used).toBe(0)
    db.close()
  })

  it('MIGRATIONS sind aufsteigend und lückenlos versioniert', () => {
    MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(i + 1)
    })
  })
})
