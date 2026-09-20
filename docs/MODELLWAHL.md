# Warum diese Modelle

Der Modellkatalog in `src/shared/model-catalog.ts` ist nicht geschätzt, sondern gemessen.
Dieses Dokument hält fest, womit — damit eine spätere Änderung weiß, wogegen sie antritt.

Messaufbau: AMD-Karte mit 12 GB, Ollama 0.33, alle Modelle Q4, `num_ctx` 8192, ein Modell
zur Zeit. Die Eval-Suiten liegen unter `eval/`, gestartet mit
`DOZII_EVAL_MODEL=<tag> npm run eval`.

## Das Ergebnis

| Stufe | Modell | wofür |
| --- | --- | --- |
| minimal / leicht | **qwen3:4b** (2,5 GB) | der Boden: läuft ohne Grafikkarte, beste Fristen im Feld |
| mittel | **granite4.1:8b** (5,3 GB) | findet die meisten Vertragsklauseln, braucht eine Karte |
| stark | **gemma4:12b** (7,6 GB) | beste Ergebnisse überhaupt, ab 10 GB VRAM |

`granite4.1:3b`, `gemma3:4b`, `qwen2.5:7b` und `llama3.2:3b` bleiben wählbar, werden aber
nicht mehr empfohlen. Eine Stufe für Riesenmodelle führt DoZii bewusst nicht.

## Gibt es einen Boden unter qwen3:4b?

Nein. Gemessen, weil Rechner mit 4 bis 6 GB RAM sonst ein Modell empfohlen bekommen, das
die App selbst als zu gross markiert:

| Modell | Größe | Note | Halluzination | Fristen Recall / Precision |
| --- | --- | --- | --- | --- |
| qwen3:1.7b | 1,4 GB | 1,83 · 3 von 6 | **40 %** | 57,1 % / 80 % |
| llama3.2:3b | 2,0 GB | 1,33 · 4 von 6 | **50 %** | 42,9 % / 50 % |
| granite4.1:3b | 2,1 GB | 1,17 · 4 von 6 | 31 % | 42,9 % |
| **qwen3:4b** | 2,5 GB | **0,33 · 6 von 6** | **10 %** | **100 % / 100 %** |

`qwen3:1.7b` erfindet zwei von fünf Belegzitaten. `llama3.2:3b` die Hälfte, und es dichtet
dem Bescheid ohne Rechtsbehelfsbelehrung eine Frist an — dessen `heavyModeCapable: false`
stand bis dahin als ungeprüfte Annahme im Katalog und ist damit bestätigt. Beide sind
nicht mehr im Katalog, ebenso wenig `qwen2.5:7b` (32K Kontext, von 2024, durch
granite4.1:8b in jeder Hinsicht ersetzt).

Die Folge für schwache Rechner: Es gibt nichts Besseres als `qwen3:4b`, also wird es auch
dort empfohlen — und der RAM-Hinweis **warnt**, statt den Download zu sperren. Die 8 GB
sind eine Komfortschätzung (Modellgröße mal zwei, mindestens 8), kein hartes Limit: 2,5 GB
Modell laufen auf einem 6-GB-Rechner. Gesperrt wurde vorher ausgerechnet das Modell, das
dieselbe App demselben Rechner als Empfehlung anzeigte.

## Die Leitlinie

Das schwächste Modell muss **alle** Funktionen bedienen können. Ein schwacher Rechner soll
langsamer sein, nicht schlechter. Nach oben endet der Katalog dort, wo ein gutes
Gaming-Notebook aufhört — größere Modelle bringen der Zielgruppe nichts, weil sie sie
nicht laden kann.

## Ein Vorbehalt zu den Qualitätszahlen

Die Suiten fuhren mit festen 8192 Tokens Kontext. Das ist die **Untergrenze** der App, nicht
das, was sie wählt. Beim Zeugnis-Modus belegt allein das Prompt-Gerüst rund 4300 Tokens,
die Antwort braucht gemessen 5000 bis 6000 — bei 8192 blieb für das Zeugnis selbst nichts
übrig, und Ollama schiebt beim Schreiben den Anfang des Prompts hinaus.

Gemessen wurde damit ein Zustand, den kein Nutzer hat. Die Ausfälle der kleinen Modelle
sind zum Teil keine Modellschwäche, sondern diese Fehlkonfiguration; dass gemma4:12b unter
diesem Handicap trotzdem fehlerfrei benotet, ist mehr wert, als die Tabelle zeigt.

Behoben in `RESPONSE_RESERVE_TOKENS` / `responseReserveTokens()`; die Eval rechnet das
Fenster seither wie die App (`eval/lib/context.ts`).

Die Zeugnisse der beiden Boden-Kandidaten sind danach **neu gemessen** worden, und das
Ergebnis ist drastisch — dieselbe Datei, dasselbe Modell, nur 12288 statt 8192 Token:

| Modell | Note mit 8192 | Note mit korrektem Fenster |
| --- | --- | --- |
| qwen3:4b | 0 von 6 auswertbar | **0,33 · 6 von 6** |
| granite4.1:3b | 1,33 · 4 von 6 | 1,17 · 4 von 6 |

Die Vertrags- und Fristenzahlen unten stammen noch aus den Läufen davor und sind damit
eine **untere Schranke**. Was von den kleinen Modellen als Schwäche gemessen wurde, war
zu einem guten Teil unsere eigene Fehlkonfiguration.

## Qualität

