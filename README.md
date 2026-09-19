<div align="center">

<img src="docs/banner.svg" alt="DoZii — Lokale, 100 % offline Dokumentenanalyse mit KI" width="100%" />

<h1>DoZii</h1>

<p><b>Lokale, 100&nbsp;% offline Dokumentenanalyse mit KI.</b><br />
Verträge, Arbeitszeugnisse, Bescheide und Briefe verständlich machen — komplett auf
deinem Rechner. Keine Cloud, keine Telemetrie, kein CDN.</p>

<p>
  <a href="https://github.com/haZiinstinct/DoZii/releases/latest/download/DoZii-Setup.exe"><img alt="DoZii herunterladen" src="https://img.shields.io/badge/%E2%AC%87%20download-DoZii--Setup.exe-00d4ff?style=for-the-badge&labelColor=0a0a0f" /></a>
</p>

<p>
  <a href="https://github.com/haZiinstinct/DoZii/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/haZiinstinct/DoZii/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.3.0-00d4ff?labelColor=0a0a0f" />
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-00d4ff?labelColor=0a0a0f" />
  <img alt="Electron 33" src="https://img.shields.io/badge/Electron-33-00d4ff?labelColor=0a0a0f&logo=electron&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-00d4ff?labelColor=0a0a0f&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-00d4ff?labelColor=0a0a0f&logo=typescript&logoColor=white" />
  <img alt="Windows 10/11" src="https://img.shields.io/badge/Windows-10%2F11-94a3b8?labelColor=0a0a0f&logo=windows&logoColor=white" />
</p>

<sub><a href="#-highlights">Highlights</a> · <a href="#-die-5-analyse-modi">Analyse-Modi</a> · <a href="#-loslegen">Loslegen</a> · <a href="#-datenschutz--datenablage">Datenschutz</a> · <a href="#-entwicklung">Entwicklung</a></sub>

</div>

---

