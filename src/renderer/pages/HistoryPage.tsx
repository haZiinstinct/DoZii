import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, FileText, Image, FileSpreadsheet, Search, Trash2 } from 'lucide-react'
import type { DoziiDocument } from '@shared/types'

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
  return FileText
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DoziiDocument[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.documents.getAll().then((d) => {
      setDocs(d)
      setLoading(false)
    })
  }, [])

  const filtered = search
    ? docs.filter(
        (d) =>
          d.filename.toLowerCase().includes(search.toLowerCase()) ||
          d.extractedText.toLowerCase().includes(search.toLowerCase())
      )
    : docs

  const handleDelete = async (id: string) => {
    await window.api.documents.delete(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
          <History size={20} />
        </div>
        <h1 className="text-2xl font-bold text-brand-text-bright">Historie</h1>
        <span className="ml-auto text-sm text-brand-text-dim">{docs.length} Dokumente</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Dokumente und Inhalte durchsuchen..."
          className="w-full rounded-xl border border-brand-border bg-brand-dark/80 py-3 pl-11 pr-4 text-sm text-brand-text placeholder:text-brand-text-dim/70 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/20"
        />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-card/40 py-16 text-center">
          <History size={32} className="mx-auto mb-3 text-brand-text-dim/30" />
          <p className="text-sm text-brand-text-dim">
            {search ? 'Keine Ergebnisse' : 'Noch keine Dokumente importiert'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const Icon = getFileIcon(doc.mimeType)
            return (
              <div
                key={doc.id}
                className="group flex items-center gap-3 rounded-xl border border-brand-border bg-brand-card/40 pl-3 pr-3 transition-all hover:border-brand-border-hover hover:bg-brand-card"
              >
                <button
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="flex flex-1 items-center gap-4 py-4 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-text">{doc.filename}</p>
                    <p className="text-xs text-brand-text-dim">
                      {formatDate(doc.createdAt)}
                      {doc.wordCount ? ` · ${doc.wordCount.toLocaleString()} Woerter` : ''}
                      {doc.detectedLanguage
                        ? ` · ${doc.detectedLanguage === 'de' ? 'DE' : 'EN'}`
                        : ''}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text-dim opacity-0 transition-all hover:bg-brand-red/10 hover:text-brand-red group-hover:opacity-100"
                  title="Dokument loeschen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
