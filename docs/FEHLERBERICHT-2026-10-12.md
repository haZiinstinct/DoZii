# Fehlerbericht und Abarbeitungsliste (Audit 1.3.8, 2026-10-12)

Diese Liste ist zum Abhaken gedacht. Jeder Punkt hat eine ID, die Fundstelle, den konkreten
Fix und ein Prüfkriterium, mit dem sich der Fix nachweisen lässt. Hintergründe, Reproduktionen
und die Begründung der Einstufung stehen im ausführlichen Bericht
[`AUDIT-2026-10-12.md`](AUDIT-2026-10-12.md); die IDs sind dort identisch.

Vorgehen pro Punkt: Kästchen abhaken, Commit-Hash in die Spalte „Erledigt in" eintragen,
bei bewusstem Nicht-Beheben den Grund nach `OFFENE-PUNKTE.md` übernehmen.

Aufwand: **S** unter einer Stunde · **M** ein halber Tag · **L** mehrere Tage.

---

## Paket 1 · Sofort (Patch-Release 1.3.9)

Kleine, risikoarme Änderungen mit großem Nutzen. Zusammen etwa ein Arbeitstag.

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [x] | H6 | Aktenzeichen mit gemischter Schreibweise schwärzen | S | 24897e2 |
| [x] | H3 | `sharp` auf 0.35.5 heben | S | 631c124 |
| [x] | M1 | Ersteindruck über `chatOnce` statt eigenem Ollama-Client | S | 5dd042b |
| [x] | H8 | Willkommens-Assistent: Fehlerpfad im Hardware-Scan | S | 20d58d3 |
| [x] | M3 | Settings vor dem Speichern bereinigen | S | 7c82945 |
| [x] | M23 | Fristen-Test „erfindet keine Frist" auf 0 schärfen | S | 182b38f |
| [x] | M22 | `autoInstallOnAppQuit` auf `false` oder Kommentar anpassen | S | be57c90 |
| [x] | M4 | Chat-Sprache aus `settings.language` | S | 43472ec |
| [x] | L20a | Patch-Updates: react-router-dom 7.18.4, vitest 4.1.11, unpdf 1.8, better-sqlite3 12.11 | S | 631c124 |
| [x] | L18 | README-Badge 1.3.8, Überschrift „Analyse-Modi", `engines` in package.json, eval/README (Vier-Tage-Fiktion, `eval`-Skript) | S | 7dab9b3 |

### H6 · Aktenzeichen-Schwärzung
- Datei: `src/shared/redaction.ts:212`
- Fix: `REF_TOKEN` von `[A-Z]{1,4}` auf `[A-Za-z]{1,4}` ändern.
- Umgesetzt enger als vorgeschlagen: gemischte Schreibweise (`Ca`, `Js`) nur mit folgender
  Zahl, sonst frisst der Wert das Folgewort („Az. 12/345 Bitte …").
- Prüfung: Test in `redaction.test.ts` mit `4 Ca 1234/24`, `12 Js 456/24`, `3 Sa 78/25`,
  `Vorgangsnummer: ab12345`; Erwartung jeweils vollständig `[Aktenzeichen geschwaerzt]`.

### H3 · sharp
- Lokal nur Node-Probe (sharp 0.35.5 verarbeitet ein PNG); `build:win` geht lokal wegen Smart
  App Control nicht – JPG/PNG-OCR im CI-Installer prüfen.
- Datei: `package.json`
- Fix: `"sharp": "^0.35.5"`, `npm install`, `npm run build:win` lokal einmal durchlaufen lassen
  (natives Modul, `postinstall` baut neu).
- Prüfung: `npm audit` ohne sharp-Eintrag; ein JPG und ein PNG importieren, OCR liefert Text.

### M1 · Ersteindruck
- Datei: `src/main/services/first-impression.service.ts:13-21,79-95`
- Fix: lokalen `getClient()` und `client`/`clientHost` entfernen; Aufruf durch
  `chatOnce({ model, system: prompt.system, prompt: prompt.user, temperature: 0.1, numCtx: 2048 })`
  ersetzen. `num_predict` bei Bedarf als Option in `chatOnce` ergänzen.
- Prüfung: mit `qwen3:4b` ein Dokument importieren; Log zeigt „Generated successfully", nicht
  „Could not parse JSON". Kommentar in `ollama-client.service.ts:48-52` („elf Aufrufstellen")
  anpassen.

