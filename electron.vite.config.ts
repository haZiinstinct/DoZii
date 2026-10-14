import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ESM-only packages that must be bundled (not externalized)
const esmPackages = ['electron-store', 'conf', 'unpdf', 'ollama', 'tesseract.js']

/**
 * Verschaerft die CSP in index.html fuer den Build. In Production laedt die App
 * per file:// - dafuer gibt es keine HTTP-Kopfzeilen, die CSP aus
 * onHeadersReceived greift also nicht, sondern nur dieses Meta-Tag. Dev braucht
 * 'unsafe-inline' (Vite-HMR); im Build hat es nichts zu suchen. Ollama spricht
 * nur der Hauptprozess an, der Renderer braucht keine Verbindung dorthin.
 *
 * Findet das Plugin die erwarteten Stellen nicht, bricht der Build ab - sonst
 * wuerde eine geaenderte index.html die Verschaerfung still aushebeln.
 */
function productionCsp(): Plugin {
  const rules: Array<[string, string]> = [
    ["script-src 'self' 'unsafe-inline'", "script-src 'self'"],
    ["connect-src 'self' http://localhost:11434", "connect-src 'self'"]
  ]
  return {
    name: 'dozii-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      let out = html
      for (const [from, to] of rules) {
        if (!out.includes(from)) throw new Error(`CSP in index.html: "${from}" nicht gefunden`)
        out = out.replace(from, to)
      }
      return out
    }
  }
}

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
    plugins: [react(), tailwindcss(), productionCsp()],
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
