/**
 * Funktioniert net.fetch ueberhaupt mit der ollama-Bibliothek?
 *
 * Vitest kann das nicht beantworten - net.fetch existiert nur innerhalb von
 * Electron. Also startet dieses Skript ein echtes Electron ohne Fenster und
 * macht genau den Aufruf, den die App macht: Client mit net.fetch bauen,
 * streamen, Stuecke einsammeln.
 *
 * Das ist die Pruefung, die vor dem Release von 1.3.8 gefehlt hat.
 */
const { app, net } = require('electron')
const { Ollama } = require('ollama')

const raus = (code, ...zeilen) => {
  for (const z of zeilen) process.stdout.write(z + '\n')
  app.exit(code)
}

app.whenReady().then(async () => {
  try {
    const client = new Ollama({
      host: 'http://localhost:11434',
      fetch: net.fetch
    })

    // 1. Einfacher Aufruf ohne Strom - deckt list/show/ps mit ab.
    const tags = await client.list()
    process.stdout.write(`OK list: ${tags.models.length} Modelle\n`)

    // 2. Gestreamter Chat - der Pfad, um den es wirklich geht.
    const t0 = Date.now()
    const stream = await client.chat({
      model: 'qwen3:4b',
      stream: true,
      think: false,
      keep_alive: '5m',
      options: { temperature: 0.1, num_predict: 40 },
      messages: [
        { role: 'user', content: 'Antworte mit genau einem kurzen Satz: was ist eine Frist?' }
      ]
    })

    let text = ''
    let stuecke = 0
    for await (const teil of stream) {
      if (teil.message?.content) {
        text += teil.message.content
        stuecke++
      }
    }
    const sek = ((Date.now() - t0) / 1000).toFixed(1)
    raus(
      0,
      `OK chat gestreamt: ${stuecke} Stuecke in ${sek}s`,
      `Antwort: ${text.trim().slice(0, 120)}`,
      'ERGEBNIS: net.fetch funktioniert'
    )
  } catch (e) {
    raus(
      1,
      `FEHLER: ${e && e.message}`,
      `stack: ${e && e.stack}`,
      'ERGEBNIS: net.fetch funktioniert NICHT'
    )
  }
})

app.on('window-all-closed', () => {})
