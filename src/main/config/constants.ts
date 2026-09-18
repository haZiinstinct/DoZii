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

// --- Dynamisches Kontextfenster (context-window.service) ---
/** Untergrenze: nie kleiner als der bisherige Festwert. */
export const MIN_NUM_CTX = 8192
/**
 * Obergrenze fuer die automatische Vergroesserung. Hoehere Werte kosten
 * linear RAM/VRAM; 32k deckt auch lange Vertraege ab, ohne 8-GB-Rechner
 * in den Swap zu treiben.
 */
export const MAX_AUTO_NUM_CTX = 32_768
/**
 * Grobe Schaetzung: wie viele Kontext-Tokens pro GB freiem RAM vertretbar
 * sind (KV-Cache waechst ~linear mit num_ctx). Konservativ angesetzt.
 */
export const CTX_TOKENS_PER_FREE_GB = 4096

// --- Gescannte PDFs / OCR-Fallback ---
/**
 * Unter so vielen Zeichen pro Seite gilt ein PDF als Scan ohne Textebene.
 * Der Wert lebt in @shared/scan-detect (dort wird er auch getestet) und wird
 * hier nur re-exportiert, damit es genau eine Quelle gibt.
 */
export { SCANNED_PDF_MIN_CHARS_PER_PAGE } from '@shared/scan-detect'
/** Sicherheitsnetz: so viele Seiten werden maximal per OCR nachgezogen. */
export const OCR_MAX_PAGES = 40
/** Kleinere Bilder als das sind Logos/Signaturen, kein Seitenscan. */
export const OCR_MIN_IMAGE_PIXELS = 200_000

// --- Chunking / Map-Reduce fuer lange Dokumente ---
/** Ueberlappung zwischen zwei Chunks, damit Saetze an der Naht nicht verloren gehen. */
export const CHUNK_OVERLAP_TOKENS = 200
/** Mehr Chunks als das werden nicht analysiert (Laufzeitschutz). */
export const MAX_CHUNKS = 12

// --- Text-Import (Einfuegen aus der Zwischenablage) ---
/** Maximale Laenge eines eingefuegten Textes. */
export const MAX_TEXT_IMPORT_CHARS = 1_000_000

// --- Suche ---
/** Maximale Trefferzahl der Dokumentsuche. */
export const MAX_SEARCH_RESULTS = 200
/** Laenge des Vorschau-Snippets in der Dokumentliste. */
export const SNIPPET_CHARS = 200
