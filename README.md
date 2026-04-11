# DoZii

**Lokale, 100% offline Dokumentenanalyse mit KI.**

DoZii ist eine Electron-Desktop-App, die sensible Dokumente (Arbeitszeugnisse, Vertraege, Bescheide, Briefe) lokal mit Ollama analysiert. Keine Cloud, keine Telemetrie, kein CDN - alles bleibt auf deinem Rechner.

## Features

- **5 Analyse-Modi**: Rechtschreibung & Grammatik, Formulierungen, Arbeitszeugnis-Decoder, Zusammenfassung, Freie Frage
- **Arbeitszeugnis-Decoder** mit Dual-Grading: Inhalts-Note + Struktur-Note, 80+ versteckte Codes, evidenz-basierte Befunde
- **Persistenter Chat** pro Dokument - nach der Analyse weiter mit der KI diskutieren
- **Dokument-Import**: PDF, DOCX, XLSX, Bilder (mit OCR via Tesseract)
- **Auto First Impression**: Beim Import automatischer Ersteindruck + Empfehlung fuer den passenden Analyse-Modus
- **Hardware-aware**: Erkennt CPU/RAM/GPU und empfiehlt passende Modelle, CPU/GPU-Tabs in der Modell-Auswahl
- **Ollama Lifecycle**: Start/Stop-Button direkt in der App
- **Self-hosted Fonts, Icons, OCR-Daten**: alles lokal gebundelt, strikte CSP blockiert externe Requests

## Tech Stack

- Electron 33 + electron-vite + React 19 + TypeScript + Tailwind CSS v4
- Ollama (lokal, localhost:11434) fuer die LLM-Inferenz
- better-sqlite3 + Drizzle ORM fuer Dokument- und Analyse-Historie
- unpdf, mammoth, xlsx, tesseract.js fuer Textextraktion
- i18next (DE + EN)

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload
npm run build        # Production-Build
npm run build:win    # Windows Installer (.exe)
```

## Voraussetzungen

- Node.js >= 20
- [Ollama](https://ollama.com) installiert und laufend
- Mindestens ein Ollama-Modell gepullt (Empfehlung: `qwen2.5:7b` oder `mistral-small:24b`)

## Design

Schlankes, randloses Dark-Theme basierend auf dem haZii-Brand. Cyan-Akzente (#00d4ff),
Inter + JetBrains Mono als Self-hosted Fonts. Optionale Light-Mode-Theme.

## Lizenz

Proprietaer - (c) haZii
