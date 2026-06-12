import { BrowserWindow } from 'electron'
import { v4 as uuid } from 'uuid'
import { eq, asc } from 'drizzle-orm'
import type { Message } from 'ollama'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { streamConversation, warmupModel } from './ollama-client.service'
import { logger } from './logger.service'
import type { ChatMessage, ChatRole } from '@shared/types'

const MAX_HISTORY_CHARS = 20_000

function buildSystemPrompt(documentText: string, language: string): string {
  const isGerman = language === 'de'
  return isGerman
    ? `Du bist ein hilfreicher Dokumentenassistent fuer DoZii. Der Nutzer hat dir ein Dokument gegeben und stellt dir Fragen dazu. Antworte praezise und hilfreich auf Deutsch. Beziehe dich, wenn moeglich, auf konkrete Stellen im Dokument.

--- DOKUMENT ---
${documentText}
--- ENDE DOKUMENT ---`
    : `You are a helpful document assistant for DoZii. The user has given you a document and is asking questions about it. Answer precisely and helpfully in English. Reference specific parts of the document when possible.

--- DOCUMENT ---
${documentText}
--- END DOCUMENT ---`
}

export function getChatHistory(documentId: string): ChatMessage[] {
  const db = getDb()
  return db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.documentId, documentId))
    .orderBy(asc(schema.chatMessages.createdAt))
    .all() as ChatMessage[]
}

export function clearChatHistory(documentId: string): void {
  const db = getDb()
  db.delete(schema.chatMessages).where(eq(schema.chatMessages.documentId, documentId)).run()
  logger.info('chat.service', 'Chat history cleared', { documentId })
}

function saveMessage(
  documentId: string,
  role: ChatRole,
  content: string,
  modelUsed?: string
): ChatMessage {
  const db = getDb()
  const message: typeof schema.chatMessages.$inferInsert = {
    id: uuid(),
    documentId,
    role,
    content,
    modelUsed: modelUsed ?? null,
    createdAt: new Date().toISOString()
  }
  db.insert(schema.chatMessages).values(message).run()
  return message as ChatMessage
}

/**
 * Send a chat message. Saves user + assistant messages as a pair AFTER the
 * stream completes (or aborts with partial text), so a failing stream doesn't
 * leave orphaned user messages in the history.
 */
export async function sendChatMessage(
  documentId: string,
  userMessage: string,
  model: string,
  win: BrowserWindow
): Promise<ChatMessage> {
  logger.info('chat.service', 'Sending chat message', {
    documentId,
    messageLength: userMessage.length,
    model
  })

  const doc = getDocumentById(documentId)
  if (!doc) {
    logger.error('chat.service', 'Document not found for chat', { documentId })
    throw new Error(`Dokument ${documentId} nicht gefunden`)
  }
  if (!doc.extractedText) {
    throw new Error('Dokument hat keinen extrahierten Text')
  }

  const language = doc.detectedLanguage || 'de'

  // Build message array: system prompt + full persisted history + NEW user message.
  // The new message is NOT persisted yet - we only save it after the stream
  // succeeds so that errors don't leave orphan user messages.
  const history = getChatHistory(documentId)
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(doc.extractedText, language) },
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
    { role: 'user', content: userMessage }
  ]

  // Truncate oldest user/assistant pairs if total content grows too large
  while (
    messages.reduce((sum, m) => sum + m.content.length, 0) > MAX_HISTORY_CHARS &&
    messages.length > 3
  ) {
    messages.splice(1, 1)
  }

  const startTime = Date.now()
  let fullResponse: string
  let aborted: boolean

  // Warmup: force model load before the stream request to avoid cold-start races
  await warmupModel(model)

  try {
    const result = await streamConversation({
      model,
      messages,
      win,
      channel: 'chat:chunk',
      temperature: 0.6,
      numCtx: 8192
    })
    fullResponse = result.text
    aborted = result.aborted
  } catch (err) {
    logger.error('chat.service', 'Chat stream failed', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  const durationMs = Date.now() - startTime
  logger.info('chat.service', 'Chat message completed', {
    documentId,
    durationMs,
    responseLength: fullResponse.length,
    aborted
  })

  // Now that we have a response (even partial), persist the user message AND
  // the assistant response as a pair.
  saveMessage(documentId, 'user', userMessage)
  const contentToSave =
    aborted && fullResponse.length > 0
      ? `${fullResponse}\n\n[Abgebrochen]`
      : aborted
        ? '[Abgebrochen]'
        : fullResponse
  return saveMessage(documentId, 'assistant', contentToSave, model)
}
