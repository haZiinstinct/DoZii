import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

const CREATE_TABLES_SQL = `
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

export function getDb() {
  if (_db) return _db

  const dbPath = join(app.getPath('userData'), 'dozii.db')
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.exec(CREATE_TABLES_SQL)

  _db = drizzle(_sqlite, { schema })
  return _db
}

export function closeDb() {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

export { schema }
