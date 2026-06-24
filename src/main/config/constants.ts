/**
 * Zentrale Konstanten fuer Analyse, Token-Budget und Eingabe-Limits.
 *
 * Bewusst an EINER Stelle: Bei Wechsel auf Modelle mit groesserem
 * Kontextfenster (16k/32k) oder geaenderter Token-Kalibrierung muss nur
 * hier angepasst werden, nicht in 6 verstreuten Dateien.
 */

// --- Ollama / Kontextfenster ---
/** num_ctx fuer alle Analyse-Modi. Ollama-Default (2048) wuerde lange Dokumente still abschneiden. */
export const DEFAULT_NUM_CTX = 8192
/** Reserve fuer die Modell-Antwort innerhalb von num_ctx (Prompt-Budget = num_ctx - reserve). */
export const RESPONSE_RESERVE_TOKENS = 1500

// --- Token-Schaetzung ---
/** Konservative Schaetzung Zeichen/Token fuer deutschen Text (englisch ~4). */
export const CHARS_PER_TOKEN = 3.5

// --- Eingabe-Limits (IPC-Validierung) ---
/** Maximale Laenge einer Freitext-Frage (Freeform-Analyse). */
export const MAX_USER_QUESTION_CHARS = 5000
/** Maximale Laenge einer einzelnen Chat-Nachricht. */
export const MAX_CHAT_MESSAGE_CHARS = 10_000

// --- Chat-Kontext ---
/** Maximale Gesamtlaenge der Chat-Historie (Zeichen), aelteste Paare werden gekuerzt. */
export const MAX_HISTORY_CHARS = 8_000
/** Token-Budget fuer den Dokumenttext im Chat-System-Prompt. */
export const DOC_TOKEN_BUDGET = 3_500
