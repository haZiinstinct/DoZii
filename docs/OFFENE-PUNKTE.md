# Offene Punkte aus dem Review zu v1.3.0

Ein adversarisches Code-Review über acht Dimensionen (Hauptprozess, Import/OCR, reine
Logik, React, i18n/Barrierefreiheit, Datenschutz, Prompts, stille Fehler) hat 65 Funde
geliefert; jeder wurde von zwei Skeptikern gegengeprüft. Die schwerwiegenden sind behoben
(siehe Git-Historie zu v1.3.0). Was hier steht, ist bewusst offengelassen — mit dem Grund.

Reihenfolge: was am ehesten jemandem schadet, steht oben.

## Fachlich

### Bekanntgabefiktion bei Behördenbescheiden fehlt
`src/shared/deadline-calc.ts`

Gerechnet wird ab dem Bescheiddatum. Nach § 41 Abs. 2 VwVfG gilt ein Bescheid aber erst am
dritten Tag nach Aufgabe zur Post als bekanntgegeben — die Frist beginnt also drei Tage
später und endet drei Tage später.

**Bewusst so gelassen:** die aktuelle Rechnung liegt damit auf der sicheren Seite. Wer sich
an das angezeigte Datum hält, ist eher zu früh als zu spät. Die Gegenrichtung wäre
gefährlich. Richtig wäre trotzdem: mit Fiktion rechnen und den Unterschied benennen
("frühestens … , spätestens …").

### "Einfach erklärt" prüft keine Belege
`src/main/prompts/plain-language.prompt.ts`, `src/renderer/lib/parse-plain-language.ts`

Zeugnis-Decoder und Vertrags-Check gleichen jeden Befund gegen den Originaltext ab. Der
Modus "Einfach erklärt" tut das nicht — ein erfundener Betrag oder ein erfundenes
Aktenzeichen landet ungeprüft in der Ansicht, die am meisten Vertrauen genießt.

Sinnvoll wäre: Beträge, Daten und Aktenzeichen aus `facts` gegen das Dokument prüfen und
Unbelegtes kennzeichnen — analog zum Vertrags-Check.

### Fristen-Prompt trennt Widerspruch und Einspruch nicht scharf
`src/main/prompts/deadline-extract.prompt.ts`

Bei einem Bußgeldbescheid (2 Wochen) kann das Modell `widerspruch` (1 Monat) liefern. Der
Regelkatalog rechnet dann eine zu lange Frist. Der Hinweistext im Dokument wird zwar als
`hint` an `defaultRuleFor` gereicht, die Unterscheidung steht aber nicht im Prompt.

## Datenschutz

### Dateinamen und Pfade im Logfile
`src/main/services/document-store.service.ts`, `src/main/ipc/documents.ipc.ts`

Der Kommentar daneben sagt "niemals Dokumentinhalt loggen" — Dateinamen wie
`Kuendigung_Mueller_2026.pdf` und vollständige Pfade stehen aber drin. Das ist kein Inhalt,
verrät aber oft genug.

Sinnvoll: Dateinamen nur als Endung plus Länge loggen, Pfade gar nicht.

## Oberfläche

### Schriftgröße "sehr groß" erreicht nicht alles
`src/renderer/styles/globals.css`

Die Skalierung hängt an der Wurzel-Schriftgröße und wirkt damit auf `rem`-Werte. Rund 50
Stellen benutzen feste Pixelwerte (`text-[10px]`, `size={12}`) und bleiben unverändert.
Betrifft vor allem Badges und Hilfstexte.

### Deutscher Dokumenttext im arabischen Layout
`src/renderer/pages/DocumentViewPage.tsx`, Zitatblöcke in den Ergebnisansichten

Bei arabischer Oberfläche erbt auch der deutsche Dokument- und Zitattext `dir="rtl"` und
wird rechtsbündig mit verschobener Zeichensetzung dargestellt. Richtig wäre `dir="auto"` an
den Blöcken, die Dokumentinhalt zeigen.

### Modell-Beschreibungen zeigen "1b", "7b", "24b"
`src/renderer/pages/SettingsPage.tsx`

Die Stärken-Texte werden über einen dynamischen i18n-Schlüssel geholt, der am Modellnamen
hängt; fehlt er, erscheint das Fragment statt des Textes.

