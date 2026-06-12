# Changelog

Alle nennenswerten Änderungen an DoZii werden in dieser Datei dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

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

- Windows 10/11 (64-bit); Installer ist vorerst nicht code-signiert (SmartScreen-Hinweis siehe README)
- Legacy-Formate `.doc`/`.xls` werden nicht unterstützt – bitte als `.docx`/`.xlsx` speichern
