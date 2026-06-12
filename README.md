# DoZii

**Lokale, 100% offline Dokumentenanalyse mit KI.**

DoZii ist eine Electron-Desktop-App, die sensible Dokumente (Arbeitszeugnisse, Verträge, Bescheide, Briefe) lokal mit Ollama analysiert. Keine Cloud, keine Telemetrie, kein CDN – alles bleibt auf deinem Rechner.

## Download

➡️ **[Neueste Version](https://github.com/haZiinstinct/DoZii/releases/latest)** (Windows-Installer)

> **SmartScreen-Hinweis:** Der Installer ist derzeit nicht code-signiert. Windows zeigt beim ersten Start „Unbekannter Herausgeber" – über **„Weitere Informationen" → „Trotzdem ausführen"** geht es weiter.

## Features

- **5 Analyse-Modi**: Rechtschreibung & Grammatik, Formulierungen, Arbeitszeugnis-Decoder, Zusammenfassung, Freie Frage
- **Arbeitszeugnis-Decoder** mit Dual-Grading: Inhalts-Note + Struktur-Note, 80+ versteckte Codes, evidenzbasierte Befunde mit 2-Pass-Verifizierung
- **Persistenter Chat** pro Dokument – nach der Analyse weiter mit der KI diskutieren
- **Dokument-Import**: PDF, DOCX, XLSX, Bilder (mit OCR via Tesseract)
- **Auto-Ersteindruck**: Beim Import automatische Einschätzung + Empfehlung für den passenden Analyse-Modus
- **Hardware-aware**: Erkennt CPU/RAM/GPU und empfiehlt passende Modelle, CPU/GPU-Tabs in der Modell-Auswahl
- **Ollama-Lifecycle**: Start/Stop-Button direkt in der App
- **Auto-Update** über GitHub Releases – abschaltbar, überträgt nur die Versionsnummer
- **Self-hosted Fonts, Icons, OCR-Daten**: alles lokal gebündelt, strikte CSP blockiert externe Requests

## Systemvoraussetzungen

- Windows 10/11 (64-bit)
- [Ollama](https://ollama.com/download) installiert (DoZii hilft beim Einrichten)
- Mindestens 8 GB RAM; 16 GB+ bzw. eine GPU mit 8 GB+ VRAM für stärkere Modelle
- Modell-Empfehlung: `qwen2.5:3b` (CPU) bis `mistral-small:24b` (GPU) – die App schlägt passend zur Hardware vor

## Datenschutz & Datenablage

- Alle Dokumente, Analysen, Chats und Einstellungen liegen lokal unter `%APPDATA%\DoZii`
- Logs (14 Tage, ohne Dokumentinhalte) ebenfalls dort unter `logs\`
- Einziger Netzwerk-Zugriff neben Ollama (localhost:11434): der **optionale Update-Check** gegen GitHub – in den Einstellungen abschaltbar
- Bei der Deinstallation fragt der Uninstaller, ob die Nutzerdaten mitgelöscht werden sollen

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload
npm run typecheck    # TypeScript (main + renderer)
npm run lint         # ESLint
npm test             # Vitest (nutzt node:sqlite, benötigt Node >= 24)
npm run build        # Production-Build
npm run build:win    # Windows-Installer (.exe), Build mit --publish never
```

Voraussetzungen: Node.js >= 24, laufendes Ollama mit mindestens einem Modell.

### Release-Prozess

1. Version in `package.json` erhöhen, `CHANGELOG.md` ergänzen, committen + taggen (`vX.Y.Z`)
2. `npm run build:win -- --publish never`
3. Smoke-Test laut [Checkliste](docs/RELEASE_CHECKLIST.md) (frisches Windows-Profil/VM)
4. Release anlegen: `gh release create vX.Y.Z dist/DoZii-Setup-X.Y.Z.exe dist/DoZii-Setup-X.Y.Z.exe.blockmap dist/latest.yml --notes-file <notes>`
5. Update-Flow gegen das Release prüfen (installierte Vorversion findet das Update)

## Tech-Stack

- Electron 33 + electron-vite + React 19 + TypeScript + Tailwind CSS v4
- Ollama (lokal, localhost:11434) für die LLM-Inferenz
- better-sqlite3 + Drizzle ORM, Migrationen über `PRAGMA user_version`
- unpdf, mammoth, xlsx, tesseract.js für Textextraktion
- electron-updater (GitHub-Provider)

## Mitmachen

Issues und Pull Requests sind willkommen – Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

[MIT](LICENSE) – © haZii. Gebündelte Open-Source-Komponenten in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
