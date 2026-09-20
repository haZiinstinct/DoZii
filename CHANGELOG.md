# Changelog

Alle nennenswerten Änderungen an DoZii werden in dieser Datei dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.3.1] – 2026-09-20

Nachtrag zur Modellauswahl. Gemessen statt geschätzt — die Zahlen stehen in
`docs/MODELLWAHL.md`.

### Behoben

- **Empfohlenes Modell ließ sich nicht installieren** – ein Rechner mit 6 GB RAM bekam
  `qwen3:4b` als Empfehlung angezeigt, und derselbe Bildschirm sperrte den Download mit
  „braucht 8 GB". Die 8 GB sind eine Komfortschätzung (Modellgröße mal zwei, mindestens
  8), kein hartes Limit: ein 2,5-GB-Modell läuft auf 6 GB. Der Hinweis bleibt, die Sperre
  ist weg — wie beim Grafikspeicher schon länger. Betroffen war ausgerechnet die
  Zielgruppe mit schwacher Hardware

### Geändert

- **Modellliste auf vier Einträge** – `llama3.2:3b` und `qwen2.5:7b` sind raus.
  `llama3.2:3b` erfindet die Hälfte seiner Belegzitate und dichtet einem Bescheid *ohne*
  Rechtsbehelfsbelehrung eine Frist an, bei praktisch gleicher Größe wie `granite4.1:3b`.
  `qwen2.5:7b` hat 32K Kontext, ist von 2024 und wird von `granite4.1:8b` in jeder
  Hinsicht geschlagen
- **Kein Modell unterhalb von `qwen3:4b`** – geprüft und verworfen: `qwen3:1.7b` (1,4 GB)
  erfindet zwei von fünf Belegzitaten. Für ein Werkzeug, das jede Aussage mit einem Zitat
  aus dem Dokument belegt, ist das disqualifizierend

## [1.3.0] – 2026-09-18

Das große Verständlichkeits-Release. DoZii erklärt Behördenpost jetzt nicht nur, es sagt
auch, bis wann du reagieren musst – und schreibt die Antwort auf Wunsch gleich mit.

### Hinzugefügt

- **Modus „Einfach erklärt"** – Amtsdeutsch in normale Sprache: Worum geht es, was will man
  von dir, was passiert wenn du nichts tust, was kannst du tun. Mit Dringlichkeits-Ampel,
  abhakbarer Schrittliste und dem Wichtigsten in einem Satz ganz oben
- **Fristen-Radar** – erkennt Fristen im Dokument und rechnet das Enddatum **im Code** aus:
  §§ 187/188 BGB (Ereignistag zählt nicht, Monatsende-Regel), § 193 BGB (Verschiebung auf
  den nächsten Werktag), bundesweite Feiertage über die Osterformel. Mit Countdown,
  Anzeige in der Seitenleiste und Export als `.ics`
- **Vertrags-Check** – Klausel-Ampel mit Zitat, Klartext-Erklärung, „das wäre üblich" und
  einem Formulierungsvorschlag für die Verhandlung. Erkennt auch, was fehlt
- **Antwort-Generator** – fertige Briefentwürfe: Widerspruch, Einspruch, Antwort auf eine
  Mahnung, Kündigung, Fristverlängerung, Arbeitszeugnis-Nachbesserung. Platzhalter werden
  direkt im Brief ausgefüllt, Export als Word-kompatibles RTF
- **Behörden-Glossar** – 120+ Begriffe, per Klick im Text erklärt. Rein lokale Daten,
  kein Modellaufruf
- **Notenprobe ohne KI** – die Zufriedenheitsformel ist eine feste Tabelle, keine
  Ermessensfrage. DoZii sucht die Hauptformel im Text und rechnet die Note selbst aus.
  Anlass war die Messung: die Modelle zitieren „stets zu unserer vollsten Zufriedenheit"
  korrekt und verbuchen sie als Note 4. Überschrieben wird nichts – versteckte Codes
  drücken die Gesamtnote zu Recht darunter. Nur **besser** als die Hauptformel kann ein
  Zeugnis nicht sein, und das wird gemeldet
