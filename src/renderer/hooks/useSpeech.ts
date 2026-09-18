import { useCallback, useEffect, useRef, useState } from 'react'

export interface SpeechState {
  supported: boolean
  speaking: boolean
  speak: (text: string, lang?: string) => void
  stop: () => void
}

/**
 * Obergrenze je Utterance. Manche Windows-Stimmen (SAPI) brechen lange
 * Utterances mitten im Satz ab oder verstummen ganz - darum wird der Text in
 * Haeppchen an Satzgrenzen zerlegt und einzeln in die Queue gegeben.
 */
const MAX_CHUNK_LENGTH = 200

/** Amtstexte in Normalgeschwindigkeit sind zum Mitdenken zu schnell. */
const SPEECH_RATE = 0.95

/** Notbremse fuer Saetze ohne Satzzeichen: an Wortgrenzen haerten. */
function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK_LENGTH) return [sentence]
  const parts: string[] = []
  let current = ''
  for (const word of sentence.split(/\s+/)) {
    if (current.length > 0 && current.length + word.length + 1 > MAX_CHUNK_LENGTH) {
      parts.push(current)
      current = word
    } else {
      current = current.length > 0 ? `${current} ${word}` : word
    }
  }
  if (current.length > 0) parts.push(current)
  return parts
}

/** Zerlegt den Text an Satzgrenzen in Abschnitte von hoechstens ~200 Zeichen. */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let current = ''
  for (const sentence of text.split(/(?<=[.!?:;])\s+/)) {
    for (const piece of splitLongSentence(sentence)) {
      if (piece.length === 0) continue
      if (current.length > 0 && current.length + piece.length + 1 > MAX_CHUNK_LENGTH) {
        chunks.push(current)
        current = piece
      } else {
        current = current.length > 0 ? `${current} ${piece}` : piece
      }
    }
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * Vorlesen ueber die Stimmen des Betriebssystems (`window.speechSynthesis`).
 * Laeuft komplett lokal - es geht kein Text ins Netz.
 */
export function useSpeech(): SpeechState {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  /**
   * Zaehler je Vorlese-Auftrag. `cancel()` loest die end-/error-Events der
   * alten Utterances erst nachtraeglich aus - ohne diesen Vergleich wuerden
   * sie den gerade gestarteten Auftrag sofort wieder auf "still" setzen.
   */
  const runRef = useRef(0)

  const stop = useCallback((): void => {
    if (!supported) return
    runRef.current += 1
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, lang?: string): void => {
      if (!supported) return
      const trimmed = text.trim()
      if (trimmed.length === 0) return

      // Laufende Ausgabe beenden, sonst haengt der neue Text hinten an.
      window.speechSynthesis.cancel()
      runRef.current += 1
      const run = runRef.current

      const language = lang ?? document.documentElement.lang ?? 'de'
      const chunks = splitIntoChunks(trimmed)

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = language
        utterance.rate = SPEECH_RATE
        utterance.onstart = () => {
          if (runRef.current === run) setSpeaking(true)
        }
        utterance.onerror = () => {
          if (runRef.current === run) setSpeaking(false)
        }
        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (runRef.current === run) setSpeaking(false)
          }
        }
        window.speechSynthesis.speak(utterance)
      })
    },
    [supported]
  )

  // Beim Verlassen der Seite darf keine Stimme weiterreden.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return { supported, speaking, speak, stop }
}