### Juristische Begründung einer Frist immer auf Deutsch
`src/renderer/components/DeadlineCard.tsx`

`deadline.note` ("auf Montag verschoben", "§ 193 BGB") kommt als fertiger deutscher Satz aus
dem Hauptprozess. Sauber wäre ein Schlüssel plus Parameter statt Fließtext.

### Kleinigkeiten
- `src/renderer/App.tsx`: Lade-Spinner mit fest verdrahtetem `aria-label="Lädt"`
- `src/renderer/pages/SettingsPage.tsx`: deutsche Debug-Zeile im Logs-Abschnitt
- `src/renderer/pages/AnalysisPage.tsx`: `<Send>`-Icon ohne `rtl-flip`
- `src/renderer/pages/UploadPage.tsx`: `handleDrop` prüft `busy` nicht — parallele Importe
  per Drag & Drop möglich
- `src/renderer/pages/UploadPage.tsx`: der globale Drop-Schutz hängt am Mount dieser Seite,
  auf anderen Seiten öffnet ein Fehlwurf die Datei im Fenster

## Technisch

### Reduce-Prompts sind fest deutsch
`src/main/prompts/chunk-reduce.prompt.ts`

`withLanguageDirective` greift für `de` und `en` nicht — englische Nutzer bekommen beim
Zusammenführen langer Dokumente einen deutschen Systemprompt. Das Ergebnis bleibt meist
englisch, garantiert ist es nicht.

### Wechsel der Ollama-Adresse bricht den laufenden Strom nicht ab
`src/main/services/ollama-client.service.ts`

Der Client wird ersetzt, der alte Lauf läuft weiter und lässt sich über den Stopp-Knopf
nicht mehr erreichen.

### Erneuter Versuch nach Socket-Abbruch verdoppelt den Text
`src/main/services/ollama-client.service.ts`

`withTransientRetry` startet den Strom neu, der Renderer hat den Teiltext aber schon. Nötig
wäre ein Reset-Signal vor dem zweiten Versuch.

### Leere OCR-Seiten zählen als Erfolg
`src/main/services/pdf-ocr.service.ts`

Liefert eine Seite keinen Text, zählt sie trotzdem als verarbeitet und taucht in keiner
Warnung auf.

### .eml: deklariertes Charset wird für 7bit/8bit nicht angewendet
`src/shared/eml-parse.ts`

Bei diesen Transfer-Encodings wird der Text schon vorher zu String, das Charset aus dem
Header greift dann nicht mehr.

### "Im Text zeigen" auch bei unbelegten Klauseln
`src/renderer/components/analysis/ContractCheck.tsx`

Der Knopf erscheint, findet aber nichts — er gehört dort ausgeblendet.

### Datum nur beim Öffnen berechnet
`src/renderer/pages/DocumentViewPage.tsx`

Eine über Mitternacht offene Ansicht zeigt eine um einen Tag falsche Restlaufzeit.

### Abbruch während des ersten Abschnitts
`src/main/services/analysis.service.ts`

Bricht der Nutzer ab, bevor der erste Abschnitt fertig ist, gibt es kein Teilergebnis und
die Meldung lautet "Modell hat keine Antwort geliefert" statt "abgebrochen".

### Integrierte AMD-Grafik zaehlt noch als beschleunigt
`src/shared/hardware-profile.ts`

`usableVramGb` schliesst Intel und unerkannte Adapter aus, weil Ollama sie nicht
beschleunigt. Integrierte Radeon-Grafik in Ryzen-Notebooks meldet sich aber als `amd` und
wird mitgezaehlt, obwohl ROCm sie meist nicht unterstuetzt. Vom Namen her ist sie nicht
zuverlaessig von einer eingebauten Karte zu unterscheiden; die gemeldeten Groessen sind
bei AMD bislang klein genug, dass daraus keine falsche Empfehlung wird.

### Kuendigungsschreiben wird als Arbeitszeugnis benotet
`src/main/prompts/arbeitszeugnis.prompt.ts`

Ein Kuendigungsschreiben, das ein Zeugnis nur ankuendigt ("ein qualifiziertes
Arbeitszeugnis erhalten Sie nach Beendigung"), wird von granite4.1:8b als Zeugnis
behandelt und bekommt eine Note. Regel 5 des Prompts gibt es, sie greift hier nur nicht.
Fixture `az-kein-zeugnis` haelt den Fall fest.
