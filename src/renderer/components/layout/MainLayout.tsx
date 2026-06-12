import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CustomTitlebar } from './CustomTitlebar'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '../CommandPalette'
import { UpdateToast } from '../UpdateToast'
import { useTheme } from '@/hooks/useTheme'

export function MainLayout() {
  // Mounting the theme hook here applies it globally
  useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+K / Cmd+K: command palette
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((p) => !p)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-brand-dark">
      <CustomTitlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <UpdateToast />
    </div>
  )
}
