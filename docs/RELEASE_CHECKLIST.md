# Release-Checkliste DoZii

Vor jedem öffentlichen Release komplett durchgehen. Empfohlen: frisches Windows-Profil oder VM (sauberer Zustand ohne `%APPDATA%\DoZii`).

## Vorbereitung

- [ ] CI auf `main` grün (typecheck, lint, format:check, test, build)
- [ ] Version in `package.json` korrekt, `CHANGELOG.md`-Eintrag vorhanden
- [ ] `npm ci && npm run build:win -- --publish never`
- [ ] `dist/` enthält: `DoZii-Setup-X.Y.Z.exe`, `.exe.blockmap`, `latest.yml`

## Installation

- [ ] Installer startet; SmartScreen-Warnung erscheint → „Weitere Informationen → Trotzdem ausführen" funktioniert
- [ ] Desktop-Verknüpfung + Startmenü-Eintrag angelegt
- [ ] App startet, Welcome-Wizard erscheint (Erststart)

## Welcome-Wizard

- [ ] Hardware-Erkennung zeigt CPU/RAM (+GPU falls vorhanden) und Modell-Empfehlung
- [ ] Ollama nicht installiert → Download-Hinweis sichtbar
- [ ] Ollama installiert, aber gestoppt → „Ollama jetzt starten" funktioniert; Fehlerpfad zeigt Meldung + Retry möglich
- [ ] Weiter zur App → Wizard erscheint bei nächstem Start nicht mehr

## Import (je Typ eine Datei)

- [ ] PDF mit Textebene
- [ ] DOCX
- [ ] XLSX
- [ ] PNG/JPG (OCR läuft, deutsches Dokument wird erkannt)
- [ ] Negativ: passwortgeschütztes PDF → verständliche Fehlermeldung
- [ ] Negativ: `.doc`-Datei → Konvertier-Hinweis (kein Crash)
- [ ] Negativ: mehrere Dateien mit Fehlern → Fehler als Liste pro Datei
- [ ] Drag & Drop funktioniert (wichtig: verifiziert sandbox:true + webUtils)

## Analyse-Modi (mit installiertem Modell)

- [ ] Rechtschreibung & Grammatik → strukturierte Fehlerliste
- [ ] Formulierungen → Vorschläge
- [ ] Arbeitszeugnis-Decoder → 2 Phasen sichtbar (Analysiere/Verifiziere), Noten + Codes gerendert
- [ ] Zusammenfassung
- [ ] Freie Frage → gestellte Frage wird über dem Ergebnis angezeigt
- [ ] Abbrechen während der Analyse → Teiltext gespeichert, Status „abgebrochen"
- [ ] Sehr langes Dokument (>100 Seiten) → Kürzungs-Hinweis am Ergebnis
- [ ] Ollama während Analyse stoppen → freundliche Fehlermeldung (kein Crash)

## Chat & Export

- [ ] Chat-Nachricht senden, Antwort streamt
- [ ] App neu starten → Chat-Verlauf noch da (Persistenz + DB-Migration ok)
- [ ] PDF-Export → Datei wird erzeugt und im Explorer gezeigt
- [ ] PDF-Export abbrechen (Dialog schließen) → keine Fehlermeldung

## Einstellungen

- [ ] Modell-Download mit Fortschritt; Modell wechseln
- [ ] Theme-Wechsel (Dunkel/Hell/System) überlebt Neustart
- [ ] Update-Sektion: Version angezeigt, „Jetzt prüfen" liefert Ergebnis
- [ ] Auto-Update-Schalter aus → beim nächsten Start kein Netzwerk-Call zu GitHub
- [ ] Zweite App-Instanz starten → fokussiert nur das bestehende Fenster

## Deinstallation

- [ ] Uninstaller fragt nach Nutzerdaten-Löschung
- [ ] „Nein" → `%APPDATA%\DoZii` bleibt erhalten
- [ ] Neu installieren → Daten/Analysen wieder sichtbar (Bestands-DB-Migration)
- [ ] Deinstallieren mit „Ja" → `%APPDATA%\DoZii` ist weg

## Veröffentlichen

- [ ] `git tag vX.Y.Z && git push origin vX.Y.Z` (privates Code-Repo)
- [ ] Release im öffentlichen Repo:
      `gh release create vX.Y.Z dist/DoZii-Setup-X.Y.Z.exe dist/DoZii-Setup-X.Y.Z.exe.blockmap dist/latest.yml -R haZiinstinct/DoZii-releases --title "DoZii X.Y.Z" --notes-file <notes.md>`
- [ ] Download von github.com auf Zweitgerät testen
- [ ] Update-Probe: Dummy-Folgeversion als Draft → installierte Version findet sie → Draft löschen
