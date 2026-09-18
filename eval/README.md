# Eval-Harness: messen statt hoffen

DoZii verspricht zwei Zahlen: eine **Note** für ein Arbeitszeugnis und ein **Fristende** aus
einem Bescheid. Eine falsche Zahl ist schlimmer als gar keine. Die Systemprompts, aus denen
diese Zahlen entstehen, sind zusammen rund 15 KB Text — jede Änderung daran war bisher
Blindflug: es gab keine Möglichkeit zu sehen, ob eine Formulierung die Ergebnisse besser
oder schlechter macht.

Dieser Ordner ändert das. Er schickt feste Beispieldokumente durch den **echten** Prompt und
den **echten** Parser der App und rechnet aus, wie weit das Ergebnis von der erwarteten
Antwort abweicht. Vorher messen, ändern, nachher messen — und die beiden Zahlen vergleichen.

## Starten

```bash
npx vitest run --config vitest.eval.config.ts
```

Einzelner Lauf:

```bash
npx vitest run --config vitest.eval.config.ts eval/arbeitszeugnis.eval.ts
npx vitest run --config vitest.eval.config.ts eval/deadlines.eval.ts
npx vitest run --config vitest.eval.config.ts eval/contract.eval.ts
```

Anderes Modell oder anderer Host:

```bash
DOZII_EVAL_MODEL=llama3.1:8b npx vitest run --config vitest.eval.config.ts
OLLAMA_URL=http://192.168.1.50:11434 npx vitest run --config vitest.eval.config.ts
```

Unter PowerShell:

```powershell
$env:DOZII_EVAL_MODEL = 'llama3.1:8b'
npx vitest run --config vitest.eval.config.ts
```

### Was der Integrator noch tun muss

In `package.json` fehlt das Skript — diese Datei durfte beim Anlegen des Harness nicht
angefasst werden. Bitte ergänzen:

```json
"eval": "vitest run --config vitest.eval.config.ts"
```

Zweiter, optionaler Punkt: `eval/` liegt in keinem der beiden Projekt-tsconfigs
(`tsconfig.node.json` deckt `src/main`, `src/preload`, `src/shared` ab, `tsconfig.web.json`
den Renderer), `npm run typecheck` prüft diesen Ordner also nicht mit. Der Code hier ist
gegen dieselben Compiler-Optionen geprüft (strict, `noUnusedLocals`, `noUnusedParameters`,
kein `any`) — wer das dauerhaft absichern will, nimmt `eval/**/*` in ein tsconfig auf.
`npm run lint` und `npm run format:check` erfassen den Ordner dagegen schon.

## Voraussetzungen

Die Eval-Läufe brauchen ein **laufendes Ollama** mit dem Eval-Modell. Ist Ollama nicht
erreichbar oder fehlt das Modell, wird der komplette Lauf **sauber übersprungen** (`describe.skip`)
und die Konsole sagt, was fehlt — der Lauf wird nie rot, nur weil kein Modell da ist.

| Variable | Default | Bedeutung |
|---|---|---|
| `DOZII_EVAL_MODEL` | `qwen2.5:7b` | Modell, gegen das gemessen wird |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama-Endpunkt |

```bash
ollama pull qwen2.5:7b
```

Ein Durchlauf über alle Fixtures dauert je nach Hardware 5 bis 30 Minuten. Das Timeout pro
Fixture liegt bei 10 Minuten.

## Was NICHT im normalen Testlauf landet

`npm test` benutzt `vitest.config.ts` mit dem Vitest-Default-Include
`**/*.{test,spec}.?(c|m)[jt]s?(x)`. Dateien auf `*.eval.ts` fallen da heraus und werden
nicht eingesammelt — die Unit-Tests bleiben schnell und brauchen kein Ollama.

Eine Ausnahme mit Absicht: **`eval/lib/score.test.ts` läuft im normalen `npm test` mit.**
Die Metriken selbst sind reiner Code ohne Netzzugriff, und wenn die Rechnung falsch ist,
ist jede Scorecard wertlos.

## Die Fixtures sind erfunden

**Alle Dokumente in `eval/fixtures/` sind frei erfunden.** Erfundene Personen, erfundene
Firmen und Behörden, erfundene Aktenzeichen, Steuernummern und IBANs, erfundene Adressen.
Es sind keine echten personenbezogenen Daten enthalten, und es soll auch nie welche geben —
wer eine Fixture aus einem echten Dokument baut, muss vorher jeden Namen, jedes Aktenzeichen
und jedes Datum ersetzen.