| Modell | Zeugnisnote | Verträge: Klauseln / Risiko | Fristen: Recall |
| --- | --- | --- | --- |
| granite4.1:3b | 1,17 · 4 von 6, Halluzination 30,8 % | 28,6 % / 1 von 4 | 42,9 %, zweimal gar nichts |
| **qwen3:4b** | **0,33 · 6 von 6**, Halluzination 10,3 % | 42,9 % / **4 von 4** | **100 %** |
| gemma3:4b | 1,83 daneben | — | — |
| granite4.1:8b | 0,83 daneben | **71,4 %** / 2 von 4 | 85,7 %, eine erfundene Frist |
| gemma4:12b | **0,00 · 6 von 6** | 57,1 % / 3 von 4 | **100 %** |

Zwei Befunde stechen heraus.

**Die Zeugnisnote bekommt kein Modell zuverlässig hin.** Alle getesteten Modelle zitieren
die Zufriedenheitsformel korrekt und rechnen sie falsch um: granite4.1:8b las „stets zu
unserer vollsten Zufriedenheit" und nannte das Note 4, gemma3:4b Note 5 — richtig ist 1.
granite4.1:3b antwortete bei fünf von sechs Zeugnissen stumpf mit einer Drei. Die
Zuordnung Wendung → Note ist aber eine feste Tabelle, keine Ermessensfrage, und steht
deshalb seit `src/shared/zeugnis-formel.ts` im Code.

**Erfundene Fristen sind gefährlicher als fehlende.** granite4.1:8b meldete beim Bescheid
ohne Rechtsbehelfsbelehrung eine Frist, die es nicht gibt. granite4.1:3b fand bei zwei von
sechs Bescheiden überhaupt keine. Beides ist nicht hinnehmbar, wenn davon eine Klagefrist
abhängt.

## Was ohne Modell erledigt wird

Auf denselben Dokumenten, ohne jede Rechenzeit und auf jedem Rechner gleich:

| Aufgabe | bestes Modell | Regelwerk |
| --- | --- | --- |
| Hauptformel → Note | 0,83 Noten daneben | **5 von 6 exakt** |
| rote Vertragsklauseln | 5 von 7 | **6 von 7** |
| Gesamtrisiko | 2 von 4 | **4 von 4**, kein Fehlalarm |
| Fristdatum | 85,7 %, eine Erfindung | **jedes gefundene exakt**, keine Erfindung |

Damit verschiebt sich, was das Modell überhaupt leisten muss: verständliches Deutsch
schreiben, versteckte Codes erklären, Klauseln jenseits des Regelwerks finden, Briefe
entwerfen. Das können kleine Modelle deutlich besser als exaktes Extrahieren und Benoten.
Der Boden durfte deshalb kleiner ausfallen, als die ersten Zahlen nahegelegt hatten.

Was das Regelwerk **nicht** kann, steht in `docs/OFFENE-PUNKTE.md`. Es ersetzt die
Modellanalyse nicht, es sichert einen Boden.

## Tempo

Identischer Prompt, Token pro Sekunde:

| Modell | GPU Ausgabe / Prompt | CPU Ausgabe / Prompt |
| --- | --- | --- |
| granite4.1:3b | 79,7 / 1181 | 11,9 / 113 |
| qwen3:4b | 98,1 / 511 | 10,6 / 100 |
| gemma3:4b | 96,2 / 1284 | 12,1 / 120 |
| granite4.1:8b | 59,9 / 361 | 5,1 / 49 |
| gemma4:12b | 17,3 / 90 (unplausibel, siehe unten) | 4,2 / 36 |

Ein Arbeitszeugnis sind rund 4000 Token hinein und, mit dem zweiten Prüfdurchlauf, gut
5000 hinaus. Auf der CPU heißt das:

- 3B/4B: gut eine Minute pro Zeugnis, zwei bis drei Minuten pro Vertrag — zumutbar
- 8B: rund neunzehn Minuten pro Zeugnis, eine halbe Stunde pro Vertrag — nicht zumutbar

Daher gilt: **ohne brauchbare Grafikkarte höchstens die leichte Stufe**, unabhängig davon,
wie viel Arbeitsspeicher der Rechner hat (`determineProfile` in
`src/shared/hardware-profile.ts`). Vorher bekam ein Rechner mit 32 GB RAM und ohne Karte
das 8B empfohlen.

Der GPU-Wert für gemma4:12b widerspricht den Eval-Laufzeiten — dort lag gemma4 bei den
Fristen sogar vor dem 8B. Vermutlich war das 8,4-GB-Modell während dieser einen Messung
nicht vollständig auf der Karte. Die Zahl ist deshalb nicht verwendet worden.

## Denkmodelle

qwen3:4b lieferte bei allen sieben Zeugnissen nichts Verwertbares — keine Note, kein
Zitat. Dasselbe Modell war bei den Fristen mit 100 % Precision und Recall das beste im
Feld und erkannte als einziges den Bescheid ohne Frist korrekt als fristlos.

Der Unterschied ist der Denkmodus: qwen3 stellt seiner Antwort einen `<think>`-Block
voran, hinter dem die strenge JSON-Suche nichts mehr findet. DoZii schaltet den Denkmodus
jetzt ab (`think: false`) und entfernt einen trotzdem durchgerutschten Block, bevor
ausgewertet oder gespeichert wird. Gegengeprüft: auch Modelle ohne Denkmodus, etwa
llama3.2:3b, nehmen die Option widerspruchslos an.

## Eine Warnung zu den Kennzahlen

Die Auswertung meldete zwischenzeitlich „Mittlere Notenabweichung: 0.00 Noten", obwohl
das Modell gar nichts geliefert hatte — der Mittelwert lief über null Messwerte. Eine
Kennzahl, die bei Totalausfall am besten aussieht, ist schlimmer als gar keine. Leere
Stichproben stehen seitdem als `n/a` da, und die Notenabweichung nennt, über wie viele
Zeugnisse sie geht.
