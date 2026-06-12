import { BrowserWindow, dialog, shell } from 'electron'
import { writeFile } from 'fs/promises'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getDocumentById } from './document-store.service'
import { logger } from './logger.service'

export interface PdfExportResult {
  ok: boolean
  path?: string
  error?: string
}

/**
 * Export an analysis result as a PDF. Uses Electron's printToPDF API by
 * rendering a temporary offscreen BrowserWindow with a styled HTML page.
 * No external dependencies required.
 */
export async function exportAnalysisAsPdf(
  analysisId: string,
  parent: BrowserWindow
): Promise<PdfExportResult> {
  const db = getDb()
  const analysis = db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.id, analysisId))
    .get()

  if (!analysis) {
    return { ok: false, error: 'Analyse nicht gefunden' }
  }

  const doc = getDocumentById(analysis.documentId)
  const docName = doc?.filename ?? 'Unbekanntes Dokument'

  // Ask user where to save
  const saveResult = await dialog.showSaveDialog(parent, {
    title: 'Analyse als PDF speichern',
    defaultPath: buildDefaultFilename(docName, analysis.mode),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, error: 'Abgebrochen' }
  }

  const html = buildAnalysisHtml({
    documentName: docName,
    mode: analysis.mode,
    modelUsed: analysis.modelUsed,
    createdAt: analysis.createdAt,
    resultMarkdown: analysis.result
  })

  // Render in an offscreen window
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      offscreen: true
    }
  })

  try {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    await pdfWin.loadURL(dataUrl)
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    })
    await writeFile(saveResult.filePath, pdfBuffer)
    logger.info('pdf-exporter', 'PDF exported', {
      analysisId,
      path: saveResult.filePath
    })

    // Show in file explorer
    shell.showItemInFolder(saveResult.filePath)

    return { ok: true, path: saveResult.filePath }
  } catch (err) {
    logger.error('pdf-exporter', 'PDF export failed', {
      analysisId,
      error: err instanceof Error ? err.message : String(err)
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'PDF-Export fehlgeschlagen'
    }
  } finally {
    pdfWin.destroy()
  }
}