Die Texte sind bewusst vollständig und realistisch aufgebaut (Arbeitszeugnisse mit
Tätigkeitsbeschreibung, Leistungs- und Verhaltensbeurteilung und Schlussformel; Bescheide mit
Aktenzeichen, Begründung und Rechtsbehelfsbelehrung; Verträge mit durchnummerierten Klauseln),
damit sie das Modell genauso fordern wie echte Post.

### Abgedecktes Spektrum

**Arbeitszeugnis** (`eval/fixtures/arbeitszeugnis/`)

| Fixture | Was sie prüft |
|---|---|
| `az-note1-sehr-gut` | Note 1, alles vorhanden, kein Code |
| `az-note2-solide` | Note 2, sauber formuliert |
| `az-note3-durchschnitt` | Note 3, die BAG-Durchschnittsnote |
| `az-note4-ausreichend` | Note 4 mit Auslassungs-Codes (kein Dank, kein Bedauern) |
| `az-note5-bemueht` | Note 5, das klassische „bemüht“-Zeugnis |
| `az-codes-versteckt` | Oberfläche Note 2, real Note 4 — fünf versteckte Codes |
| `az-kein-zeugnis` | Ein Kündigungsschreiben. Erwartet `notGenuineZeugnis: true` |

**Bescheid** (`eval/fixtures/bescheid/`)

| Fixture | Was sie prüft |
|---|---|
| `bescheid-widerspruch-monat` | Widerspruch, 1 Monat |
| `bescheid-bussgeld-2wochen` | Einspruch Bußgeld, 2 Wochen (die kurze, gefährliche Frist) |
| `bescheid-steuer-1monat` | Einspruch Steuerbescheid, 1 Monat — darf nicht mit dem Bußgeldfall verwechselt werden |
| `bescheid-gebuehr-zahlung` | Zwei Fristen in einem Dokument: Zahlung (explizites Datum) und Widerspruch |
| `bescheid-klage-widerspruchsbescheid` | Nach dem Widerspruchsbescheid folgt die Klage, kein zweiter Widerspruch |
| `bescheid-ohne-frist` | Gar keine Frist. Eine erfundene Frist ist hier der teuerste Fehler |

**Vertrag** (`eval/fixtures/vertrag/`)

| Fixture | Was sie prüft |
|---|---|
| `vertrag-fitness-abo` | 24 Monate Laufzeit, Verlängerung um 12 Monate, Inkasso-Abtretung |
| `vertrag-mietvertrag-kaution` | Kaution über vier Kaltmieten, starrer Fristenplan, Endrenovierung |
| `vertrag-arbeitsvertrag-wettbewerb` | Wettbewerbsverbot ohne Karenzentschädigung |
| `vertrag-handy-fair` | Gegenprobe: ein fairer Vertrag darf nicht rot geredet werden |

## Eine eigene Fixture ergänzen

Eine neue JSON-Datei in den passenden Ordner legen — sie wird automatisch eingesammelt.

**Arbeitszeugnis:**

```json
{
  "id": "az-note2-solide",
  "title": "Qualifiziertes Zeugnis, Note 2, sauber formuliert",
  "rationale": "Warum genau diese Note erwartet wird, mit Bezug auf die Codetabelle.",
  "text": "<vollständiges Dokument als Text, \\n für Zeilenumbrüche>",
  "expect": {
    "contentGrade": 2,
    "craftGrade": 2,
    "gradeTolerance": 1,
    "mustFindPhrases": ["stets zu unserer vollen Zufriedenheit"],
    "mustNotClaim": ["bemüht"],
    "notGenuineZeugnis": false
  }
}
```

**Bescheid:**

```json
"expect": { "deadlines": ["2026-04-16"], "kind": "widerspruch" }
```

**Vertrag:**

```json
"expect": { "redClauses": ["um weitere zwölf Monate"], "risk": "medium" }
```

Feldbedeutungen:

- `rationale` — **Pflicht in der Praxis, auch wenn der Code sie nicht liest.** Hier steht,
  warum die erwartete Note die richtige ist, mit Verweis auf die Codetabelle in
  `src/main/prompts/arbeitszeugnis.prompt.ts`. Ohne Begründung ist eine Erwartung nur eine
  Meinung, und dann misst das Eval nichts.
- `contentGrade` / `craftGrade` — die beiden Noten des Dual-Grade-Systems: was das Zeugnis
  über den Menschen sagt, und wie geschickt es verfasst ist.
