import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalPath: text('original_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  pageCount: integer('page_count'),
  wordCount: integer('word_count'),
  detectedLanguage: text('detected_language'),
  extractedText: text('extracted_text').notNull().default(''),
  thumbnailPath: text('thumbnail_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(), // grammar | formulation | arbeitszeugnis | summary | freeform
  prompt: text('prompt').notNull(),
  result: text('result').notNull(),
  structuredResult: text('structured_result'), // JSON string
  modelUsed: text('model_used').notNull(),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull()
})

// Persistent chat messages per document (follow-up conversation after analysis)
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  modelUsed: text('model_used'),
  createdAt: text('created_at').notNull()
})

// Auto-generated first impression per document (single row per doc)
export const firstImpressions = sqliteTable('first_impressions', {
  documentId: text('document_id')
    .primaryKey()
    .references(() => documents.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  recommendedMode: text('recommended_mode').notNull(),
  firstImpression: text('first_impression').notNull(),
  modelUsed: text('model_used').notNull(),
  createdAt: text('created_at').notNull()
})

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type Analysis = typeof analyses.$inferSelect
export type NewAnalysis = typeof analyses.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type FirstImpressionRow = typeof firstImpressions.$inferSelect
export type NewFirstImpressionRow = typeof firstImpressions.$inferInsert
