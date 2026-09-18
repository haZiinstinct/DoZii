import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ClipboardPaste,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FirstImpression } from '@shared/types'

interface ImportedDoc {
  id: string
  filename: string
  wordCount: number
}

/** Hinweis am Einfuege-Feld: Fehler blockiert den Import, Warnung nicht. */
interface PasteNotice {
  kind: 'error' | 'warning'
  message: string
}

/** Darunter reicht der Text fuer eine brauchbare Analyse meist nicht - nur Warnung. */
const PASTE_MIN_CHARS = 80
/** Darueber laeuft das Modell ins Leere - dann lieber als Datei importieren. */
const PASTE_MAX_CHARS = 1_000_000

/** Der Ersteindruck entsteht nach dem Import asynchron im Hauptprozess. */
const IMPRESSION_POLL_MS = 500
const IMPRESSION_TIMEOUT_MS = 8000

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function UploadPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<ImportedDoc[]>([])
  const [errorList, setErrorList] = useState<string[]>([])
  // Seitenfortschritt der Texterkennung (nur bei gescannten PDFs / Fotos).
  const [ocrProgress, setOcrProgress] = useState<{ page: number; total: number } | null>(null)
  // Wartet auf den Ersteindruck, bevor der Ein-Klick-Flow weiterspringt.
  const [waitingImpression, setWaitingImpression] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteNotice, setPasteNotice] = useState<PasteNotice | null>(null)

  const panelId = useId()
  const textId = useId()
  const titleId = useId()
  const noticeId = useId()

  // Poll-Abbruch beim Unmount: Flag + Timer + Weckruf fuer das haengende await.
  const cancelledRef = useRef(false)
  const pollTimerRef = useRef<number | null>(null)
  const pollWakeRef = useRef<(() => void) | null>(null)

  const busy = importing || waitingImpression

  // Global drop protection: prevent browser from navigating to dropped files
  // when the user misses the drop zone.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  // Fortschritt der Texterkennung waehrend eines laufenden Imports.
  useEffect(() => {
    const unsubscribe = window.api.documents.onImportProgress(({ page, total }) => {
      setOcrProgress({ page, total })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
      pollWakeRef.current?.()
      pollWakeRef.current = null
    }
  }, [])

  /** Pollt den Ersteindruck, bricht nach IMPRESSION_TIMEOUT_MS oder beim Unmount ab. */
  const waitForFirstImpression = useCallback(
    async (docId: string): Promise<FirstImpression | null> => {
      const deadline = Date.now() + IMPRESSION_TIMEOUT_MS
      while (!cancelledRef.current && Date.now() < deadline) {
        const impression = await window.api.documents.getFirstImpression(docId).catch(() => null)
        if (impression) return impression
        if (cancelledRef.current || Date.now() + IMPRESSION_POLL_MS >= deadline) break
        await new Promise<void>((resolve) => {
          pollWakeRef.current = resolve
          pollTimerRef.current = window.setTimeout(() => {
            pollTimerRef.current = null
            pollWakeRef.current = null
            resolve()
          }, IMPRESSION_POLL_MS)
        })
      }
      return null
    },
    []
  )

  /**
   * Ein-Klick-Flow: Bei autoAnalyze direkt in die empfohlene Analyse springen.
   * Ohne Ersteindruck (oder bei Fehlern) bleibt es beim bisherigen Weg.
   */
  const finishSingleImport = useCallback(
    async (docId: string) => {
      // Ohne Luecke im Ladezustand: erst hier endet die Import-Anzeige.
      setWaitingImpression(true)
      const settings = await window.api.settings.get().catch(() => null)
      if (cancelledRef.current) return
      if (!settings?.autoAnalyze) {
        setWaitingImpression(false)
        navigate(`/document/${docId}`)
        return
      }
      const impression = await waitForFirstImpression(docId)
      if (cancelledRef.current) return
      setWaitingImpression(false)
      if (impression) {
        navigate(`/analysis?doc=${docId}&mode=${impression.recommendedMode}&auto=1`)
      } else {
        navigate(`/document/${docId}`)
      }
    },
    [navigate, waitForFirstImpression]
  )

  const handleImport = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) {
        setErrorList([t('upload.errNoFile')])
        return
      }
      setImporting(true)
      setErrorList([])
      setOcrProgress(null)
      const results: ImportedDoc[] = []
      const errors: string[] = []

      for (const path of filePaths) {
        try {
          const doc = await window.api.documents.import(path)
          results.push({
            id: doc.id,
            filename: doc.filename,
            wordCount: doc.wordCount ?? 0
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : t('upload.importFailed')
          errors.push(`${basename(path)}: ${message}`)
        }
      }

      setImported((prev) => [...prev, ...results])
      setImporting(false)
      setOcrProgress(null)

      if (errors.length > 0) {
        setErrorList(errors)
      }

      // Navigate to doc if exactly one file was successfully imported
      if (results.length === 1 && errors.length === 0) {
        await finishSingleImport(results[0].id)
      }
    },
    [finishSingleImport, t]
  )

  const handleClick = async () => {
    if (busy) return
    setErrorList([])
    const paths = await window.api.documents.openDialog()
    if (paths.length > 0) {
      await handleImport(paths)
    }
  }

  const handleBulkFolderImport = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy) return
    setErrorList([])
    const paths = await window.api.documents.openDirectoryDialog()
    if (paths.length === 0) {
      setErrorList([t('upload.errNoFolderFiles')])
      return
    }
    await handleImport(paths)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    setErrorList([])

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) {
      setErrorList([t('upload.errNoDrop')])
      return
    }

    // Electron 32+: use webUtils.getPathForFile via preload
    const paths = files
      .map((f) => window.api.documents.getFilePath(f))
      .filter((p): p is string => Boolean(p))

    if (paths.length === 0) {
      setErrorList([t('upload.errPaths')])
      return
    }

    await handleImport(paths)
  }

  const handlePasteImport = async () => {
    if (busy) return
    const text = pasteText.trim()
    setPasteNotice(null)

    if (text.length === 0) {
      setPasteNotice({ kind: 'error', message: t('upload.pasteEmpty') })
      return
    }
    if (text.length > PASTE_MAX_CHARS) {
      setPasteNotice({ kind: 'error', message: t('upload.pasteTooLong') })
      return
    }
    if (text.length < PASTE_MIN_CHARS) {
      // Warnung, aber der Import laeuft trotzdem.
      setPasteNotice({ kind: 'warning', message: t('upload.pasteTooShort') })
    }

    setImporting(true)
    setErrorList([])
    setOcrProgress(null)
    try {
      const title = pasteTitle.trim()
      const doc = await window.api.documents.importText({
        text,
        title: title.length > 0 ? title : undefined
      })
      if (cancelledRef.current) return
      setImported((prev) => [
        ...prev,
        { id: doc.id, filename: doc.filename, wordCount: doc.wordCount ?? 0 }
      ])
      setPasteText('')
      setPasteTitle('')
      setPasteNotice(null)
      setImporting(false)
      await finishSingleImport(doc.id)
    } catch (err) {
      if (cancelledRef.current) return
      setImporting(false)
      setErrorList([err instanceof Error ? err.message : t('upload.importFailed')])
    }
  }

  const busyLabel = ocrProgress
    ? t('upload.ocrProgress', { current: ocrProgress.page, total: ocrProgress.total })
    : waitingImpression
      ? t('document.firstImpressionGenerating')
      : t('upload.processing')

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={handleDrop}
        aria-label={t('upload.title')}
        className={`group w-full max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-300 ${
          dragging
            ? 'border-brand-cyan bg-brand-cyan/5 shadow-[0_0_40px_rgba(0,212,255,0.1)]'
            : 'border-brand-border hover:border-brand-cyan/30 hover:bg-brand-card/30'
        }`}
      >
        {busy ? (
          <>
            <Loader2
              size={28}
              className="mx-auto mb-4 animate-spin text-brand-cyan"
              aria-hidden="true"
            />
            <p role="status" aria-live="polite" className="text-sm text-brand-text-dim">
              {busyLabel}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-cyan transition-colors group-hover:bg-brand-cyan/20">
              <Upload size={28} aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-brand-text-bright">
              {t('upload.title')}
            </h2>
            <p className="mb-6 text-sm text-brand-text-dim">{t('upload.subtitle')}</p>
            <div className="mb-4 flex justify-center gap-3">
              {[
                { icon: FileText, label: 'PDF' },
                { icon: FileText, label: 'DOCX' },
                { icon: FileSpreadsheet, label: 'XLSX' },
                { icon: Image, label: 'JPG/PNG' }
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card/50 px-3 py-1.5 font-mono text-xs text-brand-text-dim"
                >
                  <Icon size={12} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
            <button
              onClick={handleBulkFolderImport}
              className="titlebar-no-drag inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-card/50 px-4 py-2 text-xs text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <FolderOpen size={12} aria-hidden="true" />
              {t('upload.folderImport')}
            </button>
          </>
        )}
      </div>

      {/* Trenner zwischen Datei-Import und Text einfuegen */}
      <div className="flex w-full max-w-2xl items-center gap-4">
        <span className="h-px flex-1 bg-brand-border" aria-hidden="true" />
        <span className="font-mono text-xs uppercase tracking-wider text-brand-text-dim">
          {t('upload.or')}
        </span>
        <span className="h-px flex-1 bg-brand-border" aria-hidden="true" />
      </div>

      {/* Text einfuegen: fuer Post aus Portalen oder E-Mails, wo es keine Datei gibt */}
      <section className="w-full max-w-2xl rounded-2xl border border-brand-border bg-brand-card/40">
        <h2>
          <button
            type="button"
            onClick={() => setPasteOpen((open) => !open)}
            aria-expanded={pasteOpen}
            aria-controls={panelId}
            className="flex w-full items-center gap-3 rounded-2xl px-6 py-4 text-start transition-colors hover:bg-brand-card/60"
          >
            <ClipboardPaste
              size={16}
              className="flex-shrink-0 text-brand-cyan"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-text-bright">
                {t('upload.pasteTitle')}
              </span>
              <span className="mt-0.5 block text-xs text-brand-text-dim">
                {t('upload.pasteHint')}
              </span>
            </span>
            <ChevronDown
              size={16}
              className={`flex-shrink-0 text-brand-text-dim transition-transform duration-200 ${
                pasteOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </h2>

        {pasteOpen && (
          <div id={panelId} className="space-y-4 border-t border-brand-border p-6">
            <textarea
              id={textId}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              disabled={busy}
              aria-label={t('upload.pasteTitle')}
              aria-invalid={pasteNotice?.kind === 'error'}
              aria-describedby={pasteNotice ? noticeId : undefined}
              placeholder={t('upload.pastePlaceholder')}
              className="w-full resize-y rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-3 text-sm leading-relaxed text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
            />

            <div>
              <label
                htmlFor={titleId}
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-text-dim"
              >
                {t('upload.pasteTitleLabel')}
              </label>
              <input
                id={titleId}
                type="text"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                disabled={busy}
                placeholder={t('upload.pasteTitlePlaceholder')}
                className="w-full rounded-xl border border-brand-border bg-brand-dark/80 px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20 disabled:opacity-50"
              />
            </div>

            {pasteNotice && (
              <p
                id={noticeId}
                role={pasteNotice.kind === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 text-sm ${
                  pasteNotice.kind === 'error' ? 'text-brand-red' : 'text-brand-amber'
                }`}
              >
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{pasteNotice.message}</span>
              </p>
            )}

            <button
              type="button"
              onClick={handlePasteImport}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan px-6 py-3 text-sm font-semibold text-brand-dark transition-all duration-200 hover:bg-brand-cyan-dim hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              {t('upload.pasteButton')}
            </button>
          </div>
        )}
      </section>

      {/* Keyboard hint */}
      <p className="text-xs text-brand-text-dim">
        <kbd className="rounded border border-brand-border bg-brand-card/50 px-1.5 py-0.5 font-mono text-[10px]">
          Ctrl + K
        </kbd>{' '}
        {t('upload.searchHintSuffix')}
      </p>

      {/* Error display: eine Zeile pro fehlgeschlagener Datei */}
      {errorList.length > 0 && (
        <div className="flex w-full max-w-2xl items-start gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <AlertCircle
            size={16}
            className="mt-0.5 flex-shrink-0 text-brand-red"
            aria-hidden="true"
          />
          <ul className="min-w-0 flex-1 space-y-1">
            {errorList.map((msg, i) => (
              <li
                key={`${i}-${msg}`}
                className="whitespace-pre-line break-words text-sm text-brand-red"
              >
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recently imported */}
      {imported.length > 0 && (
        <div className="w-full max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            {t('upload.imported')}
          </p>
          <ul className="space-y-2">
            {imported.map((doc) => (
              <li key={doc.id}>
                <button
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-brand-border bg-brand-card/40 px-4 py-3 text-start transition-all hover:border-brand-border-hover hover:bg-brand-card"
                >
                  <CheckCircle2 size={16} className="text-brand-green" aria-hidden="true" />
                  <span className="flex-1 truncate text-sm text-brand-text">{doc.filename}</span>
                  <span className="text-xs text-brand-text-dim">
                    {doc.wordCount.toLocaleString()} {t('common.words')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