- `gradeTolerance` — erlaubte Abweichung in Noten. Default 1.
- `mustFindPhrases` — Textstellen, die das Modell als Beleg zitieren **muss**.
- `mustNotClaim` — Textstellen, die das Modell **nicht** als Beleg behaupten darf, weil sie
  nicht im Dokument stehen. Geprüft wird nur gegen die Belege (Zitate, Excerpts,
  Schlussformel-Auszüge), nicht gegen die Prosa — ein Satz wie „ein ‚bemüht‘ steht hier
  nicht“ soll nicht als Fehler zählen.
- `notGenuineZeugnis` — der Text ist gar kein Zeugnis. Dann wird keine Note erwartet.
- `deadlines` — **alle** Fristenden des Dokuments als ISO-Datum. Leere Liste heißt: das
  Dokument hat keine Frist, und es darf auch keine gefunden werden.
- `kind` — eine Fristart, die mindestens einmal vorkommen muss (`widerspruch`, `einspruch`,
  `klage`, `zahlung`, `widerruf`, `kuendigung`, `mitwirkung`, `sonstige`), oder `null`.
- `redClauses` — wörtliche Textstellen aus dem Vertrag, die als Klausel auftauchen müssen.
  Der Abgleich läuft über das Zitat, weil nur das wörtlich aus dem Vertrag stammt.
- `risk` — erwartetes Gesamtrisiko (`low` / `medium` / `high`).

### Zwei Fallen beim Schreiben von Bescheid-Fixtures

1. **Das Bezugsdatum muss wörtlich im Text stehen.** Die Fixtures nennen deshalb immer ein
   ausdrückliches Zustell- oder Bekanntgabedatum. DoZii bildet die Drei-Tages-Fiktion
   (§ 41 Abs. 2 VwVfG, § 122 Abs. 2 AO, § 37 Abs. 2 SGB X) bewusst **nicht** ab — die
   erwarteten Daten dürfen sie also auch nicht einrechnen.
2. **§ 193 BGB prüfen.** Fällt das Fristende auf Samstag, Sonntag oder einen bundesweiten
   Feiertag, verschiebt `computeDeadline` es auf den nächsten Werktag. Das erwartete Datum
   muss das bereits enthalten.

## Wie die Metriken zu lesen sind

Jeder Lauf schreibt am Ende eine Scorecard in die Konsole: eine Zeile pro Fixture, darunter
die Gesamtwerte. Interessant ist fast nie eine einzelne Zahl, sondern der Vergleich
**vor und nach** einer Prompt-Änderung.

**Mittlere Notenabweichung** — im Schnitt so viele Noten daneben. 0 ist perfekt, 0.5 ist gut,
ab 1.0 rät das Modell mehr, als dass es liest. Die wichtigste Einzelzahl des
Arbeitszeugnis-Evals.

**Innerhalb der Toleranz** — wie viele Zeugnisse die Note im erlaubten Rahmen getroffen haben.
Fängt Ausreißer auf, die der Mittelwert glattbügelt.

**Evidence-Trefferquote** — Anteil der Zitate, die wörtlich im Dokument stehen, geprüft mit
derselben Funktion (`isInDocument`), die auch die App für ihr „verified“-Häkchen benutzt.
Gemessen wird gegen die **rohen** Behauptungen des Modells, vor der Evidenz-Filterung der App:
sonst würde man die Filterung messen statt das Modell.

**Halluzinationsrate** — das Gegenstück, `1 - Trefferquote`. Jeder Prozentpunkt hier ist eine
Behauptung über ein Dokument, die nicht stimmt. Diese Zahl darf nach einer Prompt-Änderung
nie steigen.

**Fristen-Precision** — Anteil der gelieferten Fristen, die stimmen. Niedrige Precision heißt:
DoZii erfindet Fristen. Der Nutzer hetzt zu einem Termin, den es nicht gibt.

**Fristen-Recall** — Anteil der echten Fristen, die gefunden wurden. Niedriger Recall heißt:
DoZii übersieht Fristen. Der Nutzer verpasst sein Rechtsmittel. Von beiden Fehlern ist dieser
der teurere, deshalb ist Recall im Eval hart gefordert (jede erwartete Frist muss gefunden
werden), Precision nur mit Untergrenze.

**Kritische Klauseln gefunden / davon als rot eingestuft** — die erste Zahl sagt, ob die
Klausel überhaupt auftaucht, die zweite, ob die Ampel sie richtig färbt. Eine gefundene, aber
gelb gefärbte Kaution über vier Kaltmieten ist ein halber Treffer.

