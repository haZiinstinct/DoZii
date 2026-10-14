import { useEffect, useRef } from 'react'
import { Send, Sparkles, Square, Trash2, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@shared/types'
import type { ChatState } from '@/hooks/useAnalysisChat'
import { MarkdownView } from './MarkdownView'

/** Verlauf des Nachgespraechs unter dem Ergebnis. */
export function ChatThread({
  messages,
  chat,
  onClear
}: {
  messages: ChatMessage[]
  chat: ChatState
  onClear: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chat])

  return (
    <div className="mt-8 space-y-4 border-t border-brand-border pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-cyan" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            {t('analysis.conversation')}
          </span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-text-dim hover:bg-brand-red/10 hover:text-brand-red"
        >
          <Trash2 size={12} aria-hidden="true" />
          {t('analysis.chatDelete')}
        </button>
      </div>

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
              <Sparkles size={14} />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-brand-cyan/10 text-brand-text'
                : 'border border-brand-border bg-brand-card/60 text-brand-text'
            }`}
          >
            {msg.role === 'assistant' ? (
              <MarkdownView content={msg.content} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
            )}
          </div>
          {msg.role === 'user' && (
            <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-card text-brand-text-dim">
              <User size={14} />
            </div>
          )}
        </div>
      ))}

      {chat.kind === 'streaming' && chat.buffer && (
        <div className="flex gap-3">
          <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan">
            <Sparkles size={14} />
          </div>
          <div className="max-w-[80%] rounded-2xl border border-brand-border bg-brand-card/60 px-4 py-3">
            <MarkdownView content={chat.buffer} />
            <span className="inline-block h-3 w-1.5 animate-pulse bg-brand-cyan" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

/** Eingabezeile fuer das Nachgespraech, mit Stopp waehrend der Antwort. */
export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  hasMessages
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  hasMessages: boolean
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        disabled={streaming}
        placeholder={
          hasMessages ? t('analysis.chatPlaceholderMore') : t('analysis.chatPlaceholderEmpty')
        }
        className="flex-1 rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
      />
      {streaming ? (
        <button
          onClick={onStop}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-red/30 bg-brand-red/10 text-brand-red transition-colors hover:bg-brand-red/20"
          title={t('analysis.stopChat')}
          aria-label={t('analysis.stopChat')}
        >
          <Square size={16} fill="currentColor" aria-hidden="true" />
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!value.trim()}
          aria-label={t('analysis.send')}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan text-brand-dark transition-all hover:bg-brand-cyan-dim disabled:opacity-40"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