function buildDefaultFilename(docName: string, mode: string): string {
  const safe = docName.replace(/\.[^.]+$/, '').replace(/[^\wäöüÄÖÜß .-]+/g, '_')
  const timestamp = new Date().toISOString().slice(0, 10)
  const modeLabel: Record<string, string> = {
    grammar: 'Rechtschreibung',
    formulation: 'Formulierungen',
    arbeitszeugnis: 'Zeugnis-Decoder',
    summary: 'Zusammenfassung',
    freeform: 'Analyse'
  }
  const label = modeLabel[mode] ?? 'Analyse'
  return `${safe} - ${label} - ${timestamp}.pdf`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Very simple markdown -> HTML. We don't pull in a full markdown library
 * here because the bundled analysis output is controlled by our own
 * prompts, and this runs in the main process where adding a dep would
 * bloat the bundle.
 */
function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.match(/^```/)) {
      if (!inCode) {
        out.push('<pre><code>')
        inCode = true
      } else {
        out.push('</code></pre>')
        inCode = false
      }
      continue
    }

    if (inCode) {
      out.push(escapeHtml(line))
      continue
    }

    // Headings
    if (line.match(/^####\s+/)) {
      out.push(`<h4>${inline(line.replace(/^####\s+/, ''))}</h4>`)
      continue
    }
    if (line.match(/^###\s+/)) {
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`)
      continue
    }
    if (line.match(/^##\s+/)) {
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`)
      continue
    }
    if (line.match(/^#\s+/)) {
      out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`)
      continue
    }

    // Blockquote
    if (line.match(/^>\s/)) {
      out.push(`<blockquote>${inline(line.replace(/^>\s/, ''))}</blockquote>`)
      continue
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
      continue
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
      continue
    }

    if (line.trim() === '') {
      out.push('<br>')
      continue
    }

    out.push(`<p>${inline(line)}</p>`)
  }

  // Wrap adjacent <li>s in <ul>
  let html = out.join('\n')
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
  return html
}

function inline(text: string): string {
  let t = escapeHtml(text)
  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  t = t.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
  // Inline code
  t = t.replace(/`([^`]+?)`/g, '<code>$1</code>')
  return t
}

interface BuildParams {
  documentName: string
  mode: string
  modelUsed: string
  createdAt: string
  resultMarkdown: string
}

function buildAnalysisHtml(params: BuildParams): string {
  const { documentName, mode, modelUsed, createdAt, resultMarkdown } = params
  const modeLabel: Record<string, string> = {
    grammar: 'Rechtschreibung & Grammatik',
    formulation: 'Bessere Formulierungen',
    arbeitszeugnis: 'Arbeitszeugnis-Decoder',
    summary: 'Zusammenfassung',
    freeform: 'Freie Frage'
  }
  const formatted = new Date(createdAt).toLocaleString('de-DE', {
    dateStyle: 'long',
    timeStyle: 'short'
  })
  // Strip the Strukturierte Daten JSON block for cleaner output
  const cleanMarkdown = resultMarkdown.replace(/##\s*Strukturierte\s*Daten[\s\S]*$/i, '').trim()

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>DoZii Analyse</title>
<style>
  @page { size: A4; margin: 1.5cm 1.8cm; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: #1a1a1f;
    line-height: 1.6;
    font-size: 11pt;
  }
  header {
    border-bottom: 2px solid #00a8cc;
    padding-bottom: 12pt;
    margin-bottom: 18pt;
  }
  .brand {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-weight: 700;
    color: #00a8cc;
    font-size: 18pt;
    letter-spacing: 0.5px;
  }
  .mode {
    font-size: 14pt;
    font-weight: 600;
    margin-top: 4pt;
    color: #0a0a0f;
  }
  .meta {
    color: #666;
    font-size: 9pt;
    margin-top: 8pt;
    display: flex;
    flex-wrap: wrap;
    gap: 16pt;
  }
  .meta div strong { color: #333; }
  h1, h2, h3, h4 { color: #0a0a0f; margin-top: 14pt; margin-bottom: 6pt; }
  h2 {
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #00a8cc;
    border-bottom: 1px solid #eee;
    padding-bottom: 4pt;
  }
  h3 { font-size: 11pt; }
  p { margin: 4pt 0; }
  ul, ol { margin: 4pt 0 8pt 18pt; }
  li { margin: 2pt 0; }
  blockquote {
    border-left: 3px solid #00a8cc;
    padding: 4pt 10pt;
    margin: 8pt 0;
    background: #f5fafc;
    font-style: italic;
    color: #555;
  }
  code {
    font-family: 'JetBrains Mono', Consolas, monospace;
    background: #f4f4f4;
    padding: 1pt 4pt;
    border-radius: 2pt;
    font-size: 9pt;
  }
  pre {
    background: #f4f4f4;
    border-radius: 4pt;
    padding: 8pt;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  pre code { background: transparent; padding: 0; }
  strong { color: #0a0a0f; }
  footer {
    margin-top: 30pt;
    padding-top: 10pt;
    border-top: 1px solid #eee;
    font-size: 8pt;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
<header>
  <div class="brand">DoZii</div>
  <div class="mode">${escapeHtml(modeLabel[mode] ?? mode)}</div>
  <div class="meta">
    <div><strong>Dokument:</strong> ${escapeHtml(documentName)}</div>
    <div><strong>Modell:</strong> ${escapeHtml(modelUsed)}</div>
    <div><strong>Erstellt:</strong> ${escapeHtml(formatted)}</div>
  </div>
</header>
<main>
${renderMarkdown(cleanMarkdown)}
</main>
<footer>
  Erstellt mit DoZii - Lokale Dokumentenanalyse. Kein Datenverkehr nach aussen.
</footer>
</body>
</html>`
}
