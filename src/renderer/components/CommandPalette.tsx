import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  FileText,
  Upload,
  History as HistoryIcon,
  Settings as SettingsIcon,
  FileSearch
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DoziiDocument } from '@shared/types'

interface CommandItem {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

/**
 * Global command palette triggered by Ctrl+K / Cmd+K.
 * Searches across documents (filename + content) and offers quick navigation.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<DoziiDocument[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load documents when palette opens
  useEffect(() => {
    if (!open) return
    window.api.documents
      .getAll()
      .then(setDocs)
      .catch(() => {
        /* silent */
      })
    setQuery('')
    setSelectedIndex(0)
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const navigationItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'nav-upload',
        label: t('nav.upload'),
        hint: t('command.hintUpload'),
        icon: <Upload size={16} aria-hidden="true" />,
        action: () => navigate('/'),
        keywords: ['upload', 'hochladen', 'neu', 'import']
      },
      {
        id: 'nav-analysis',
        label: t('nav.analysis'),
        hint: t('command.hintAnalysis'),
        icon: <FileSearch size={16} aria-hidden="true" />,
        action: () => navigate('/analysis'),
        keywords: ['analyse', 'analysis']
      },
      {
        id: 'nav-history',
        label: t('nav.history'),
        hint: t('command.hintHistory'),
        icon: <HistoryIcon size={16} aria-hidden="true" />,
        action: () => navigate('/history'),
        keywords: ['historie', 'history', 'dokumente', 'documents']
      },
      {
        id: 'nav-settings',
        label: t('nav.settings'),
        hint: t('command.hintSettings'),
        icon: <SettingsIcon size={16} aria-hidden="true" />,
        action: () => navigate('/settings'),
        keywords: ['einstellungen', 'settings', 'config', 'sprache', 'language']
      }
    ],
    [navigate, t]
  )

  const documentItems = useMemo<CommandItem[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return docs
      .filter(
        (d) => d.filename.toLowerCase().includes(q) || d.extractedText.toLowerCase().includes(q)
      )
      .slice(0, 15)
      .map((d) => ({
        id: `doc-${d.id}`,
        label: d.filename,
        hint: `${d.wordCount ?? 0} ${t('common.words')} · ${
          d.detectedLanguage === 'de' ? 'DE' : d.detectedLanguage === 'en' ? 'EN' : ''
        }`,
        icon: <FileText size={16} aria-hidden="true" />,
        action: () => navigate(`/document/${d.id}`)
      }))
  }, [docs, query, navigate, t])

  const allItems = useMemo(() => {
    const q = query.toLowerCase().trim()
    const filteredNav = q
      ? navigationItems.filter(
          (n) => n.label.toLowerCase().includes(q) || n.keywords?.some((k) => k.includes(q))
        )
      : navigationItems
    return [...filteredNav, ...documentItems]
  }, [query, navigationItems, documentItems])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allItems.length])

  const runSelected = useCallback(() => {
    const item = allItems[selectedIndex]
    if (item) {
      item.action()
      onClose()
    }
  }, [allItems, selectedIndex, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        runSelected()
      }
    },
    [allItems, runSelected, onClose]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative w-full max-w-xl rounded-2xl border border-brand-border bg-brand-card shadow-[0_0_80px_rgba(0,212,255,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-brand-border px-4 py-3">
          <Search size={16} className="text-brand-text-dim" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('command.placeholder')}
            className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-text-dim focus:outline-none"
          />
          <kbd className="hidden rounded border border-brand-border bg-brand-darker px-2 py-0.5 font-mono text-[10px] text-brand-text-dim sm:inline-block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {allItems.length === 0 ? (
            <p className="p-4 text-center text-sm text-brand-text-dim">
              {query ? t('command.empty') : t('command.emptyHint')}
            </p>
          ) : (
            allItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-brand-text hover:bg-brand-card-hover'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    idx === selectedIndex
                      ? 'bg-brand-cyan/20 text-brand-cyan'
                      : 'bg-brand-darker text-brand-text-dim'
                  }`}
                >
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.hint && <p className="truncate text-xs text-brand-text-dim">{item.hint}</p>}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-brand-border px-4 py-2 text-[10px] text-brand-text-dim">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-brand-border bg-brand-darker px-1.5 py-0.5 font-mono">
              ↑↓
            </kbd>
            {t('command.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-brand-border bg-brand-darker px-1.5 py-0.5 font-mono">
              ↵
            </kbd>
            {t('command.open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-brand-border bg-brand-darker px-1.5 py-0.5 font-mono">
              Esc
            </kbd>
            {t('command.close')}
          </span>
        </div>
      </div>
    </div>
  )
}
