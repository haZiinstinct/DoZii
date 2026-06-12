# Mitmachen bei DoZii

Danke für dein Interesse! Issues und Pull Requests sind willkommen.

## Setup

```bash
npm install
npm run dev          # Dev-Server mit Hot-Reload (Ollama muss laufen)
```

Voraussetzungen: Node.js >= 24, [Ollama](https://ollama.com) mit mindestens einem Modell.

## Vor dem PR

Alle vier müssen grün sein (laufen auch in der CI):

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

## Konventionen

- TypeScript strikt, kein `any` an IPC-Grenzen; gemeinsame Typen in `src/shared/types.ts`
- UI-Strings auf Deutsch mit echten Umlauten; Prompts (`src/main/prompts/`) behalten ihre ASCII-Schreibweise (Parser-Aliase decken beide Varianten)
- Keine Dokumentinhalte in Logs (Privacy ist das Kernversprechen der App)
- DB-Schemaänderungen ausschließlich als neue Migration in `src/main/db/migrations.ts` (niemals die Baseline ändern) + Test in `migrations.test.ts`
- Tests für pure Logik mit Vitest; `node:sqlite` statt better-sqlite3 in Tests (kein Electron-ABI-Rebuild nötig)

## Bugs melden

Bitte mit DoZii-Version, Windows-Version, Modell (z. B. `qwen2.5:7b`) und falls möglich relevanten Zeilen aus `%APPDATA%\DoZii\logs\` (die Logs enthalten keine Dokumentinhalte).