- **Fristen-Radar liest die Rechtsbehelfsbelehrung selbst** – die Berechnung war schon immer
  deterministisch, gescheitert ist das Modell am Anker: ein kleines Modell fand bei zwei von
  sechs Bescheiden gar keine Frist. Jetzt liest ein Regelwerk die Belehrung mit und hat je
  Fristart Vorrang. Als Bezugsdatum gilt die **Zustellung** („Zugestellt am: 05.02.2026"),
  nicht das Bescheiddatum – dazwischen liegen regelmäßig zwei bis vier Tage, bei einer
  Zwei-Wochen-Frist also zu früh Entwarnung. „Innerhalb von zwei Wochen nach Rechtskraft"
  wird bewusst **nicht** gerechnet: Rechtskraft tritt erst nach Ablauf der Einspruchsfrist
  ein, und eine plausibel aussehende falsche Frist ist gefährlicher als gar keine
- **Klausel-Radar** – acht Stolperfallen werden über ein festes Regelwerk gefunden, nicht
  über das Modell: Kaution über drei Nettokaltmieten (§ 551 BGB), Endrenovierung,
  Wettbewerbsverbot ohne Karenzentschädigung (§ 74 HGB), pauschal abgegoltene Überstunden,
  Jahresverlängerung (§ 309 Nr. 9 BGB), Kündigung nur per Einschreiben, Haftungsausschluss
  bei grober Fahrlässigkeit, einseitige Preisänderung. Eine rote Klausel hebt das
  angezeigte Gesamtrisiko auf „hoch" – gemessen meldete das kleine Modell bei einer
  Kaution über vier Nettokaltmieten „mittleres Risiko"
- **OCR für gescannte PDFs** – bisher der häufigste Totalausfall: ein eingescannter
  Bescheid hat keine Textebene und landete leer in der App. Jetzt wird der Scan erkannt
  und seitenweise per Texterkennung gelesen, mit Fortschrittsanzeige
- **Text einfügen** statt nur Datei-Import – für alles, was aus einem Portal oder einer
  E-Mail kopiert wurde. Dazu neue Dateitypen `.txt`, `.md` und `.eml`
- **Ein-Klick-Ablauf** – DoZii erkennt beim Import die Dokumentart und startet den
  passenden Modus von selbst (abschaltbar)
- **Belegstellen im Original** – ein Klick auf einen Befund markiert die Stelle im
  Dokumenttext. Unbelegte Befunde stehen nicht mehr gleichberechtigt neben belegten,
  sondern getrennt und gekennzeichnet
- **Schwärzen vor dem Export** – IBAN (mit Prüfsumme), Steuer-ID, Sozialversicherungs-
  nummer, Aktenzeichen, Telefon, E-Mail, Kreditkarte (Luhn) und eigene Begriffe
- **Weitere Export-Formate** – Word-kompatibles RTF, Markdown und Text neben PDF
- **Barrierefreiheit** – Vorlesen über die Systemstimmen (offline), drei Schriftgrößen,
  höherer Kontrast, Rücksicht auf „Bewegung reduzieren"
- **Eval-Harness** (`npm run eval`) – 17 erfundene Beispieldokumente laufen durch die
  echten Prompts und Parser; gemessen werden Notenabweichung, Belegquote,
  Halluzinationsrate und Fristen-Genauigkeit. Damit ist eine Prompt-Änderung kein
  Blindflug mehr
- **macOS-, Linux- und Portable-Builds** – unsigniert und ohne Auto-Update, aber vorhanden

### Geändert / Verbessert

- **Kontextfenster** wird aus dem Modell ausgelesen statt fest auf 8192 zu stehen –
  lange Verträge und Bescheide werden dadurch nicht mehr unnötig gekürzt
- **Zu lange Dokumente** werden abschnittsweise analysiert und zusammengeführt, statt am
  Ende abgeschnitten zu werden. Genau dort stehen Kündigungsfristen und Klauseln
- **Fortschritt** ist jetzt sichtbar: „Abschnitt 3 von 7", „Fasse zusammen", „Suche Fristen"
  statt minutenlang „Analysiere…"
- **Historie und Befehlspalette** suchen im Hauptprozess (SQLite) statt den Volltext aller
  Dokumente in die Oberfläche zu laden
- **Modus-Auswahl** erklärt jetzt, was jeder Modus tut, und hebt die Empfehlung hervor
- Drei bisher wirkungslose Einstellungen tun endlich etwas: **Ollama-Adresse**,
  **OCR-Sprachen** und **OCR-Qualität** (drei echte Profile, „Beste" skaliert unscharfe
  Handy-Fotos hoch)
- Der **Ersteindruck** wird nach dem Import automatisch erzeugt statt erst auf Knopfdruck
- Datums- und Zahlenformate folgen der gewählten Sprache statt fest `de-DE`

### Behoben

- **Widersprüchliche Zeugnisnote** – „Note 1" mit dem Wortlaut „mangelhaft" wurde als
  Ergebnis hingestellt. Widersprechen sich Zahl und Wortlaut, wird jetzt keine von beiden
  behauptet
- **Modellempfehlung auf Büro-Laptops** – Intel-Grafik meldet über die Windows-Registry
  den geteilten Arbeitsspeicher als eigenen VRAM. Aus 32 GB RAM wurden so „16 GB VRAM",
  und der Laptop bekam das größte Modell empfohlen, das dann auf der CPU kroch. Gezählt
  wird jetzt nur noch, was Ollama beschleunigt: NVIDIA (CUDA) und AMD (ROCm)
- **Antwort wurde abgeschnitten** – DoZii reservierte 1500 Tokens für die Antwort des
  Modells, gemessen braucht ein Zeugnis-Durchlauf 5000 bis 6000. Das Kontextfenster war
  dadurch zu klein, Ollama schob beim Schreiben den System-Prompt hinaus und übrig blieb
  abgeschnittenes JSON, das die App verwarf. Das Fenster richtet sich jetzt nach dem, was
  der Modus wirklich braucht
- **Antworten ohne Code-Zaun wurden weggeworfen** – manche Modelle liefern das JSON ohne
  ```` ```json ````. Der Zeugnis-Decoder akzeptierte nur eingezäunte Blöcke und verwarf
  komplett richtige Antworten; der Vertrags-Check konnte es längst besser. Beide benutzen
  jetzt denselben Weg
- **Gedankengang in der Antwort** – Modelle mit Denkmodus (etwa Qwen 3) stellten ihren
  Gedankengang voran. Er wird jetzt abgeschaltet und, falls er doch durchkommt, entfernt,
  bevor ausgewertet oder gespeichert wird
- **Warnung vor zu kleinen Modellen** – wer den Zeugnis-Decoder mit einem Modell startet,
  das dafür zu klein ist, sieht das jetzt vorher statt nur im Logfile

### Hinweise

- Datenbank-Migration auf Version 3 (neue Fristen-Tabelle, Merker für OCR-Herkunft);
  vor der Migration wird automatisch eine Sicherung angelegt
- Der **Arbeitszeugnis-Decoder** und die **Briefentwürfe** bleiben deutsch – beides stammt
  aus dem deutschen Recht
- **Keine Rechtsberatung.** Fristen und Beträge gehören am Originaldokument geprüft
- Keine Breaking Changes; Auto-Update verteilt v1.3.0 an bestehende Installationen

## [1.2.1] – 2026-08-05

Kleines Wartungs-Release.

### Hinzugefügt

- **haZii-Credit-Badge** `// code: haZii.org` in den Einstellungen neben der Versionsanzeige – klickbarer Link auf [hazii.org](https://hazii.org), folgt dem Dark/Light-Theme und bleibt im RTL-Layout korrekt

### Geändert / Verbessert

- README-Credit von der Webdesign- auf die Tool-Variante `// code:` umgestellt

### Hinweise

- Keine Breaking Changes; Auto-Update verteilt v1.2.1 an bestehende Installationen

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