### Wann der Lauf rot wird

Das Eval ist kein reiner Bericht, es hat Zähne. Rot wird es bei:

- Note außerhalb der Toleranz (Default ±1)
- fehlendem Pflicht-Beleg oder einem erfundenen Beleg (`mustFindPhrases` / `mustNotClaim`)
- Belegquote unter 50 %
- einer übersehenen Frist (Recall < 100 %) oder einer Frist in einem Dokument ohne Frist
- Gesamtrisiko zwei Ampelstufen daneben, einer übersehenen kritischen Klausel oder einem
  fairen Vertrag, der rot gefärbt wurde

Die Schwellen stehen als benannte Konstanten oben in den drei `.eval.ts`-Dateien
(`MIN_EVIDENCE_RATE`, `MIN_PRECISION`) und in `eval/lib/score.ts`
(`DEFAULT_GRADE_TOLERANCE`).

## Aufbau

| Datei | Inhalt |
|---|---|
| `vitest.eval.config.ts` | eigene Vitest-Konfiguration, spiegelt die Aliase, 10 Minuten Timeout |
| `eval/lib/ollama.ts` | schlanker `fetch`-Client auf `/api/chat` plus Verfügbarkeitsprüfung |
| `eval/lib/score.ts` | die Metriken, rein und ohne Seiteneffekte |
| `eval/lib/score.test.ts` | Unit-Tests dazu, laufen im normalen `npm test` mit |
| `eval/*.eval.ts` | die drei Läufe |
| `eval/fixtures/**` | die erfundenen Dokumente |

### Was aus der App importiert wird

Die Läufe benutzen bewusst den Produktivcode, nicht Kopien davon — sonst würde das Eval eine
Nachbildung messen statt der App:

| Import | Datei |
|---|---|
| `buildArbeitszeugnisPrompt` | `src/main/prompts/arbeitszeugnis.prompt.ts` |
| `buildDeadlineExtractPrompt` | `src/main/prompts/deadline-extract.prompt.ts` |
| `buildContractCheckPrompt` | `src/main/prompts/contract-check.prompt.ts` |
| `parseArbeitszeugnis`, `isInDocument` | `src/renderer/lib/parse-analysis.ts` |
| `parseContractCheck` | `src/renderer/lib/parse-contract.ts` |
| `parseDeadlineAnchors` | `src/main/lib/parse-deadline-anchors.ts` |
| `computeDeadline` | `src/shared/deadline-calc.ts` |
| `DEFAULT_NUM_CTX` | `src/main/config/constants.ts` |

Zwei Anmerkungen dazu:

- **Keiner der drei Prompt-Builder importiert `electron`** (geprüft), sie lassen sich also
  ohne Electron-Runtime laden. `contract-check.prompt.ts` zieht über
  `language-directive.ts` noch `@shared/languages` nach — deshalb spiegelt
  `vitest.eval.config.ts` die Aliase aus `vitest.config.ts`.
- **`parseDeadlineAnchors` liegt in `src/main/lib/`, nicht in `parse-analysis.ts`.** Der
  Fristen-Parser gehört zum Main-Prozess, weil dort auch die Berechnung läuft. Auch er ist
  frei von Electron-Importen.

Nicht importiert wird `src/main/services/ollama-client.service.ts`: der hängt an
`BrowserWindow` und am Settings-Service und wäre außerhalb der App nicht ladbar. Deshalb der
eigene, 150 Zeilen kurze Client in `eval/lib/ollama.ts`.

## Was dieses Harness NICHT misst

Ehrlichkeitshalber:

- **Die Qualität der Erklärtexte.** Ob `summary`, `plain` und `why` für eine 68-jährige
  Nutzerin ohne juristische Vorbildung verständlich sind, kann keine Zahl beantworten. Das
  bleibt Handarbeit.
- **OCR und Textextraktion.** Die Fixtures sind sauberer Text. Ein schief eingescannter
  Bescheid ist ein anderes Problem.
- **Statistische Signifikanz.** 17 Fixtures, ein Durchlauf, ein Modell. Eine Verbesserung von
  0.62 auf 0.58 mittlerer Abweichung ist Rauschen. Eine von 1.2 auf 0.4 ist ein Ergebnis.
- **Andere Modelle als das eingestellte.** Wer sich auf ein Prompt-Ergebnis verlässt, sollte
  es mit mindestens zwei Modellgrößen messen (`DOZII_EVAL_MODEL`).
