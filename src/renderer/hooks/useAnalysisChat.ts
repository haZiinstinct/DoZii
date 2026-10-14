import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage } from '@shared/types'
import { useStreamingInvocation } from '@/hooks/useStreamingInvocation'
import { logRejection } from '@/lib/log-rejection'

export type ChatState =
  | { kind: 'idle' }
  | { kind: 'streaming'; buffer: string }
  | { kind: 'error'; message: string }

/**
 * Nachgespraech zu einem Dokument: Verlauf laden, Frage senden (gestreamt),
 * stoppen, leeren. Aus der Analyseseite herausgezogen - dort hingen Chat,
 * Export und Analyse in einer Komponente mit ueber 1000 Zeilen.
 */
export function useAnalysisChat(docId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chat, setChat] = useState<ChatState>({ kind: 'idle' })
  const [input, setInput] = useState('')
  const stream = useStreamingInvocation<ChatMessage>(window.api.chat)

  // Verlauf laden, wenn das Dokument wechselt
  useEffect(() => {
    if (!docId) return
    window.api.chat
      .getHistory(docId)
      .then(setMessages)
      .catch(() => {
        // silent - chat history load error is non-critical
      })
  }, [docId])

  const send = useCallback(async () => {
    if (!docId || !input.trim() || chat.kind === 'streaming') return

    const userText = input.trim()
    setInput('')
    setChat({ kind: 'streaming', buffer: '' })

    // Optimistically add the user message
    const tempUserMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      documentId: docId,
      role: 'user',
      content: userText,
      modelUsed: null,
      createdAt: new Date().toISOString()
    }
    setMessages((prev) => [...prev, tempUserMsg])

    await stream.run((runId) => window.api.chat.send(docId, userText, runId), {
      onChunk: (chunk) => {
        setChat((s) => (s.kind === 'streaming' ? { ...s, buffer: s.buffer + chunk } : s))
      },
      onComplete: () => {
        setChat({ kind: 'idle' })
        window.api.chat
          .getHistory(docId)
          .then(setMessages)
          .catch(logRejection('useAnalysisChat', 'chat.getHistory'))
      },
      onError: (err) => {
        setChat({ kind: 'error', message: err })
        // Remove the optimistic user message since sending failed
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      }
    })
  }, [docId, input, chat, stream])

  const stop = useCallback(() => {
    void stream.abort()
  }, [stream])

  const clear = useCallback(async () => {
    if (!docId) return
    try {
      await window.api.chat.clearHistory(docId)
      setMessages([])
    } catch (err) {
      logRejection('useAnalysisChat', 'chat.clearHistory')(err)
    }
  }, [docId])

  return { messages, chat, input, setInput, send, stop, clear }
}