DoZii liest deine Dokumente und erklärt sie dir — den Bescheid vom Amt in normaler
Sprache, den Vertrag Klausel für Klausel, das Arbeitszeugnis mit Note. Auf Wunsch schreibt
es dir auch gleich den Widerspruch. Die KI läuft dabei über ein **lokales** [Ollama](https://ollama.com) auf
deinem eigenen Rechner: Sensible Unterlagen wie Verträge, Zeugnisse oder Amtsbescheide
verlassen deinen Computer **nie**.

Kein Login, kein Abo, kein Hochladen. Eine strikte Content-Security-Policy blockiert
jeden Netzwerkzugriff außer zu deinem lokalen Ollama — DoZii funktioniert vollständig
offline.

## ✨ Highlights

- 🗣️ **Einfach erklärt** — Amtsdeutsch in normale Sprache: Was will man von dir? Was passiert,
  wenn du nichts tust? Bis wann musst du reagieren? Mit Dringlichkeits-Ampel und
  abhakbarer Schritt-für-Schritt-Liste
- ⏰ **Fristen-Radar** — erkennt Fristen, rechnet das Enddatum **selbst** aus (§§ 187/188/193 BGB
  inkl. Feiertagen und Werktagsregel — nicht die KI, sondern echter Code), zeigt einen
  Countdown und exportiert in deinen Kalender
- 🕵️ **Arbeitszeugnis-Decoder** — **Dual-Grading** (Inhalts- *und* Struktur-Note), **80+ versteckte
  Codes** der deutschen Zeugnissprache, evidenzbasierte Befunde mit **2-Pass-Verifizierung**
- 📜 **Vertrags-Check** — jede Klausel mit Zitat, Ampel und Klartext-Erklärung; dazu, was
  üblich wäre und wie du es ändern lassen kannst
- ✍️ **Antwort-Generator** — fertiger Briefentwurf: Widerspruch, Einspruch, Antwort auf eine
  Mahnung, Zeugnis-Nachbesserung. Platzhalter füllst du direkt im Brief aus
- 📖 **Behörden-Glossar** — 120+ Begriffe von „Bestandskraft" bis „Vorfälligkeitsentschädigung",
  erklärt per Klick im Text. Komplett lokal, kein Modellaufruf
- 📎 **Auch Scans** — gescannte PDFs werden automatisch per **OCR** gelesen; dazu PDF, DOCX,
  XLSX, Bilder, `.txt`/`.md`/`.eml` — oder Text einfach **einfügen**
- 🌍 **9 Sprachen — UI *und* KI-Ausgabe** — Deutsch, English, Español, Français, Português,
  Русский, العربية (mit RTL-Layout), 日本語, 中文
- 🔍 **Belege statt Behauptungen** — jeder Befund wird gegen das Original geprüft; was sich
  nicht belegen lässt, steht getrennt und ist als unbelegt gekennzeichnet. Ein Klick
  markiert die Fundstelle im Originaltext
- ♿ **Für alle lesbar** — Vorlesen über die Systemstimmen, größere Schrift, höherer Kontrast
- 🔒 **Schwärzen vor dem Export** — IBAN, Aktenzeichen, Telefonnummer und mehr werden
  unkenntlich, bevor du die Analyse weitergibst
- 📤 **Export** — PDF, Word-kompatibles RTF, Markdown, Text; Fristen als `.ics`
- 🧠 **Hardware-aware** — erkennt CPU/RAM/GPU, empfiehlt ein Modell und nutzt automatisch das
  volle Kontextfenster; zu lange Dokumente werden abschnittsweise analysiert statt gekürzt
- 🔌 **Ollama-Lifecycle in der App** — Start/Stop/Status direkt per Button, kein Terminal nötig
- 📏 **Messbar statt geraten** — `npm run eval` misst Notenabweichung, Belegquote und
  Halluzinationsrate gegen ein festes Set von Beispieldokumenten
- 🔐 **100 % offline** — strikte CSP, keine Telemetrie; Fonts, Icons und OCR-Daten sind lokal
  gebündelt

## 🖼️ Screenshots

> 📸 *Screenshots folgen in Kürze* — ein Blick in die App: Welcome-Wizard mit
> Hardware-Erkennung, Dokument-Upload mit Auto-Ersteindruck, der Arbeitszeugnis-Decoder
> mit Dual-Grading, der Chat und die Einstellungen.

<!-- Sobald die Bilder unter docs/ liegen, diesen Block einkommentieren:
<div align="center">
  <img src="docs/screenshot-analyse.png" alt="Arbeitszeugnis-Decoder mit Dual-Grading" width="90%" />
  <br /><br />
  <img src="docs/screenshot-upload.png" alt="Upload mit Auto-Ersteindruck" width="45%" />
  <img src="docs/screenshot-chat.png" alt="Chat pro Dokument" width="45%" />
</div>
-->

## 📋 Die Analyse-Modi

| Modus | Was er macht |
| --- | --- |
| 🗣️ **Einfach erklärt** | Übersetzt Amtsdeutsch in normale Sprache: Worum geht es, was will man von dir, was passiert ohne Reaktion, was kannst du tun — mit Fristen und Dringlichkeits-Ampel |
| 🕵️ **Arbeitszeugnis-Decoder** | Dekodiert 80+ versteckte Codes, vergibt eine Inhalts- **und** eine Struktur-Note und verifiziert jeden Befund in einem zweiten Durchgang |
| 📜 **Vertrags-Check** | Prüft Klausel für Klausel mit Ampel: Laufzeit, automatische Verlängerung, Preisanpassung, Kaution, Wettbewerbsverbot, Gerichtsstand … |
| ✍️ **Rechtschreibung & Grammatik** | Findet echte Fehler nach Duden-Standard und filtert bloße Stilmeinungen heraus — mit Zitat und Korrekturvorschlag |
| 💬 **Formulierungen** | Verbessert Wortwahl und Satzfluss, ohne den Sinn zu verändern |
| 📝 **Zusammenfassung** | Bringt lange Dokumente auf ihre Kernaussagen, mit Eckdaten und Handlungsbedarf |
| ❓ **Freie Frage** | Stell eine beliebige Frage zum Dokument — und chatte anschließend weiter |
| 📨 **Antwort schreiben** | Kein eigener Modus, sondern ein Knopf an jedem Ergebnis: macht daraus einen fertigen Briefentwurf |

> Du musst dich nicht entscheiden: DoZii erkennt beim Import, worum es geht, und startet
> den passenden Modus von selbst. Abschaltbar in den Einstellungen.

## 🚀 Loslegen

1. **[`DoZii-Setup.exe` herunterladen](https://github.com/haZiinstinct/DoZii/releases/latest)** und installieren.
2. Beim ersten Start hilft der **Welcome-Wizard**: er erkennt deine Hardware und führt dich durch das Ollama-Setup.
3. **[Ollama](https://ollama.com/download)** installieren (falls noch nicht vorhanden) und ein Modell laden — DoZii schlägt passend zur Hardware vor:
   ```bash
   ollama pull qwen2.5:3b     # solide Wahl für die meisten CPUs
   ```
4. Dokument reinziehen, Modus wählen, analysieren — und bei Bedarf im Chat nachhaken.

> **SmartScreen-Hinweis:** Der Installer ist (noch) nicht code-signiert. Windows zeigt
> beim ersten Start „Unbekannter Herausgeber" — über **„Weitere Informationen" →
> „Trotzdem ausführen"** geht es weiter.

**Voraussetzungen**

- Windows 10/11 (64-bit) — es gibt auch eine **Portable-Version** ohne Installation.
  macOS- und Linux-Builds (dmg/zip, AppImage/deb) werden mitgebaut, sind aber nicht
  signiert und bekommen keine automatischen Updates
- [Ollama](https://ollama.com/download) installiert (DoZii hilft beim Einrichten)
- Mind. 8&nbsp;GB RAM; 16&nbsp;GB+ oder eine GPU mit 8&nbsp;GB+ VRAM für stärkere Modelle

## 🔒 Datenschutz & Datenablage

- Alle Dokumente, Analysen, Fristen, Chats und Einstellungen liegen lokal unter `%APPDATA%\DoZii`
- Logs (14 Tage, **ohne** Dokumentinhalte) ebenfalls dort unter `logs\`
- Einziger Netzwerkzugriff neben Ollama (`localhost:11434`): der **optionale** Update-Check gegen GitHub — in den Einstellungen abschaltbar
- Bei der Deinstallation fragt der Uninstaller, ob deine Nutzerdaten mitgelöscht werden sollen

## 🛠️ Entwicklung

Electron 33 · electron-vite · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
better-sqlite3 + Drizzle ORM · Ollama · unpdf / mammoth / xlsx / tesseract.js / sharp.
Qualität gesichert durch CI (Typecheck · Lint · Format · Tests · Build) auf jeden Push.

Alles, worauf sich ein Nutzer verlässt — Fristberechnung, Schwärzen, Belegzuordnung,
Textaufteilung, Glossar-Treffer — liegt als reine, getestete Funktion in `src/shared/`
und kommt **nicht** vom Sprachmodell.

Der Start bleibt schlank: Seiten werden per Route nachgeladen, das Glossar hängt am
Analyse-Chunk, und von den neun Übersetzungen liegen nur Deutsch und Englisch im
Start-Bundle — die übrigen sieben kommen beim Umschalten dazu.

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload (Ollama muss laufen)
npm run typecheck    # TypeScript (main + renderer)
npm run lint         # ESLint
npm test             # Vitest (nutzt node:sqlite, benötigt Node >= 24)
npm run eval         # Eval-Harness gegen ein laufendes Ollama (ohne Ollama: übersprungen)
npm run build        # Production-Build
npm run build:win    # Windows-Installer (.exe) + Portable
npm run build:mac    # macOS (dmg/zip, unsigniert)
npm run build:linux  # Linux (AppImage/deb)
```

**Qualität messen statt hoffen:** `npm run eval` schickt feste Beispieldokumente (erfunden,
keine echten Daten) durch die echten Prompts und Parser und rechnet aus, wie weit das
Ergebnis von der erwarteten Antwort abweicht — Notenabweichung, Belegquote,
Halluzinationsrate, Fristen-Genauigkeit. Details in [`eval/README.md`](eval/README.md).

Voraussetzungen: Node.js >= 24, laufendes Ollama mit mindestens einem Modell. Der
Release-Prozess ist in [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)
dokumentiert; der Installer heißt bewusst versionslos `DoZii-Setup.exe`, damit der Link
[`releases/latest/download/DoZii-Setup.exe`](https://github.com/haZiinstinct/DoZii/releases/latest/download/DoZii-Setup.exe)
über alle Releases stabil bleibt.

## ⚠️ Bekannte Grenzen

Ehrlich ist besser als überverkauft:

- **Keine Rechtsberatung** — DoZii erklärt und entwirft, es entscheidet nicht. Fristen und
  Beträge gehören immer am Originaldokument geprüft; bei echtem Ärger hilft eine
  Beratungsstelle, ein Mieterverein oder ein Beratungshilfeschein beim Amtsgericht
- **Die KI kann irren** — deshalb wird jeder Befund gegen den Originaltext geprüft und
  unbelegtes getrennt ausgewiesen. Die Fristberechnung läuft bewusst im Code, nicht im Modell
- **Texterkennung verwechselt Ziffern** — bei gescannten Dokumenten weist DoZii darauf hin;
  Beträge und Aktenzeichen bitte am Original gegenlesen
- **Installer nicht signiert** — SmartScreen warnt beim ersten Start (siehe oben); kein
  Sicherheitsproblem, aber eine Hürde. macOS-Builds brauchen beim ersten Start
  Rechtsklick → Öffnen
- **Ollama ist separat** — muss einmal installiert und ein Modell geladen werden (die App
  hilft dabei)
- **Kleine Modelle, schwächere Ergebnisse** — unter ~7B werden Zeugnis-Decoder und
  Vertrags-Check ungenau. DoZii warnt, blockiert aber nicht
- **i18n KI-gestützt** — die 9 Übersetzungen sind maschinell erstellt; Verbesserungen von
  Muttersprachlern sind als PR willkommen. Arbeitszeugnis-Decoder und Briefe bleiben
  deutsch — beides stammt aus dem deutschen Recht

## 🤝 Mitmachen

Issues und Pull Requests sind willkommen — Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Lizenz

[MIT](LICENSE) — © haZii. Gebündelte Open-Source-Komponenten sind in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) aufgeführt.

<div align="center"><sub>Built by <a href="https://hazii.org">haZii</a> · <code>// code: haZii.org</code></sub></div>
