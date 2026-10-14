/* global setTimeout, AbortController, AbortSignal */
/**
 * Bricht net.fetch ab, solange der Server noch keine Antwortkopfzeilen
 * geschickt hat? Genau das muss der Stopp-Knopf auf Rechnern ohne
 * Grafikkarte koennen (siehe stream-run.ts). Braucht kein Ollama: ein
 * lokaler Server haelt die Antwort 10 s zurueck, abgebrochen wird nach 300 ms
 * ueber AbortSignal.any - so wie getRunClient() es zusammensetzt.
 *
 * Start: npx electron scripts/netfetch-abort-probe.cjs
 */
const http = require('node:http')
const { app, net } = require('electron')

const raus = (code, ...zeilen) => {
  for (const z of zeilen) process.stdout.write(z + '\n')
  app.exit(code)
}

app.whenReady().then(async () => {
  const server = http.createServer((_req, res) => {
    setTimeout(() => res.end('zu spaet'), 10_000)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/api/chat`

  const lauf = new AbortController()
  const eigenes = new AbortController() // wie das Signal, das ollama-js selbst setzt
  setTimeout(() => lauf.abort(), 300)

  const t0 = Date.now()
  try {
    await net.fetch(url, { signal: AbortSignal.any([eigenes.signal, lauf.signal]) })
    raus(1, 'FEHLER: Anfrage lief durch statt abzubrechen')
  } catch (e) {
    const ms = Date.now() - t0
    const ok = ms < 2000 && /abort/i.test(`${e && e.name} ${e && e.message}`)
    raus(
      ok ? 0 : 1,
      `Abbruch nach ${ms} ms: ${e && e.name}: ${e && e.message}`,
      ok ? 'ERGEBNIS: net.fetch bricht vor den Kopfzeilen ab' : 'ERGEBNIS: Abbruch greift NICHT'
    )
  } finally {
    server.close()
  }
})

app.on('window-all-closed', () => {})
