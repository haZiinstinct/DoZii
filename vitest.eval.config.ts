import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Eigene Konfiguration fuer die Eval-Laeufe (`eval/*.eval.ts`).
 *
 * Getrennt von vitest.config.ts, weil diese Laeufe ein echtes Ollama
 * ansprechen und Minuten statt Millisekunden brauchen. Der normale `npm test`
 * sammelt sie nicht ein: Vitests Default-Include ist
 * `**\/*.{test,spec}.?(c|m)[jt]s?(x)` - `*.eval.ts` faellt da heraus.
 * `eval/lib/score.test.ts` laeuft dagegen bewusst im normalen Testlauf mit.
 *
 * Die Aliase spiegeln vitest.config.ts; ohne sie scheitert der Import von
 * '@shared/types' in den Parsern, die wir hier bewusst im Original benutzen.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@': resolve('src/renderer')
    }
  },
  test: {
    environment: 'node',
    include: ['eval/**/*.eval.ts'],
    // Ein 7B-Modell auf CPU braucht pro Fixture leicht eine Minute.
    testTimeout: 10 * 60 * 1000,
    hookTimeout: 10 * 60 * 1000,
    // Parallele Dateien wuerden sich um dieselbe GPU/CPU pruegeln und alles
    // langsamer machen - Evals laufen deshalb nacheinander.
    fileParallelism: false,
    // Vitest puffert console-Ausgaben normalerweise pro Test und verschluckt
    // dabei alles aus Modul-Ebene und aus afterAll uebersprungener Suites.
    // Hier ist die Konsolenausgabe aber das Ergebnis: Scorecard und
    // Skip-Meldung muessen ankommen.
    disableConsoleIntercept: true
  }
})
