import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Vitest liest electron-vite.config nicht; Pfad-Aliases hier spiegeln.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@': resolve('src/renderer')
    }
  },
  test: {
    environment: 'node'
  }
})
