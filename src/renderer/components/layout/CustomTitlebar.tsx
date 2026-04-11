import { Minus, Square, X } from 'lucide-react'

export function CustomTitlebar() {
  const handleMinimize = () => window.api.window.minimize()
  const handleMaximize = () => window.api.window.maximize()
  const handleClose = () => window.api.window.close()

  return (
    <div className="titlebar-drag flex h-12 items-center justify-between border-b border-brand-border bg-brand-darker px-5">
      <span className="font-mono text-lg font-bold text-brand-cyan">DoZii</span>

      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-card hover:text-brand-text"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text-dim transition-colors hover:bg-brand-red hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
