import { useLocation, useNavigate } from 'react-router-dom'
import {
  Upload,
  FileSearch,
  History,
  Settings,
  Circle,
  Play,
  Loader2,
  Download
} from 'lucide-react'
import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { HardwareIndicator } from './HardwareIndicator'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/', label: 'Upload', icon: <Upload size={18} /> },
  { path: '/analysis', label: 'Analyse', icon: <FileSearch size={18} /> },
  { path: '/history', label: 'Historie', icon: <History size={18} /> },
  { path: '/settings', label: 'Einstellungen', icon: <Settings size={18} /> }
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { connected, model, installed, starting, startError, startOllama } = useOllamaStatus()

  return (
    <aside className="flex w-[260px] flex-col border-r border-brand-border bg-brand-darker">
      <nav className="flex flex-1 flex-col gap-1 p-3 pt-4">
        {navItems.map((item) => {
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan'
                  : 'border border-transparent text-brand-text-dim hover:bg-brand-card hover:text-brand-text'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Hardware / Runtime Indicator */}
      <div className="border-t border-brand-border p-3">
        <HardwareIndicator />
      </div>

      {/* Ollama Status */}
      <div className="border-t border-brand-border p-4">
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={
              connected
                ? 'fill-brand-green text-brand-green'
                : starting
                  ? 'fill-brand-amber text-brand-amber'
                  : 'fill-brand-red text-brand-red'
            }
          />
          <span className="text-xs text-brand-text-dim">
            {connected
              ? 'Ollama verbunden'
              : starting
                ? 'Ollama startet...'
                : installed
                  ? 'Ollama nicht aktiv'
                  : 'Ollama nicht installiert'}
          </span>
        </div>

        {connected && model && (
          <p className="mt-1 truncate pl-4 font-mono text-xs text-brand-text-dim">{model}</p>
        )}

        {/* Start button if installed but not connected */}
        {!connected && installed && (
          <button
            onClick={startOllama}
            disabled={starting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-2 text-xs font-medium text-brand-cyan transition-all hover:bg-brand-cyan/20 disabled:opacity-50"
          >
            {starting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Startet...
              </>
            ) : (
              <>
                <Play size={12} />
                Ollama starten
              </>
            )}
          </button>
        )}

        {/* Install hint if not installed */}
        {!connected && !installed && !starting && (
          <a
            href="https://ollama.com/download"
            onClick={(e) => {
              e.preventDefault()
              // Open external link via shell
              // Note: shell.openExternal is handled in main via setWindowOpenHandler
              window.open('https://ollama.com/download', '_blank')
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-medium text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            <Download size={12} />
            Ollama herunterladen
          </a>
        )}

        {startError && <p className="mt-2 text-xs text-brand-red">{startError}</p>}
      </div>
    </aside>
  )
}
