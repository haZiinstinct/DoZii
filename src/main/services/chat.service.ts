import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { eq, asc } from 'drizzle-orm'
import type { Message } from 'ollama'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { streamConversation, warmupModel } from './ollama-client.service'
import { fitTextToTokenBudget } from '../prompts/token-budget'
import { DEFAULT_NUM_CTX, MAX_HISTORY_CHARS, DOC_TOKEN_BUDGET } from '../config/constants'
import { logger } from './logger.service'
import { getSettings } from './settings.service'
import { englishNameFor } from '@shared/languages'
import type { ChatMessage, ChatRole } from '@shared/types'

/** Antwortsprache = UI-Sprache; de hat einen eigenen Prompt, alle anderen den englischen. */
export function buildSystemPrompt(documentText: string, language: string): string {
  const answerIn = englishNameFor(language)
  return language === 'de'
    ? `Du bist ein hilfreicher Dokumentenassistent für DoZii. Der Nutzer hat dir ein Dokument gegeben und stellt dir Fragen dazu. Antworte präzise und hilfreich auf Deutsch. Beziehe dich, wenn möglich, auf konkrete Stellen im Dokument.

--- DOKUMENT ---
${documentText}
--- ENDE DOKUMENT ---`
    : `You are a helpful document assistant for DoZii. The user has given you a document and is asking questions about it. Answer precisely and helpfully in ${answerIn}, even if the document is written in another language. Reference specific parts of the document when possible.

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
    id: randomUUID(),
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
 * Kuerzt den Verlauf von vorn, bis er in `maxChars` passt. System-Prompt
 * (Index 0) und die neue Nutzerfrage (letzter Eintrag) bleiben immer.
 *
 * Entfernt wird paarweise (Frage + Antwort). Einzeln geloescht stand sonst
 * eine Antwort ohne ihre Frage am Anfang - zwei assistant-Nachrichten
 * hintereinander bringen kleine Modelle aus dem Tritt.
 */
export function trimHistory(messages: Message[], maxChars: number): void {
  const total = (): number => messages.reduce((sum, m) => sum + m.content.length, 0)
  while (total() > maxChars && messages.length > 2) {
    const pair = messages[1]?.role === 'user' && messages[2]?.role === 'assistant'
    // Nie die neue Nutzerfrage (letzter Eintrag) entfernen.
    const count = pair && messages.length > 3 ? 2 : 1
    if (1 + count > messages.length - 1) break
    messages.splice(1, count)
  }
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

  // UI-Sprache, nicht Dokumentsprache: wer DoZii auf Russisch nutzt, will die
  // Antwort zum deutschen Bescheid auf Russisch.
  const language = getSettings().language || 'de'

  // Build message array: system prompt + full persisted history + NEW user message.
  // The new message is NOT persisted yet - we only save it after the stream
  // succeeds so that errors don't leave orphan user messages.
  const fittedDoc = fitTextToTokenBudget(doc.extractedText, DOC_TOKEN_BUDGET)
  if (fittedDoc.truncated) {
    logger.warn('chat.service', 'Document truncated for chat context', {
      documentId,
      textLength: doc.extractedText.length
    })
  }

  const history = getChatHistory(documentId)
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(fittedDoc.text, language) },
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
    { role: 'user', content: userMessage }
  ]

  trimHistory(messages, MAX_HISTORY_CHARS)

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
      numCtx: DEFAULT_NUM_CTX
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
