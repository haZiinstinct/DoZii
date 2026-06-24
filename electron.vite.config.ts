import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ESM-only packages that must be bundled (not externalized)
const esmPackages = ['electron-store', 'conf', 'unpdf', 'ollama', 'tesseract.js']

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      externalizeDeps: {
        exclude: esmPackages
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      externalizeDeps: true
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    publicDir: resolve('resources'),
    build: {
      rollupOptions: {
        output: {
          // Vendor-Chunks getrennt halten: React + Icons aendern sich selten,
          // bleiben so ueber App-Updates cachebar; Seiten werden via React.lazy
          // ohnehin in eigene Chunks gesplittet.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            icons: ['lucide-react'],
            markdown: ['react-markdown', 'remark-gfm']
          }
        }
      }
    }
  }
})