### H8 · Willkommens-Assistent
- Datei: `src/renderer/pages/WelcomeWizard.tsx:58-65`
- Fix: `scan()` in `try { … } catch { setScanError(…) } finally { setScanning(false) }`
  kapseln; bei Fehler Hinweis anzeigen, Weiter-Knopf freigeben.
- Prüfung: `hardware.detect` im Dev-Build künstlich werfen lassen; der Assistent bleibt bedienbar.

### M3 · Settings bereinigen
- Datei: `src/main/services/settings.service.ts:178-184`, `src/main/ipc/settings.ipc.ts:21`
- Fix: in `updateSettings` `const next = sanitizeSettings({ ...current, ...partial })`; im
  IPC-Handler `partial` auf `object` prüfen und nur bekannte Schlüssel durchlassen.
- Prüfung: `settings.update({ ollamaUrl: 'http://evil.example' })` aus der DevTools-Konsole;
  Datei `dozii-settings.json` enthält danach weiterhin `localhost`, kein Warn-Log im Sekundentakt.

### M23 · Test schärfen
- Ergebnis: „ohne Frist" liefert 0 Anker, alle Bescheide mit Frist mindestens einen. Neu
  aufgedeckt: im Gebührenbescheid wird der feste Zahlungstermin („bis zum 30.04.2026 … zu
  überweisen") nicht als `zahlung` erkannt – als `it.fails` markiert, gehört zu Paket 2.
- Datei: `src/shared/fristen-radar.test.ts:135-142`
- Fix: `toBeLessThanOrEqual(1)` → `toHaveLength(0)`; Trefferquote von 60 % anheben oder den
  Test in konkrete Einzelfälle zerlegen. Schlägt der Test dann fehl, ist das ein echter
  Befund für Paket 2 (H4, M11).

### M22 · Auto-Update
- Entscheidung: Kommentar angepasst. Download nur auf Klick, und `update.readyDesc` sagt
  bereits „Wird beim nächsten Beenden installiert".
- Datei: `src/main/services/updater.service.ts:43`
- Fix: entweder `autoInstallOnAppQuit = false` (Nutzer klickt „Installieren") oder den
  Kommentar und den Einstellungstext an das tatsächliche Verhalten anpassen.

### M4 · Chat-Sprache
- Datei: `src/main/services/chat.service.ts:87`
- Fix: `const language = getSettings().language || 'de'`; `buildSystemPrompt` um die Sprachen
  jenseits de/en erweitern (Muster aus `language-directive.ts`).
- Prüfung: UI auf Russisch, deutsches Dokument, Chat antwortet russisch.

---

## Paket 2 · Nächstes Minor (1.4.0)

Fachliche Korrektheit des Fristen-Radars, Streaming-Stabilität, Packaging, Prompt-Härtung.

### Fristen-Radar

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [x] | H4 | Geburtsdatum im Briefkopf wird nicht mehr Fristbeginn | M | 434d177, 910c705 |
| [x] | H5 | Bekanntgabefiktion: kein „abgelaufen" vor dem echten Fristende | M | 910c705 |
| [x] | M9 | Belegprüfung faltet Umlaute (ae/oe/ue/ss) | S | 6641203 |
| [x] | M10 | Einheitliche Plausibilitätsgrenze für Fristdauern | S | 6641203 |
| [x] | M11 | Zahlwörter vollständig, `widerruf`/`kuendigung` in `KIND_HINTS` | S | ea94fd8 |
| [x] | M13 | Kündigungsschutzklage (3 Wochen, § 4 KSchG) im Regelkatalog | M | b8fb14f |
| [x] | M14 | Keine § 193-Verschiebung bei expliziten Endterminen (`kuendigung`) | S | 16ace31 |
| [x] | L8 | `parseGermanDate` validiert Kalender und verankert am Wortanfang | S | c71776d |
| [x] | L19 | Eval misst den Produktionspfad (`findDeadlineAnchors` + `mergeAnchors`) | M | 9be9ef0 |

**H4** · `src/shared/fristen-radar.ts:136-144`, `src/main/services/deadline.service.ts:170-176`
- Fix: Datumstreffer verwerfen, denen innerhalb von 25 Zeichen `geb`, `geburt`, `geboren`
  oder `*` vorausgeht; bevorzugt eine Zeile `^(\S+,\s*)?DATUM$` als Dokumentdatum nehmen.
  In `mergeAnchors` bei gleicher Fristart den Anker mit dem späteren Startdatum wählen,
  wenn der Regel-Anker älter als 2 Jahre ist.
- Prüfung: Fixture mit `Geburtsdatum: 05.06.1985` vor `12.03.2026`; Erwartung
  Start `2026-03-12`, keine Frist vor 2026.

**H5** · `src/shared/deadline-calc.ts:146-170`, `deadline-extract.prompt.ts:28`,
`fristen-radar.ts:279`, `eval/README.md`
- Fix: für Anker mit `source: 'computed'` und Start = Bescheiddatum zusätzlich
  `dueDateLatestIso = addDays(start, 4)` rechnen; `urgency: 'expired'` erst, wenn auch das
  späte Datum vorbei ist; Karte zeigt „frühestens … / spätestens … (Bekanntgabe +4 Tage,
  § 41 VwVfG)". Kommentare auf vier Tage korrigieren.
- Prüfung: Bescheid 02.03.2026, heute 03.04.2026 → nicht „abgelaufen", sondern „noch 3 Tage
  (spätestens)".

**M9** · `src/main/lib/parse-deadline-anchors.ts:94-96,130`
- Fix: `normalizeForMatch` um ä→ae, ö→oe, ü→ue, ß→ss, typografische Anführungszeichen und
  Bindestriche erweitern (Vorlage `parse-letter.ts:31-40`).
- Prüfung: Testfall Dokument „können Sie", Zitat „koennen Sie" → 1 Anker.

**M10** · `parse-deadline-anchors.ts:49` vs `deadline-calc.ts:42-47`
- Fix: `MAX_PERIOD_VALUE` nach `deadline-calc` ziehen und je Einheit übernehmen (Tag 730,
  Woche 104, Monat 24, Jahr 2).

**M11** · `src/shared/fristen-radar.ts:38-48,71`, `klausel-radar.ts:40-56`
- Fix: `NUMBER_WORDS` in ein gemeinsames Modul (`src/shared/number-words.ts`) ziehen, beide
  Radare importieren; `KIND_HINTS` um `widerruf`, `kuendigung` ergänzen.
- Prüfung: „innerhalb von vierzehn Tagen nach Zustellung Einspruch" → 1 Anker `einspruch`.

**M13** · `src/shared/deadline-rules.ts:225-233,266,308-331`
- Umgesetzt: KSchG-Regel für `klage` im Arbeitsrechts-Kontext, Radar erkennt die
  Arbeitgeberkündigung. Den Ein-Jahres-Zweig habe ich entfernt statt gekoppelt: ob eine
  Belehrung fehlt, ist am Text (OCR) nicht sicher erkennbar.
- Fix: Regel `kuendigungsschutzklage` (3 Wochen ab Zugang, § 4 KSchG) mit Hinweis
  „Kündigungsschreiben erkannt"; den toten Ein-Jahres-Zweig entweder an das Fehlen einer
  Rechtsbehelfsbelehrung im Text koppeln oder entfernen.

**M14** · `deadline-calc.ts:160-161`
- Umgesetzt für alle `kuendigung`-Fristen (§ 193 BGB gilt für Kündigungsfristen generell nicht).
- Fix: § 193 nur auf Fristen anwenden, bei denen eine Handlung bis zum Termin fällig ist;
  für `kuendigung` mit explizitem Datum den Termin unverändert lassen und eine Notiz
  „Zugang vor dem Termin erforderlich" setzen.

**Zusätzlich (aus M23):** feste Termine ohne Fristdauer („bis zum … zu überweisen") erkennt
der Radar jetzt – `438f1f0`. Nach dem Security-Review zu H4 übernimmt `mergeAnchors` ein
Modell-Startdatum nur noch mit wörtlichem Beleg (`910c705`).

### Streaming und Hauptprozess

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [x] | H7 | Lauf-ID pro Stream, Renderer bricht alten Lauf vor neuem ab | M | c104a51 |
| [x] | M5 | AbortController pro Stream statt `client.abort()` global | M | c104a51 |
| [x] | M6 | `will-navigate` im Hauptprozess blockieren | S | 07df081 |
| [x] | M7 | Production-CSP ohne `unsafe-inline` und ohne Ollama-Host | S | 07df081 |
| [x] | M8 | Ollama-Stop nur für den eigenen Kindprozess oder mit Hinweis | S | 13ebf2c |
| [x] | M12 | Prompt-Härtung: Sentinel und Injection-Satz in allen Prompts, Links als Text | M | 68715bd |
| [x] | L1 | Logger rotiert zur Laufzeit (Tageswechsel, Größenlimit) | S | 6e6eebe |
| [x] | L2 | `requestSingleInstanceLock`: nach `quit()` nichts mehr registrieren | S | 07df081 |
| [x] | L3 | `deleteDocument`: Pfadprüfung mit `path.relative` statt `startsWith` | S | 584b414 |
| [x] | L4 | Typprüfung für `ollama:pullModel/selectModel/deleteModel` | S | 584b414 |
| [x] | L6 | Chat-Historie paarweise kürzen | S | 74d056b |
| [x] | L7 | `fitTextToTokenBudget`: `lastBreak >= 0 &&` Guard | S | 584b414 |
| [x] | L21 | `logs:write`: `meta` auf Größe begrenzen, keine freien Strings loggen | S | 69a9371 |

**H7 + M5** · `src/renderer/hooks/useStreamingInvocation.ts:68-85`,
`src/main/services/ollama-client.service.ts:70,291,399`, `src/main/ipc/analysis.ipc.ts`
- Fix: `analysis:run` erzeugt eine `runId` (UUID), sendet sie als erstes Event und in jedem
  `chunk`/`phase`/`complete`/`error`; der Renderer verwirft Events fremder IDs. Jeder Stream
  bekommt einen eigenen `AbortController` (ollama-js akzeptiert `signal` nicht direkt, daher
  Client-Instanz pro Lauf oder Wrapper um `fetch`); `abortAllStreams()` nur noch für Fenster
  schließen. `run()` ruft vorher `abort()` auf. `showChat` erst bei `done`/`aborted`.
- Prüfung: Modus wechseln, während ein Lauf streamt → nur der neue Text erscheint; Pull läuft
  weiter, wenn eine Analyse gestoppt wird.

**M6** · `src/main/index.ts`
- Fix: `win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(devUrl) &&
  !url.startsWith('file:')) e.preventDefault() })`; zusätzlich `will-redirect` gleich behandeln.

**M7** · `src/renderer/index.html:8`, `electron.vite.config.ts`
- Fix: Vite-Plugin `transformIndexHtml`, das im Build `'unsafe-inline'` aus `script-src` und
  `http://localhost:11434` aus `connect-src` entfernt.
- Prüfung: `out/renderer/index.html` nach `npm run build` prüfen.

**M12** · `src/main/prompts/*.prompt.ts`, `MarkdownView.tsx:93-101`
- Fix: `wrapDocument(text)` in `prompt-builder.ts`, das einen zufälligen Sentinel
  (`<<<DOKUMENT-a3f9>>> … <<<ENDE-a3f9>>>`) setzt und im System-Prompt erklärt, dass Text
  zwischen den Markern Daten sind. Satz aus `letter.prompt.ts:574` übernehmen. In
  `freeform.prompt.ts:91` die Nutzerfrage vor das Dokument stellen. In `MarkdownView` `a`
  als `<span>` rendern oder Bestätigungsdialog vor `openExternal`.

**Anmerkungen zum Block:** H7 – die runId erzeugt der Renderer (vom Hauptprozess geprüft),
nicht der Hauptprozess. M5 – AbortController pro Lauf über AsyncLocalStorage, in echtem Electron
nachgewiesen (`scripts/netfetch-abort-probe.cjs`). M7 – die eigentliche Lücke war das Meta-Tag:
unter `file://` greift die Header-CSP nicht. L1 – bei 5 MB eine Folgedatei, danach Pause bis
morgen. M8 – fremdes Ollama wird nicht mehr beendet, die Einstellungen nennen den Grund.

### Packaging und CI

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [ ] | M2 | `!src{,/**/*}`, `!eval{,/**/*}`; Ressourcen nur einmal im Paket | S | |
| [ ] | L20b | Dependabot/Renovate, `npm audit --audit-level=high` in CI, `concurrency`-Block | S | |

**M2** · `electron-builder.yml:6-9,21-23,86-88`, `electron.vite.config.ts:36`
- Fix: Muster ändern; `publicDir` auf `resources/public` (nur Icons, Fonts) zeigen lassen,
  `tesseract/` in `resources/` belassen und nur über `extraResources` ausliefern,
  `asarUnpack` entfernen (Tesseract liest aus `process.resourcesPath`).
- Prüfung: `npx asar list dist/win-unpacked/resources/app.asar | grep -c '^/src/'` → 0;
  Installer-Größe vorher/nachher notieren.

### Renderer

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [ ] | M16 | Ordner-Import per Tastatur erreichbar, kein Button in `role=button` | S | |
| [ ] | M17 | Lade-Zustände mit `catch`/`finally`; Sidebar zeigt `selectedModel` | S | |
| [ ] | M18 | Dialog-Abbruch als `cancelled: true` statt String „Abgebrochen" | S | |
| [ ] | M19 | Kommandopalette: Fokusfalle, Escape global, Fokus-Rückgabe | S | |
| [ ] | M20 | Dokument löschen mit Rückfrage und Fehlerbehandlung | S | |
| [ ] | M21 | Hart kodierte Strings durch `t()` ersetzen (Liste im Audit) | S | |
| [ ] | L13 | Globale Fehler-Handler und offene Promises mit `catch` | S | |
| [ ] | L14 | `useOllamaStatus` einmal pro App; Ersteindruck per Push statt Polling | S | |
| [ ] | L15 | `role="radiogroup"` für Auswahlen; Export-Menü mit Escape/Outside-Click | S | |
| [ ] | L16 | `handleSaveOllamaUrl` erst nach IPC-Erfolg als gespeichert markieren | S | |

**M18** · `src/main/services/export.service.ts:191`, `pdf-exporter.service.ts:52`,
`DocumentViewPage.tsx:189`, `AnalysisPage.tsx:375`
- Fix: `ExportResult` um `cancelled?: true` erweitern; Renderer prüft das Feld statt des
  Strings.

---

## Paket 3 · Größere Vorhaben

| | ID | Titel | Aufwand | Erledigt in |
|---|---|---|---|---|
| [ ] | H1 | Electron 33 → 39+ (mit electron-builder 26) | L | |
| [ ] | H2 | `xlsx` ersetzen (SheetJS-CDN-Tarball 0.20.x oder `exceljs`) | M | |
| [ ] | M15 | Schwärzung: Fehlalarme (0-Nummern, Kreditkarte), Lücken (IBAN klein, Steuernummer, Geb.-Datum), Regex-Laufzeit | M | |
| [ ] | L5 | Duplikate zusammenführen: `MODE_LABELS`, Monatsnamen, Zahlwörter, `CHARS_PER_TOKEN` | S | |
| [ ] | L17 | Typen schärfen: `Analysis.mode`, `DocumentTypeCategory`, `as const satisfies` für Anker-Enums | S | |
| [ ] | L9 | `stripThinking`: Orphan-Regel nur bei Zeilenanfang | S | |
| [ ] | L10 | `htmlToText`: nacktes `<` tolerieren | S | |
| [ ] | L11 | RTF: Links, `####`, Flanking-Regel für `*` | S | |
| [ ] | L12 | `chunk-text`: Dokumentation der Budget-Obergrenze korrigieren | S | |
| [ ] | — | Settings-Provider im Renderer statt fünf `settings.get()` | M | |
| [ ] | — | `AnalysisPage` in Chat- und Export-Komponenten aufteilen | M | |

**H1** · `package.json`
- Vorgehen: Branch `chore/electron-upgrade`; `electron@^39`, `electron-builder@^26`,
  `@electron-toolkit/utils@^4`; `src/main/db/node-sqlite.d.ts` gegen die neue Node-Version
  prüfen (ab Node 22.13 liefert `@types/node` eigene Typen); `scripts/netfetch-probe.cjs`
  erneut laufen lassen; Release-Checkliste komplett durchgehen.
- Prüfung: `npm audit` ohne Electron-Einträge; Installer auf frischem Windows-Profil.

**H2** · `src/main/services/xlsx-extractor.service.ts`
- Vorgehen: `exceljs` prüfen (ESM-fähig, aktiv gepflegt); Ausgabe bleibt `--- Sheet ---` plus
  CSV je Blatt; `extractXlsx` wird async. Alternativ `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`.
- Prüfung: Fixture mit `__proto__`-Zellennamen importieren; `({}).polluted` bleibt `undefined`.

**M15** · `src/shared/redaction.ts:182-258`
- Fix-Liste: `PHONE_RE` nur mit Trennern oder Vorwahl-Präfix; Kreditkarte nur bei Luhn **und**
  bekannten Präfixen (4, 51–55, 34/37); `IBAN_RE` case-insensitiv; `BIC` als eigenes Muster;
  `BIRTHDATE_RE` um `Geb.-Datum`, `geb.`, `*`; Steuer-ID mit Prüfziffer; `REF_VALUE` und
  `EMAIL_RE` mit Längenbegrenzung (`{1,80}`) gegen quadratische Laufzeit.
- Prüfung: Testfälle aus dem Audit (M15) in `redaction.test.ts`; Laufzeittest mit
  `'Az ' + 'A1-'.repeat(20000)` unter 100 ms.

---

## Nicht beheben, nur dokumentieren

Diese Punkte sind bewusst offen und gehören in `OFFENE-PUNKTE.md`, falls sie dort noch fehlen:

- [ ] Renderer kann über `documents:import` jeden lesbaren Pfad importieren (L-Kategorie im
  Audit, nur mit kompromittiertem Renderer relevant; Dateityp- und Größenprüfung vorhanden).
- [ ] CI läuft nur auf `windows-latest`; macOS/Linux werden erst im Release gebaut.

## Fortschritt

| Paket | Punkte | Erledigt |
|---|---|---|
| 1 · Sofort | 10 | 10 |
| 2 · Minor | 34 | 0 |
| 3 · Größer | 11 | 0 |
