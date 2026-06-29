# Changelog

Alle nennenswerten Änderungen an DoZii werden in dieser Datei dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.2.0] – 2026-06-29

Mehrsprachigkeit: DoZii spricht jetzt 9 Sprachen – Oberfläche und KI-Ausgabe.

### Hinzugefügt

- **9 Sprachen** statt bisher 2: Deutsch, English, Español, Français, Português, Русский, العربية, 日本語, 中文. Übersetzt sind sowohl die **Oberfläche** als auch die **KI-Analyse-Ausgabe** (Grammatik, Formulierungen, Zusammenfassung, Freie Frage)
- **Globus-Sprachumschalter** in der Titelleiste (native Sprachnamen); die Wahl wird gespeichert. Die Sprachauswahl in den Einstellungen umfasst jetzt alle 9 Sprachen
- **Arabisch mit vollem RTL-Layout** (rechts-nach-links): das gesamte Interface spiegelt, Richtungs-Icons inklusive

### Geändert / Verbessert

- Die **Analyse-Ausgabe folgt jetzt der gewählten UI-Sprache** (vorher: der Dokumentsprache). Beispiel: UI auf Spanisch → die Analyse antwortet auf Spanisch, unabhängig von der Dokumentsprache
- Layout durchgehend auf logische CSS-Eigenschaften umgestellt, damit RTL automatisch greift

### Hinweise

- Der **Arbeitszeugnis-Decoder bleibt deutsch** – das Konzept stammt aus dem deutschen Arbeitsrecht
- Die neuen Übersetzungen sind KI-gestützt erstellt und können von Muttersprachlern noch verfeinert werden
- OCR (Texterkennung aus Scans/Fotos) deckt weiterhin Deutsch + Englisch ab; Text-PDFs/DOCX funktionieren sprachunabhängig
- Bei sehr kleinen Modellen kann die strukturierte Karten-Ansicht gelegentlich auf einfaches Markdown zurückfallen – der Inhalt bleibt in der gewählten Sprache
- Keine Breaking Changes; Auto-Update verteilt v1.2.0 an v1.1-Installationen

## [1.1.0] – 2026-06-24

Full-Stack-Überarbeitung nach komplettem Audit – schlanker, schneller, schöner, zweisprachig.

### Hinzugefügt

- **Englische Oberfläche** – vollständige Lokalisierung (DE/EN) mit Sprach-Umschalter in den Einstellungen; die Analyse-Ausgabe folgt weiterhin der Dokumentsprache
- **Accessibility** – aria-Labels, Tastatur-bedienbare Upload-Zone, semantische Tabs/Listbox (CommandPalette), aria-live-Statusmeldungen
- Analyse-Ergebnisse und Chat lassen sich jetzt **markieren und kopieren**

### Geändert / Verbessert

- **Performance**: Streaming bündelt IPC-Events statt eines pro Token; PDF- und OCR-Engine werden erst bei Bedarf geladen; OCR-Worker werden wiederverwendet; Hardware-Erkennung blockiert den Start nicht mehr; Code-Splitting (Start-Bundle ~1,3 MB → ~0,68 MB)
- **Schlankheit**: ungenutzte Abhängigkeiten entfernt (zustand, uuid → `crypto.randomUUID`), doppelte Logik zusammengeführt, Konstanten zentralisiert
- **Robustheit**: robustere JSON-Extraktion aus Modellantworten, Schutz vor korrupten Einstellungen, strengere IPC-Eingabevalidierung
- Light-Theme vervollständigt (Scrollbar/Selektion); konsistente Brand-Tokens
- Installer heißt versionslos `DoZii-Setup.exe`, damit der Download-Link über alle Releases stabil bleibt

### Hinweise

- Keine Breaking Changes; Auto-Update verteilt v1.1.0 an v1.0-Installationen

## [1.0.0] – 2026-06-12

Erstes öffentliches Release. Die Versionen davor (intern 1.x–3.x) waren nie veröffentlicht; ihre Funktionen sind hier zusammengefasst.

### Features

- **5 Analyse-Modi**: Rechtschreibung & Grammatik, Formulierungen, Arbeitszeugnis-Decoder, Zusammenfassung, Freie Frage
- **Arbeitszeugnis-Decoder** mit Dual-Grading (Inhalts- + Struktur-Note), 80+ versteckten Codes und evidenzbasierter 2-Pass-Verifizierung gegen Halluzinationen
- **Dokument-Import**: PDF, DOCX, XLSX, Bilder (OCR via Tesseract, deutsch + englisch)
- **Persistenter Chat** pro Dokument
- **Auto-Ersteindruck** beim Import mit Modus-Empfehlung
- **Hardware-Erkennung** (CPU/RAM/GPU) mit passenden Modell-Empfehlungen
- **Ollama-Lifecycle** direkt in der App (Start/Stop/Status)
- **PDF-Export** der Analyseergebnisse
- **Auto-Update** über GitHub Releases – abschaltbar, überträgt nur die Versionsnummer
- **100% offline**: alle Dokumente, Analysen und Modelle bleiben lokal; strikte CSP, Sandbox, keine Telemetrie

### Hinweise

- Open Source unter MIT-Lizenz
- Windows 10/11 (64-bit); Installer ist vorerst nicht code-signiert (SmartScreen-Hinweis siehe README)
- Legacy-Formate `.doc`/`.xls` werden nicht unterstützt – bitte als `.docx`/`.xlsx` speichern
