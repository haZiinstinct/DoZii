import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet,
  FileText,
  History,
  Image,
  Loader2,
  ScanLine,
  Search,
  Trash2,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DocumentSummary } from '@shared/types'

/** Wartezeit, bevor aus einer Eingabe eine SQLite-Suche wird. */
const SEARCH_DEBOUNCE_MS = 250

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
  return FileText
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [search, setSearch] = useState('')
  /** Die Suche, zu der die aktuell angezeigte Liste gehoert - fuer Zaehler und Leerzustand. */
  const [appliedSearch, setAppliedSearch] = useState('')
  const [busy, setBusy] = useState(true)
  const [ready, setReady] = useState(false)
  /** Laufende Nummer der zuletzt gestarteten Anfrage (Race-Schutz). */
  const requestRef = useRef(0)

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    [i18n.language]
  )
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  // Suche laeuft in SQLite: entprellt, und nur das Ergebnis der zuletzt
  // gestarteten Anfrage darf die Liste ueberschreiben.
  useEffect(() => {
    const query = search.trim()
    const ticket = ++requestRef.current
    setBusy(true)

    const timer = setTimeout(
      () => {
        const request = query ? window.api.documents.search(query) : window.api.documents.getAll()

        request
          .then((result) => {
            if (ticket !== requestRef.current) return
            setDocs(result)
            setAppliedSearch(query)
            setReady(true)
            setBusy(false)
          })
          .catch(() => {
            if (ticket !== requestRef.current) return
            setBusy(false)
          })
      },
      query ? SEARCH_DEBOUNCE_MS : 0
    )

    return () => {
      clearTimeout(timer)
      // Entwertet eine noch laufende Anfrage (Eingabe geaendert oder unmount).
      requestRef.current += 1
    }
  }, [search])

  const handleDelete = async (id: string) => {
    await window.api.documents.delete(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
          <History size={20} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-brand-text-bright">{t('history.title')}</h1>
        <span className="ms-auto text-sm text-brand-text-dim" aria-live="polite">
          {appliedSearch
            ? t('history.searchResults', { count: docs.length })
            : t('history.count', { count: docs.length })}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-dim"
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('history.searchPlaceholder')}
          aria-label={t('history.searchPlaceholder')}
          className="w-full rounded-xl border border-brand-border bg-brand-dark/80 py-3 pe-11 ps-11 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20"
        />
        {busy && ready ? (
          <Loader2
            size={16}
            className="absolute end-4 top-1/2 -translate-y-1/2 animate-spin text-brand-text-dim"
            aria-hidden="true"
          />
        ) : search ? (
          <button
            onClick={() => setSearch('')}
            className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
            title={t('history.clearSearch')}
            aria-label={t('history.clearSearch')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Document list */}
      {busy && !ready ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 py-16 text-center">
          <History size={32} className="mx-auto mb-3 text-brand-text-dim/30" aria-hidden="true" />
          <p className="text-sm text-brand-text-dim">
            {appliedSearch ? t('history.searchNone', { query: appliedSearch }) : t('history.empty')}
          </p>
          {appliedSearch ? (
            <button
              onClick={() => setSearch('')}
              className="mt-4 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-border-hover hover:text-brand-text"
            >
              {t('history.clearSearch')}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2" aria-busy={busy}>
          {docs.map((doc) => {
            const Icon = getFileIcon(doc.mimeType)
            const snippet = doc.snippet.trim()
            return (
              <li
                key={doc.id}
                className="group flex items-center gap-3 rounded-xl border border-brand-border bg-brand-card/40 pe-3 ps-3 transition-all hover:border-brand-border-hover hover:bg-brand-card"
              >
                <button
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="flex flex-1 items-center gap-4 py-4 text-start"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-brand-text">
                        {doc.filename}
                      </span>
                      {doc.ocrUsed ? (
                        <span
                          role="img"
                          aria-label={t('document.ocrUsed')}
                          title={t('document.ocrUsed')}
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-brand-amber/30 bg-brand-amber/10 text-brand-amber"
                        >
                          <ScanLine size={12} aria-hidden="true" />
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-brand-text-dim">
                      {dateFormat.format(new Date(doc.createdAt))}
                      {doc.wordCount
                        ? ` · ${numberFormat.format(doc.wordCount)} ${t('common.words')}`
                        : ''}
                      {doc.detectedLanguage
                        ? ` · ${doc.detectedLanguage.slice(0, 2).toUpperCase()}`
                        : ''}
                    </p>
                    {snippet ? (
                      <p className="mt-1 line-clamp-2 text-xs text-brand-text-dim">{snippet}</p>
                    ) : null}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-brand-text-dim opacity-0 transition-all hover:bg-brand-red/10 hover:text-brand-red focus-visible:opacity-100 group-hover:opacity-100"
                  title={t('history.deleteDoc')}
                  aria-label={t('history.deleteDoc')}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
