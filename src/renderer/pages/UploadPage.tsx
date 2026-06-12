import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen
} from 'lucide-react'

interface ImportedDoc {
  id: string
  filename: string
  wordCount: number
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function UploadPage() {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<ImportedDoc[]>([])
  const [errorList, setErrorList] = useState<string[]>([])

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

  const handleImport = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) {
        setErrorList(['Keine Datei gefunden. Bitte versuche es erneut.'])
        return
      }
      setImporting(true)
      setErrorList([])
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
          const message = err instanceof Error ? err.message : 'Import fehlgeschlagen'
          errors.push(`${basename(path)}: ${message}`)
        }
      }

      setImported((prev) => [...prev, ...results])
      setImporting(false)

      if (errors.length > 0) {
        setErrorList(errors)
      }

      // Navigate to doc if exactly one file was successfully imported
      if (results.length === 1 && errors.length === 0) {
        navigate(`/document/${results[0].id}`)
      }
    },
    [navigate]
  )

  const handleClick = async () => {
    setErrorList([])
    const paths = await window.api.documents.openDialog()
    if (paths.length > 0) {
      await handleImport(paths)
    }
  }

  const handleBulkFolderImport = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setErrorList([])
    const paths = await window.api.documents.openDirectoryDialog()
    if (paths.length === 0) {
      setErrorList(['Keine unterstützten Dateien in diesem Ordner gefunden.'])
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
      setErrorList(['Keine Dateien im Drop erkannt.'])
      return
    }

    // Electron 32+: use webUtils.getPathForFile via preload
    const paths = files
      .map((f) => window.api.documents.getFilePath(f))
      .filter((p): p is string => Boolean(p))

    if (paths.length === 0) {
      setErrorList([
        'Dateipfade konnten nicht ausgelesen werden. Bitte "Klick zum Auswählen" benutzen.'
      ])
      return
    }

    await handleImport(paths)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div
        onClick={handleClick}
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
        className={`group w-full max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-300 ${
          dragging
            ? 'border-brand-cyan bg-brand-cyan/5 shadow-[0_0_40px_rgba(0,212,255,0.1)]'
            : 'border-brand-border hover:border-brand-cyan/30 hover:bg-brand-card/30'
        }`}
      >
        {importing ? (
          <>
            <Loader2 size={28} className="mx-auto mb-4 animate-spin text-brand-cyan" />
            <p className="text-sm text-brand-text-dim">Dokument wird verarbeitet...</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-cyan transition-colors group-hover:bg-brand-cyan/20">
              <Upload size={28} />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-brand-text-bright">
              Dokument hochladen
            </h2>
            <p className="mb-6 text-sm text-brand-text-dim">
              Ziehe Dateien hierher oder klicke zum Auswählen
            </p>
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
                  <Icon size={12} />
                  {label}
                </span>
              ))}
            </div>
            <button
              onClick={handleBulkFolderImport}
              className="titlebar-no-drag inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-card/50 px-4 py-2 text-xs text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <FolderOpen size={12} />
              Ordner importieren
            </button>
          </>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-brand-text-dim">
        <kbd className="rounded border border-brand-border bg-brand-card/50 px-1.5 py-0.5 font-mono text-[10px]">
          Ctrl + K
        </kbd>{' '}
        für globale Suche öffnen
      </p>

      {/* Error display: eine Zeile pro fehlgeschlagener Datei */}
      {errorList.length > 0 && (
        <div className="flex w-full max-w-2xl items-start gap-3 rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-brand-red" />
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
            Importiert
          </p>
          {imported.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/document/${doc.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-brand-border bg-brand-card/40 px-4 py-3 text-left transition-all hover:border-brand-border-hover hover:bg-brand-card"
            >
              <CheckCircle2 size={16} className="text-brand-green" />
              <span className="flex-1 truncate text-sm text-brand-text">{doc.filename}</span>
              <span className="text-xs text-brand-text-dim">
                {doc.wordCount.toLocaleString()} Wörter
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
