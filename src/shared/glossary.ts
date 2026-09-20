/**
 * Glossar fuer Behoerden- und Rechtsdeutsch. Reine Daten, kein Modellaufruf -
 * die Erklaerung eines Begriffs ist deterministisch, sofort da und funktioniert
 * auch ohne laufendes Ollama.
 *
 * Keine Node-/DOM-APIs -> in Main- UND Renderer-Prozess nutzbar.
 *
 * Schreibregeln fuer neue Eintraege:
 * - `short`: eine Zeile, hoechstens ~90 Zeichen, fuer Tooltip und Trefferliste.
 * - `long`: 2-4 Saetze. Was der Begriff bedeutet UND was er fuer den Nutzer
 *   heisst. Haengt eine Frist dran, steht sie hier.
 * - Duzen, Alltagssprache. Kein Fachwort in der Erklaerung, das nicht selbst
 *   einen Eintrag hat.
 * - `aliases` nur fuer unregelmaessige Formen, Synonyme und Abkuerzungen.
 *   Regelmaessige Beugung (-e/-en/-s/-es/-er/-em/-n) findet der Matcher selbst,
 *   Umlaute und ss/ß ebenfalls (siehe glossary-match.ts).
 */

export type GlossaryCategory =
  | 'verwaltung'
  | 'sozial'
  | 'steuer'
  | 'gericht'
  | 'vertrag'
  | 'arbeit'
  | 'geld'
  | 'wohnen'

export interface GlossaryEntry {
  /** Kanonische Schreibweise - so steht der Begriff in der Erklaerung. */
  term: string
  /** Flexionen, Synonyme, Abkuerzungen. Werden mitgesucht. */
  aliases?: string[]
  /** Eine Zeile Alltagssprache, max ~90 Zeichen. */
  short: string
  /** 2-4 Saetze: Bedeutung plus Konsequenz fuer den Nutzer. */
  long: string
  category: GlossaryCategory
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  // --- Verwaltung / Bescheide ---
  {
    term: 'Bescheid',
    short: 'Die schriftliche Entscheidung einer Behörde über deinen Fall.',
    long: 'Ein Bescheid ist die verbindliche Antwort einer Behörde: Sie bewilligt etwas, lehnt etwas ab oder fordert Geld. Ab dem Tag, an dem er bei dir ankommt, laufen Fristen. Das heißt für dich: Datum auf dem Brief notieren und die Rechtsbehelfsbelehrung am Ende lesen, dort steht, wie lange du dich wehren kannst.',
    category: 'verwaltung'
  },
  {
    term: 'Verwaltungsakt',
    short: 'Der Fachbegriff für eine einzelne Entscheidung einer Behörde.',
    long: 'Ein Verwaltungsakt ist jede Entscheidung, mit der eine Behörde deinen konkreten Einzelfall regelt - ein Bescheid ist der häufigste Fall. Der Begriff ist wichtig, weil nur gegen einen Verwaltungsakt Widerspruch möglich ist. Das heißt für dich: Steht das Wort im Brief, gibt es fast immer auch einen Weg, sich dagegen zu wehren.',
    category: 'verwaltung'
  },
  {
    term: 'Rechtsbehelfsbelehrung',
    aliases: ['Rechtsmittelbelehrung', 'Rechtsbehelfsbelehrungen'],
    short: 'Der Abschnitt am Ende, der sagt, wie und bis wann du dich wehren kannst.',
    long: 'Die Rechtsbehelfsbelehrung steht meist ganz unten und nennt drei Dinge: welches Mittel du hast (Widerspruch, Einspruch oder Klage), bei welcher Stelle und innerhalb welcher Frist. Fehlt sie oder ist sie falsch, verlängert sich die Frist in der Regel auf ein Jahr. Das heißt für dich: Diesen Absatz zuerst lesen, er ist der wichtigste im ganzen Brief.',
    category: 'verwaltung'
  },
  {
    term: 'Rechtsbehelf',
    short: 'Oberbegriff für alle Wege, eine Entscheidung angreifen zu lassen.',
    long: 'Rechtsbehelf ist der Sammelbegriff für Widerspruch, Einspruch, Beschwerde und Klage. Welcher davon passt, steht in der Rechtsbehelfsbelehrung. Das heißt für dich: Du musst nicht wissen, wie das Ding heißt - du musst nur den Weg gehen, den die Belehrung nennt, und die dort genannte Frist halten.',
    category: 'verwaltung'
  },
  {
    term: 'Widerspruch',
    aliases: ['Widerspruchsverfahren', 'Widerspruch einlegen'],
    short: 'Dein schriftlicher Einwand gegen einen Bescheid bei derselben Behörde.',
    long: 'Mit einem Widerspruch sagst du der Behörde, dass du mit ihrer Entscheidung nicht einverstanden bist - sie muss den Fall dann noch einmal komplett prüfen. Er kostet nichts, muss schriftlich sein und in die Widerspruchsfrist passen. Das heißt für dich: Erst fristgerecht Widerspruch einlegen, die Begründung darfst du nachreichen.',
    category: 'verwaltung'
  },
  {
    term: 'Widerspruchsfrist',
    short: 'Meist ein Monat ab dem Tag, an dem der Bescheid bei dir ankam.',
    long: 'Die Widerspruchsfrist beträgt in der Regel einen Monat nach Bekanntgabe des Bescheids. Fehlt die Rechtsbehelfsbelehrung oder ist sie falsch, wird daraus ein Jahr. Maßgeblich ist der Eingang bei der Behörde, nicht dein Absendedatum. Das heißt für dich: Lieber in der ersten Woche abschicken - nach Ablauf der Frist wird der Bescheid bestandskräftig und ist kaum noch angreifbar.',
    category: 'verwaltung'
  },
  {
    term: 'Widerspruchsbescheid',
    short: 'Die Antwort der Behörde auf deinen Widerspruch.',
    long: 'Im Widerspruchsbescheid entscheidet die Behörde, ob sie dir ganz, teilweise oder gar nicht Recht gibt. Er enthält wieder eine Rechtsbehelfsbelehrung - der nächste Schritt wäre dann die Klage vor Gericht. Das heißt für dich: Auch hier läuft ab Zustellung wieder eine Frist, meist ein Monat.',
    category: 'verwaltung'
  },
  {
    term: 'Bestandskraft',
    aliases: ['bestandskräftig', 'rechtskräftig geworden'],
    short: 'Der Bescheid ist endgültig, weil die Frist ungenutzt abgelaufen ist.',
    long: 'Bestandskraft bedeutet: Du hast dich nicht rechtzeitig gewehrt, deshalb gilt die Entscheidung jetzt - auch wenn sie inhaltlich falsch war. Danach hilft nur noch ein Antrag auf Überprüfung, und der hat deutlich schlechtere Chancen. Das heißt für dich: Die Frist ist die eigentliche Hürde, nicht die Begründung.',
    category: 'verwaltung'
  },
  {
    term: 'Anhörung',
    short: 'Die Behörde fragt dich vorab, bevor sie etwas Nachteiliges entscheidet.',
    long: 'Vor einer Entscheidung, die dich belastet, muss dir die Behörde Gelegenheit geben, deine Sicht zu schildern - das ist die Anhörung. Meist bekommst du dafür zwei bis vier Wochen. Das heißt für dich: Antworte unbedingt und schriftlich, denn hier lässt sich ein falscher Bescheid noch verhindern, bevor du dagegen kämpfen musst.',
    category: 'verwaltung'
  },
  {
    term: 'Aktenzeichen',
    aliases: ['Az', 'Az.', 'Geschäftszeichen', 'Kundennummer der Behörde'],
    short: 'Die Nummer, unter der die Behörde deinen Vorgang führt.',
    long: 'Das Aktenzeichen ist die Kennung deines Falls und steht meist oben rechts. Ohne sie landet dein Schreiben im falschen Stapel. Das heißt für dich: Schreib sie in jeden Brief, jede E-Mail und jeden Widerspruch - am besten in die Betreffzeile.',
    category: 'verwaltung'
  },
  {
    term: 'Bekanntgabe',
    aliases: ['bekannt gegeben', 'Bekanntgabefiktion'],
    short: 'Der Tag, an dem ein Bescheid rechtlich als bei dir angekommen gilt.',
    long: 'Ein normaler Behördenbrief gilt vier Tage nach Aufgabe zur Post als bekannt gegeben - auch wenn du ihn später aus dem Briefkasten holst. Ab diesem Tag laufen die Fristen. Das heißt für dich: Rechne ab dem Bescheiddatum plus vier Tage, nicht ab dem Tag, an dem du ihn gelesen hast.',
    category: 'verwaltung'
  },
  {
    term: 'Zustellung',
    short: 'Förmliche Übergabe eines Schreibens, deren Datum nachgewiesen wird.',
    long: 'Bei einer Zustellung wird dokumentiert, wann du ein Schreiben bekommen hast - per Zustellungsurkunde, Einschreiben oder Übergabe. Das Datum ist der Startpunkt aller Fristen. Das heißt für dich: Heb den Umschlag auf, auf ihm steht oft das einzige Datum, das im Streitfall zählt.',
    category: 'verwaltung'
  },
  {
    term: 'Zustellungsurkunde',
    aliases: ['Postzustellungsurkunde', 'PZU', 'gelber Brief', 'gelber Umschlag'],
    short: 'Der gelbe Umschlag - die Post beurkundet, wann du ihn bekommen hast.',
    long: 'Bei einer Zustellungsurkunde notiert der Zusteller Tag und Art der Übergabe und schickt den Nachweis zurück an den Absender. Der gelbe Umschlag trägt dieses Datum handschriftlich. Das heißt für dich: Umschlag nicht wegwerfen und das Datum sofort notieren - ab da läuft deine Frist.',
    category: 'verwaltung'
  },
  {
    term: 'Ersatzzustellung',
    short: 'Zustellung in den Briefkasten oder an Mitbewohner, wenn du nicht da bist.',
    long: 'Trifft der Zusteller dich nicht an, darf er den Brief in den Briefkasten werfen oder einem erwachsenen Mitbewohner geben - die Zustellung ist damit trotzdem wirksam. Urlaub schützt nicht davor. Das heißt für dich: Fristen laufen auch, wenn du wochenlang weg warst - bei längerer Abwesenheit jemanden den Briefkasten leeren lassen.',
    category: 'verwaltung'
  },
  {
    term: 'Öffentliche Zustellung',
    short: 'Zustellung per Aushang, wenn die Behörde deine Adresse nicht kennt.',
    long: 'Ist deine Anschrift unbekannt, hängt die Behörde eine Benachrichtigung öffentlich aus oder veröffentlicht sie - nach zwei Wochen gilt das Schreiben als zugestellt, auch wenn du nie etwas gesehen hast. Das heißt für dich: Halte deine Meldeadresse aktuell und richte bei Umzug einen Nachsendeauftrag ein.',
    category: 'verwaltung'
  },
  {
    term: 'Akteneinsicht',
    short: 'Dein Recht, die Unterlagen zu deinem Fall bei der Behörde zu lesen.',
    long: 'Du darfst sehen, worauf die Behörde ihre Entscheidung stützt - auf Antrag, meist kostenlos vor Ort oder als Kopie. Oft findet man dort den Rechenfehler, den der Bescheid nicht erklärt. Das heißt für dich: Formlos schriftlich beantragen, am besten zusammen mit dem Widerspruch.',
    category: 'verwaltung'
  },
  {
    term: 'Amtshilfe',
    short: 'Eine Behörde arbeitet einer anderen zu und gibt dabei Daten weiter.',
    long: 'Behörden dürfen sich gegenseitig unterstützen, etwa wenn das Finanzamt Daten an die Familienkasse meldet. Das ist erlaubt, aber nur für den jeweiligen Zweck. Das heißt für dich: Angaben, die du einer Stelle machst, können bei einer anderen auftauchen - halte sie überall gleich.',
    category: 'verwaltung'
  },
  {
    term: 'Ermessen',
    aliases: ['Ermessensentscheidung', 'nach pflichtgemäßem Ermessen'],
    short: 'Die Behörde darf entscheiden - und muss dabei deine Lage abwägen.',
    long: 'Steht im Gesetz "kann" statt "muss", hat die Behörde Ermessen: Sie darf so oder anders entscheiden, muss ihre Wahl aber begründen und deine Situation berücksichtigen. Eine Entscheidung ohne jede Abwägung ist angreifbar. Das heißt für dich: Schildere im Widerspruch konkret deine persönlichen Umstände, genau die muss die Behörde bewerten.',
    category: 'verwaltung'
  },
  {
    term: 'Aufhebung',
    aliases: ['aufgehoben', 'Aufhebungsbescheid'],
    short: 'Ein früherer Bescheid wird ganz oder teilweise wieder abgeschafft.',
    long: 'Mit einer Aufhebung nimmt die Behörde eine frühere Entscheidung zurück - das kann dir nützen (die Forderung entfällt) oder schaden (die Bewilligung entfällt). Oft folgt darauf ein Erstattungsbescheid. Das heißt für dich: Prüfe, ab welchem Datum die Aufhebung gilt, rückwirkende Aufhebungen brauchen besonders gute Gründe.',
    category: 'verwaltung'
  },
  {
    term: 'Rücknahme',
    short: 'Ein von Anfang an rechtswidriger Bescheid wird kassiert.',
    long: 'Die Rücknahme betrifft Bescheide, die schon beim Erlass falsch waren. War der Fehler bei der Behörde und hast du auf die Leistung vertraut, darf sie dir das Geld oft nicht rückwirkend wegnehmen. Das heißt für dich: Wenn du nichts verschwiegen hast, lohnt sich der Widerspruch mit dem Argument, dass du auf den Bescheid vertraut hast.',
    category: 'verwaltung'
  },
  {
    term: 'Widerruf',
    short: 'Ein zunächst richtiger Bescheid wird für die Zukunft beendet.',
    long: 'Beim Widerruf war der Bescheid korrekt, die Behörde beendet ihn aber wegen geänderter Umstände - meist nur ab dem Zeitpunkt der Änderung, nicht rückwirkend. Nicht zu verwechseln mit dem Widerrufsrecht bei Verträgen. Das heißt für dich: Kontrolliere das Datum, ab dem gekürzt wird, und melde Änderungen künftig sofort.',
    category: 'verwaltung'
  },
  {
    term: 'aufschiebende Wirkung',
    aliases: ['Suspensiveffekt'],
    short: 'Solange dein Widerspruch läuft, darf die Behörde noch nicht durchgreifen.',
    long: 'Ein Widerspruch hat normalerweise aufschiebende Wirkung: Die Entscheidung wird erst einmal nicht umgesetzt. Bei Geldforderungen und bei Sozialleistungen gibt es aber viele Ausnahmen, dann musst du trotzdem zahlen oder wird trotzdem gekürzt. Das heißt für dich: Steht im Bescheid, dass der Widerspruch keine aufschiebende Wirkung hat, brauchst du zusätzlich einen Eilantrag.',
    category: 'verwaltung'
  },
  {
    term: 'Anordnung der sofortigen Vollziehung',
    aliases: ['sofortige Vollziehung', 'Sofortvollzug', 'sofort vollziehbar'],
    short: 'Die Behörde setzt die Entscheidung sofort um, trotz deines Widerspruchs.',
    long: 'Mit dieser Anordnung nimmt die Behörde deinem Widerspruch die aufschiebende Wirkung - sie muss das schriftlich und im Einzelfall begründen. Dagegen hilft nur ein Eilantrag beim Gericht. Das heißt für dich: Hier zählen Tage, nicht Wochen - hol dir schnell Hilfe bei einer Beratungsstelle oder beantrage Beratungshilfe.',
    category: 'verwaltung'
  },
  {
    term: 'Vollziehung',
    short: 'Die tatsächliche Umsetzung dessen, was im Bescheid steht.',
    long: 'Vollziehung heißt, dass die Behörde ihre Entscheidung in die Tat umsetzt: Geld einziehen, eine Erlaubnis entziehen, etwas räumen lassen. Das setzt voraus, dass der Bescheid wirksam und nicht gestoppt ist. Das heißt für dich: Wenn du die Umsetzung stoppen willst, brauchst du entweder die aufschiebende Wirkung oder die Aussetzung der Vollziehung.',
    category: 'verwaltung'
  },
  {
    term: 'Zwangsgeld',
    short: 'Geldbetrag, der dich zu einer Handlung drängen soll - keine Strafe.',
    long: 'Ein Zwangsgeld wird angedroht und fällig, wenn du etwas Angeordnetes nicht tust, zum Beispiel Unterlagen einreichen. Es ist kein Bußgeld: Machst du es nachträglich, kann es entfallen, sonst wird es erhöht und erneut angedroht. Das heißt für dich: Die verlangte Handlung nachholen ist fast immer billiger als das Zwangsgeld zu zahlen.',
    category: 'verwaltung'
  },
  {
    term: 'Ersatzvornahme',
    short: 'Die Behörde lässt es selbst machen und schickt dir die Rechnung.',
    long: 'Tust du etwas nicht, was du tun müsstest, darf die Behörde eine Firma beauftragen - die Kosten trägst du. Angekündigt wird das vorher schriftlich mit Frist. Das heißt für dich: Solange die Frist läuft, ist Selbermachen fast immer deutlich günstiger.',
    category: 'verwaltung'
  },
  {
    term: 'Wiedereinsetzung in den vorigen Stand',
    aliases: ['Wiedereinsetzung'],
    short: 'Zweite Chance, wenn du eine Frist unverschuldet verpasst hast.',
    long: 'Warst du ohne eigenes Verschulden verhindert - schwere Krankheit, Krankenhaus, nachweislich verlorene Post -, kannst du Wiedereinsetzung beantragen. Der Antrag muss innerhalb von zwei Wochen nach Wegfall des Hindernisses gestellt werden, und die versäumte Handlung musst du gleichzeitig nachholen. Das heißt für dich: Sofort handeln und Belege beilegen, Urlaub oder Vergesslichkeit reichen als Grund nicht.',
    category: 'verwaltung'
  },
  {
    term: 'Untätigkeitsklage',
    short: 'Klage, weil die Behörde einfach gar nicht entscheidet.',
    long: 'Passiert nach deinem Antrag oder Widerspruch monatelang nichts, kannst du auf eine Entscheidung klagen - in der Regel nach drei Monaten Untätigkeit bei einem Widerspruch. Ziel ist kein Inhalt, sondern überhaupt eine Antwort. Das heißt für dich: Erst schriftlich mit Fristsetzung erinnern, das löst oft schon eine Entscheidung aus.',
    category: 'verwaltung'
  },
  {
    term: 'Nebenbestimmung',
    short: 'Zusatz im Bescheid, der die Bewilligung an Bedingungen knüpft.',
    long: 'Eine Nebenbestimmung hängt an der eigentlichen Entscheidung: eine Befristung, eine Bedingung oder eine Auflage. Sie ist genauso verbindlich wie der Hauptteil. Das heißt für dich: Lies den Bescheid bis zum Ende - die Pflichten stehen oft erst hinter der guten Nachricht.',
    category: 'verwaltung'
  },
  {
    term: 'Auflage',
    short: 'Eine zusätzliche Pflicht, die du neben der Bewilligung erfüllen musst.',
    long: 'Die Auflage verlangt ein Tun oder Unterlassen, ohne die Bewilligung selbst infrage zu stellen - etwa jährlich einen Nachweis einzureichen. Erfüllst du sie nicht, droht der Widerruf. Das heißt für dich: Trag dir die genannten Termine sofort in den Kalender ein.',
    category: 'verwaltung'
  },
  {
    term: 'Gebührenbescheid',
    aliases: ['Kostenbescheid'],
    short: 'Rechnung einer Behörde für eine Amtshandlung.',
    long: 'Ein Gebührenbescheid verlangt Geld für eine Leistung der Verwaltung, etwa einen Ausweis oder eine Genehmigung. Auch er ist ein Verwaltungsakt und hat eine Rechtsbehelfsbelehrung. Das heißt für dich: Du kannst nicht nur die Sachentscheidung, sondern auch die Höhe der Gebühr mit Widerspruch angreifen.',
    category: 'verwaltung'
  },
  {
    term: 'Leistungsbescheid',
    short: 'Bescheid, der dich konkret zur Zahlung eines Betrags auffordert.',
    long: 'Der Leistungsbescheid beziffert, was du bis wann zahlen sollst, und ist die Grundlage für spätere Vollstreckung. Er nennt Betrag, Frist und Verwendungszweck. Das heißt für dich: Zahlungsfrist und Widerspruchsfrist sind zwei verschiedene Dinge - beide getrennt notieren.',
    category: 'verwaltung'
  },

  // --- Sozialrecht ---
  {
    term: 'Bürgergeld',
    aliases: ['Arbeitslosengeld II', 'ALG II', 'Hartz IV', 'Grundsicherung für Arbeitsuchende'],
    short: 'Grundsicherung vom Jobcenter für Menschen ohne ausreichendes Einkommen.',
    long: 'Das Bürgergeld deckt den Lebensunterhalt und die Wohnkosten, wenn dein Einkommen und Vermögen nicht reichen. Zuständig ist das Jobcenter, bewilligt wird immer nur für einen begrenzten Zeitraum. Das heißt für dich: Rechtzeitig einen Weiterbewilligungsantrag stellen und jede Änderung sofort melden, sonst drohen Rückforderungen.',
    category: 'sozial'
  },
  {
    term: 'Regelbedarf',
    aliases: ['Regelsatz', 'Regelleistung'],
    short: 'Der monatliche Pauschalbetrag für Essen, Kleidung und Alltag.',
    long: 'Der Regelbedarf ist ein fester Betrag pro Person, gestaffelt nach Alter und Rolle im Haushalt - Miete und Heizung sind darin nicht enthalten. Er wird jedes Jahr neu festgelegt. Das heißt für dich: Prüfe im Bescheid, ob für jede Person im Haushalt die richtige Stufe angesetzt wurde, das ist eine häufige Fehlerquelle.',
    category: 'sozial'
  },
  {
    term: 'Mehrbedarf',
    short: 'Zuschlag zum Regelbedarf für besondere Lebenslagen.',
    long: 'Einen Mehrbedarf gibt es zum Beispiel bei Schwangerschaft, für Alleinerziehende, bei einer Behinderung oder bei ärztlich bestätigter teurer Ernährung. Er wird nicht automatisch gewährt. Das heißt für dich: Du musst ihn selbst beantragen und belegen - viele Menschen verschenken Geld, weil sie nicht danach fragen.',
    category: 'sozial'
  },
  {
    term: 'Bedarfsgemeinschaft',
    short: 'Alle Personen im Haushalt, deren Geld gemeinsam gerechnet wird.',
    long: 'Zur Bedarfsgemeinschaft gehören meist Partner und minderjährige Kinder - das Einkommen der einen wird auf den Bedarf der anderen angerechnet. Wer nur zufällig zusammenwohnt, gehört nicht dazu. Das heißt für dich: Wird jemand zu Unrecht mitgerechnet, sinkt dein Geld zu Unrecht - das ist ein starker Widerspruchsgrund.',
    category: 'sozial'
  },
  {
    term: 'Kosten der Unterkunft',
    aliases: ['KdU', 'Kosten der Unterkunft und Heizung', 'Unterkunftskosten', 'KdUH'],
    short: 'Miete und Heizung, die das Jobcenter zusätzlich zum Regelbedarf zahlt.',
    long: 'Übernommen werden die tatsächlichen Wohnkosten, solange sie als angemessen gelten - was angemessen ist, legt jede Kommune selbst fest. Liegst du darüber, wird nach einer Übergangszeit gekürzt. Das heißt für dich: Bekommst du eine Aufforderung, die Kosten zu senken, reagiere schriftlich und dokumentiere deine Wohnungssuche.',
    category: 'sozial'
  },
  {
    term: 'Angemessenheitsgrenze',
    aliases: ['angemessene Wohnkosten', 'Mietobergrenze'],
    short: 'Die Obergrenze, bis zu der deine Miete voll übernommen wird.',
    long: 'Jede Stadt und jeder Landkreis legt fest, welche Miete für welche Haushaltsgröße als angemessen gilt. Diese Grenzen sind häufig veraltet und wurden schon oft von Gerichten gekippt. Das heißt für dich: Wird dir gekürzt, lohnt der Widerspruch mit dem Hinweis, dass für dein Geld keine passende Wohnung zu finden ist.',
    category: 'sozial'
  },
  {
    term: 'Anrechnung',
    aliases: ['angerechnet', 'Einkommensanrechnung'],
    short: 'Eigenes Einkommen wird von der Leistung abgezogen.',
    long: 'Verdienst du etwas dazu oder bekommst andere Zahlungen, zieht die Behörde das von deiner Leistung ab - aber nicht alles, ein Teil bleibt dir als Freibetrag. Welcher Monat gerechnet wird, richtet sich nach dem Zufluss des Geldes. Das heißt für dich: Prüfe im Bescheid, ob der richtige Betrag im richtigen Monat und nach Abzug der Freibeträge gerechnet wurde.',
    category: 'sozial'
  },
  {
    term: 'Freibetrag',
    short: 'Der Teil deines Einkommens oder Vermögens, der dir anrechnungsfrei bleibt.',
    long: 'Ein Freibetrag sorgt dafür, dass sich Arbeit lohnt: Ein Teil des Verdienstes wird nicht abgezogen, außerdem bleiben bestimmte Beträge an Erspartem geschützt. Die Höhe hängt von Verdienst, Kindern und Lebenslage ab. Das heißt für dich: Rechne nach, ob die Freibeträge abgezogen wurden, bevor angerechnet wurde - hier passieren viele Fehler.',
    category: 'sozial'
  },
  {
    term: 'Leistungsminderung',
    aliases: ['Sanktion', 'Sanktionen', 'Kürzung der Leistung'],
    short: 'Kürzung der Leistung als Folge einer verletzten Pflicht.',
    long: 'Wer ohne wichtigen Grund Termine versäumt oder zumutbare Arbeit ablehnt, bekommt für eine begrenzte Zeit weniger Geld - gestaffelt nach Schwere und Wiederholung. Vorher muss die Behörde dich anhören. Das heißt für dich: Nenne deinen wichtigen Grund sofort und schriftlich mit Beleg, Krankheit oder Betreuungspflichten zählen.',
    category: 'sozial'
  },
  {
    term: 'Meldeversäumnis',
    aliases: ['Meldeversäumnisse', 'versäumter Termin'],
    short: 'Du bist zu einem Termin der Behörde nicht erschienen.',
    long: 'Ein verpasster Termin beim Jobcenter oder der Arbeitsagentur führt zu einer Leistungsminderung, wenn du keinen wichtigen Grund nachweist. Die Einladung enthält immer den Hinweis auf diese Folge. Das heißt für dich: Kannst du nicht kommen, sag vorher ab und reiche eine Bescheinigung nach - das kostet dich fünf Minuten und spart Geld.',
    category: 'sozial'
  },
  {
    term: 'Mitwirkungspflicht',
    short: 'Deine Pflicht, Unterlagen zu liefern und Änderungen zu melden.',
    long: 'Die Behörde darf nur entscheiden, was sie weiß - deshalb musst du Nachweise einreichen, Fragen beantworten und Änderungen unaufgefordert melden. Tust du das nicht, kann die Leistung ganz versagt werden. Das heißt für dich: Reiche Unterlagen nachweisbar ein, also per Einwurf mit Zeugen, per Post mit Beleg oder über das Portal mit Quittung.',
    category: 'sozial'
  },
  {
    term: 'Erstattungsbescheid',
    aliases: ['Rückforderungsbescheid', 'Erstattungsforderung'],
    short: 'Die Behörde verlangt bereits gezahltes Geld zurück.',
    long: 'Ein Erstattungsbescheid folgt meist auf eine Aufhebung: Die Bewilligung fällt weg, das Geld soll zurück. Er nennt Zeitraum, Betrag und Grund. Das heißt für dich: Innerhalb der Widerspruchsfrist prüfen lassen, ob die Aufhebung überhaupt zulässig war - und parallel eine Ratenzahlungsvereinbarung anbieten.',
    category: 'sozial'
  },
  {
    term: 'Aufrechnung',
    short: 'Die Behörde behält einen Teil deiner laufenden Leistung ein.',
    long: 'Statt Geld von dir zu fordern, verrechnet die Behörde alte Schulden mit deiner monatlichen Zahlung - bei Sozialleistungen ist die Höhe begrenzt, damit dir das Nötigste bleibt. Sie muss die Aufrechnung vorher schriftlich erklären. Das heißt für dich: Reicht das verbleibende Geld nicht zum Leben, beantrage eine niedrigere Rate oder das Aussetzen der Aufrechnung.',
    category: 'sozial'
  },
  {
    term: 'Darlehen',
    short: 'Geld von der Behörde, das du zurückzahlen musst.',
    long: 'Für einmalige unabweisbare Dinge - etwa eine Mietkaution oder eine kaputte Waschmaschine - gibt es oft nur ein Darlehen statt eines Zuschusses. Zurückgezahlt wird meist durch monatliche Abzüge von der laufenden Leistung. Das heißt für dich: Frag ausdrücklich nach, ob ein Zuschuss möglich ist, und lass dir die Rückzahlrate schriftlich geben.',
    category: 'sozial'
  },
  {
    term: 'Vorschuss',
    short: 'Abschlagszahlung, solange über deinen Antrag noch entschieden wird.',
    long: 'Zieht sich die Bearbeitung hin und steht dir die Leistung dem Grunde nach zu, kannst du einen Vorschuss verlangen. Er wird später mit der endgültigen Leistung verrechnet. Das heißt für dich: Bei Zahlungsverzug der Behörde schriftlich einen Vorschuss beantragen statt weiter zu warten.',
    category: 'sozial'
  },
  {
    term: 'Weiterbewilligungsantrag',
    aliases: ['WBA', 'Folgeantrag'],
    short: 'Antrag, damit deine Leistung nach Ablauf weiterläuft.',
    long: 'Bewilligungen gelten nur für einen bestimmten Zeitraum - danach zahlt niemand automatisch weiter. Der Folgeantrag sollte einige Wochen vor Ablauf gestellt werden. Das heißt für dich: Trag das Enddatum aus dem Bescheid in den Kalender ein und stelle den Antrag mindestens vier Wochen vorher.',
    category: 'sozial'
  },
  {
    term: 'Eingliederungsvereinbarung',
    aliases: ['EGV'],
    short: 'Schriftliche Abmachung mit dem Jobcenter über deine Bemühungen.',
    long: 'Darin steht, was das Jobcenter tut und was du tun sollst, etwa Bewerbungen schreiben. Sie ist verhandelbar, und du darfst sie vor der Unterschrift in Ruhe zu Hause lesen. Das heißt für dich: Unterschreib nichts, was du nicht schaffen kannst - unrealistische Pflichten führen später zu einer Leistungsminderung.',
    category: 'sozial'
  },
  {
    term: 'Kooperationsplan',
    short: 'Die gemeinsam erarbeitete Nachfolge der Eingliederungsvereinbarung.',
    long: 'Der Kooperationsplan hält in einfacher Sprache fest, welches Ziel du verfolgst und welche Schritte beide Seiten gehen. Anders als früher enthält er selbst keine Rechtsfolgenbelehrung. Das heißt für dich: Widersprich Formulierungen, die du nicht einhalten kannst, und bitte um eine Kopie für deine Unterlagen.',
    category: 'sozial'
  },
  {
    term: 'Vorläufige Bewilligung',
    aliases: ['vorläufig bewilligt', 'vorläufige Entscheidung'],
    short: 'Vorläufige Zahlung, weil dein Einkommen noch schwankt oder unklar ist.',
    long: 'Bei unsicherem Einkommen zahlt die Behörde zunächst geschätzt und rechnet später genau ab. Ergibt die Abrechnung, dass du zu viel bekommen hast, musst du zurückzahlen. Das heißt für dich: Leg alle Einkommensnachweise sofort vor und lege Geld für eine mögliche Nachforderung zurück.',
    category: 'sozial'
  },
  {
    term: 'Endgültige Festsetzung',
    aliases: ['abschließende Entscheidung', 'Schlussabrechnung'],
    short: 'Die genaue Abrechnung nach einer vorläufigen Bewilligung.',
    long: 'Hier wird mit den echten Zahlen nachgerechnet - daraus folgt entweder eine Nachzahlung an dich oder eine Rückforderung. Sie muss innerhalb eines Jahres nach Ende des vorläufigen Zeitraums kommen. Das heißt für dich: Vergleiche die angesetzten Monatsbeträge mit deinen Lohnabrechnungen, bevor du zahlst.',
    category: 'sozial'
  },
  {
    term: 'Karenzzeit',
    short: 'Schonfrist am Anfang, in der Vermögen und Wohnkosten geschützt sind.',
    long: 'Im ersten Jahr des Leistungsbezugs gelten großzügigere Regeln: Die tatsächliche Miete wird übernommen und es gilt ein deutlich höherer Vermögensfreibetrag. Danach greifen die normalen Grenzen. Das heißt für dich: Nutze dieses Jahr, um dich in Ruhe um Arbeit oder eine günstigere Wohnung zu kümmern.',
    category: 'sozial'
  },
  {
    term: 'Schonvermögen',
    aliases: ['geschütztes Vermögen'],
    short: 'Erspartes, das du behalten darfst, ohne dass es angerechnet wird.',
    long: 'Ein bestimmter Betrag pro Person, ein angemessenes Auto, Hausrat und geschützte Altersvorsorge bleiben dir - erst darüber hinaus musst du eigenes Geld einsetzen. Die Grenzen sind im ersten Jahr höher. Das heißt für dich: Gib dein Vermögen vollständig an, aber verweise auf die Freibeträge, statt vorschnell alles aufzulösen.',
    category: 'sozial'
  },
  {
    term: 'Wohngeld',
    aliases: ['Mietzuschuss', 'Lastenzuschuss'],
    short: 'Zuschuss zur Miete für Haushalte mit kleinem eigenem Einkommen.',
    long: 'Wohngeld bekommst du, wenn du dein Einkommen selbst erwirtschaftest, es aber für die Miete knapp wird - es ist unabhängig vom Jobcenter und wird bei der Wohngeldstelle beantragt. Es wird meist für zwölf Monate bewilligt. Das heißt für dich: Prüfe Wohngeld und Kinderzuschlag, bevor du Bürgergeld beantragst, damit bist du oft besser gestellt.',
    category: 'sozial'
  },
  {
    term: 'Kinderzuschlag',
    aliases: ['KiZ'],
    short: 'Zusatzgeld für Eltern, deren Einkommen nur für sie selbst reicht.',
    long: 'Der Kinderzuschlag wird zusätzlich zum Kindergeld gezahlt und bei der Familienkasse beantragt. Zusammen mit Wohngeld ersetzt er für viele Familien den Gang zum Jobcenter und bringt zusätzlich die Befreiung von Kita-Gebühren. Das heißt für dich: Beantrage ihn auch bei unsicherem Einkommen, die Prüfung kostet nichts.',
    category: 'sozial'
  },
  {
    term: 'Grundsicherung im Alter',
    aliases: ['Grundsicherung bei Erwerbsminderung', 'Altersgrundsicherung'],
    short: 'Hilfe zum Lebensunterhalt, wenn Rente oder Erwerbsfähigkeit nicht reichen.',
    long: 'Diese Leistung kommt vom Sozialamt und gilt ab der Regelaltersgrenze oder bei dauerhaft voller Erwerbsminderung. Kinder und Eltern müssen in aller Regel nicht dafür zahlen. Das heißt für dich: Scheu dich nicht davor, die Angst vor dem Rückgriff auf die Familie ist bei normalen Einkommen unbegründet.',
    category: 'sozial'
  },
  {
    term: 'Arbeitslosengeld I',
    aliases: ['ALG I', 'Arbeitslosengeld'],
    short: 'Versicherungsleistung nach Jobverlust, abhängig vom früheren Lohn.',
    long: 'Das Arbeitslosengeld I zahlt die Agentur für Arbeit, wenn du vorher lange genug versichert warst - die Höhe richtet sich nach deinem letzten Verdienst, die Dauer nach Beschäftigungszeit und Alter. Es hat nichts mit Bedürftigkeit zu tun. Das heißt für dich: Melde dich sofort arbeitsuchend, spätestens am ersten Tag der Arbeitslosigkeit arbeitslos, sonst drohen Abzüge.',
    category: 'sozial'
  },
  {
    term: 'Sperrzeit',
    short: 'Wochen ohne Arbeitslosengeld, weil du die Arbeitslosigkeit mitverursacht hast.',
    long: 'Eine Sperrzeit droht bei eigener Kündigung, bei einem Aufhebungsvertrag oder wenn du eine zumutbare Stelle ablehnst - bei Arbeitsaufgabe sind es in der Regel zwölf Wochen, und die Bezugsdauer verkürzt sich zusätzlich. Ein wichtiger Grund kann sie verhindern. Das heißt für dich: Unterschreib keinen Aufhebungsvertrag, ohne vorher die Folgen für dein Arbeitslosengeld zu klären.',
    category: 'sozial'
  },
  {
    term: 'Ortsabwesenheit',
    aliases: ['Ortsabwesenheitsgenehmigung'],
    short: 'Abwesenheit vom Wohnort, die du vorher genehmigen lassen musst.',
    long: 'Wer Leistungen bezieht, muss erreichbar sein - für Urlaub oder längere Reisen brauchst du vorher die Zustimmung, sonst entfällt die Leistung für diese Tage. Üblich sind bis zu drei Wochen im Jahr. Das heißt für dich: Genehmigung immer vor der Abreise einholen und schriftlich aufbewahren.',
    category: 'sozial'
  },

  // --- Steuer ---
  {
    term: 'Steuerbescheid',
    short: 'Die Abrechnung des Finanzamts über ein Steuerjahr.',
    long: 'Der Steuerbescheid sagt, wie viel Steuer für ein Jahr festgesetzt wird und ob du Geld zurückbekommst oder nachzahlen musst. Er wiederholt deine Angaben - Abweichungen davon sind in den Erläuterungen am Ende begründet. Das heißt für dich: Vergleiche die Zahlen mit deiner Erklärung; ab Bekanntgabe hast du einen Monat Zeit für den Einspruch.',
    category: 'steuer'
  },
  {
    term: 'Einspruch',
    aliases: ['Einspruch einlegen', 'Einspruchsverfahren'],
    short: 'Dein Widerspruch gegen einen Steuerbescheid - so heißt er im Steuerrecht.',
    long: 'Der Einspruch ist kostenlos, formlos schriftlich möglich und führt dazu, dass das Finanzamt den Fall komplett neu prüft. Achtung: Dabei kann es auch zu deinen Ungunsten korrigieren, dann darfst du den Einspruch aber zurücknehmen. Das heißt für dich: Innerhalb eines Monats einlegen, Begründung später nachreichen.',
    category: 'steuer'
  },
  {
    term: 'Einspruchsfrist',
    short: 'Ein Monat ab Bekanntgabe des Steuerbescheids.',
    long: 'Die Frist beginnt vier Tage nach dem Datum des Bescheids und endet einen Monat später; fällt das Ende auf ein Wochenende oder einen Feiertag, zählt der nächste Werktag. Der Einspruch muss beim Finanzamt eingegangen sein, nicht nur abgeschickt. Das heißt für dich: Rechne dir das Enddatum aus und schick lieber eine Woche früher los.',
    category: 'steuer'
  },
  {
    term: 'Festsetzung',
    aliases: ['festgesetzt', 'Steuerfestsetzung'],
    short: 'Das Finanzamt legt verbindlich fest, wie viel Steuer du schuldest.',
    long: 'Mit der Festsetzung wird aus deiner Erklärung eine verbindliche Zahl. Ohne besonderen Vermerk ist sie endgültig und nach Ablauf der Einspruchsfrist kaum noch änderbar. Das heißt für dich: Schau nach, ob der Bescheid unter Vorbehalt der Nachprüfung steht - dann bleibt länger Spielraum.',
    category: 'steuer'
  },
  {
    term: 'Vorbehalt der Nachprüfung',
    aliases: ['unter Vorbehalt der Nachprüfung', 'VdN'],
    short: 'Der Bescheid ist vorläufig, das Finanzamt kann ihn jederzeit ändern.',
    long: 'Steht dieser Satz im Bescheid, hat das Finanzamt noch nicht abschließend geprüft - beide Seiten können den Fall später jederzeit wieder aufmachen. Der Vorbehalt endet, wenn die Festsetzungsfrist abläuft oder er aufgehoben wird. Das heißt für dich: Du kannst auch nach der Einspruchsfrist noch eine Änderung beantragen, musst aber ebenso mit Nachforderungen rechnen.',
    category: 'steuer'
  },
  {
    term: 'Vorläufigkeitsvermerk',
    aliases: ['vorläufig nach § 165 AO', 'Vorläufigkeit'],
    short: 'Ein bestimmter Punkt bleibt offen, weil er vor Gericht geklärt wird.',
    long: 'Der Vermerk hält einen einzelnen Streitpunkt offen, bis ein Musterverfahren entschieden ist - für diesen Punkt musst du keinen eigenen Einspruch einlegen. Alles andere im Bescheid wird trotzdem endgültig. Das heißt für dich: Lies, welche Punkte genannt sind; alles, was dort nicht steht, musst du selbst mit Einspruch angreifen.',
    category: 'steuer'
  },
  {
    term: 'Vorauszahlung',
    aliases: ['Steuervorauszahlung', 'Vorauszahlungen'],
    short: 'Quartalsweise Abschläge auf die Steuer des laufenden Jahres.',
    long: 'Wer nicht nur Lohn bezieht, zahlt die Steuer in vier Raten im Voraus, meist im März, Juni, September und Dezember. Die Höhe schätzt das Finanzamt aus dem Vorjahr. Das heißt für dich: Verdienst du deutlich weniger als im Vorjahr, kannst du formlos die Herabsetzung der Vorauszahlungen beantragen.',
    category: 'steuer'
  },
  {
    term: 'Nachzahlung',
    aliases: ['nachzuzahlen', 'Nachforderung'],
    short: 'Der Betrag, den du zusätzlich überweisen musst.',
    long: 'Eine Nachzahlung entsteht, wenn im Jahr zu wenig gezahlt wurde. Sie ist in der Regel einen Monat nach Bekanntgabe fällig - unabhängig davon, ob du Einspruch eingelegt hast. Das heißt für dich: Willst du nicht zahlen, während der Einspruch läuft, brauchst du zusätzlich die Aussetzung der Vollziehung.',
    category: 'steuer'
  },
  {
    term: 'Säumniszuschlag',
    aliases: ['Säumniszuschläge'],
    short: 'Strafaufschlag für jeden angefangenen Monat, den du zu spät zahlst.',
    long: 'Zahlst du eine Steuer nicht rechtzeitig, kommt pro angefangenem Monat ein Prozent des rückständigen Betrags dazu, abgerundet auf volle fünfzig Euro. Das läuft automatisch, ohne Mahnung. Das heißt für dich: Selbst eine Teilzahlung senkt den Zuschlag - und bei Zahlungsproblemen lieber vorher Stundung beantragen.',
    category: 'steuer'
  },
  {
    term: 'Verspätungszuschlag',
    short: 'Aufschlag, weil du die Steuererklärung zu spät abgegeben hast.',
    long: 'Der Verspätungszuschlag bestraft die verspätete Abgabe, nicht die verspätete Zahlung - bei deutlicher Überschreitung wird er automatisch festgesetzt und nach Monaten berechnet. Er kann erlassen werden, wenn du die Verzögerung nicht zu vertreten hast. Das heißt für dich: Beantrage lieber vorher eine Fristverlängerung, das ist formlos möglich und meist erfolgreich.',
    category: 'steuer'
  },
  {
    term: 'Stundung',
    aliases: ['gestundet', 'Zahlungsaufschub'],
    short: 'Du darfst später oder in Raten zahlen, ohne dass vollstreckt wird.',
    long: 'Bei einer Stundung verschiebt das Finanzamt die Fälligkeit - meist gegen Zinsen, aber ohne Säumniszuschlag und ohne Vollstreckung. Du musst begründen, warum sofortiges Zahlen dich hart treffen würde, und in der Regel einen Ratenplan vorschlagen. Das heißt für dich: Antrag stellen, bevor die Zahlungsfrist abläuft, danach wird es teurer.',
    category: 'steuer'
  },
  {
    term: 'Vollstreckung',
    short: 'Die Behörde holt sich das Geld zwangsweise, wenn du nicht zahlst.',
    long: 'Kommt keine Zahlung, darf die Behörde ohne Gerichtsverfahren pfänden lassen, etwa Konto oder Lohn. Angekündigt wird das durch eine Mahnung und eine Vollstreckungsankündigung. Das heißt für dich: Reagiere spätestens auf die Ankündigung - eine vereinbarte Rate ist immer besser als eine Pfändung.',
    category: 'steuer'
  },
  {
    term: 'Aussetzung der Vollziehung',
    aliases: ['AdV', 'Vollziehung aussetzen'],
    short: 'Antrag, während des Einspruchs vorerst nicht zahlen zu müssen.',
    long: 'Ein Einspruch allein stoppt die Zahlungspflicht nicht - dafür brauchst du zusätzlich die Aussetzung der Vollziehung, die gewährt wird, wenn ernstliche Zweifel am Bescheid bestehen. Verlierst du später, fallen Zinsen an. Das heißt für dich: Immer zusammen mit dem Einspruch beantragen, sonst wird trotz laufendem Verfahren vollstreckt.',
    category: 'steuer'
  },
  {
    term: 'Werbungskosten',
    short: 'Ausgaben rund um deinen Job, die deine Steuer senken.',
    long: 'Dazu zählen Fahrten zur Arbeit, Arbeitsmittel, Fortbildung, Bewerbungen und ein Arbeitszimmer. Ohne Nachweise wird nur eine Pauschale angesetzt. Das heißt für dich: Sammle Belege - erst oberhalb der Pauschale wirkt sich jeder Euro aus, dafür dann voll.',
    category: 'steuer'
  },
  {
    term: 'Sonderausgaben',
    short: 'Private Ausgaben, die der Staat trotzdem steuerlich anerkennt.',
    long: 'Dazu gehören Beiträge zur Kranken- und Altersvorsorge, Spenden, Kirchensteuer und Kinderbetreuung. Sie haben nichts mit deinem Job zu tun, senken aber trotzdem das zu versteuernde Einkommen. Das heißt für dich: Besonders Vorsorgebeiträge und Betreuungskosten werden oft vergessen und bringen spürbar Geld zurück.',
    category: 'steuer'
  },
  {
    term: 'Außergewöhnliche Belastungen',
    short: 'Hohe unvermeidbare Privatkosten, etwa durch Krankheit oder Pflege.',
    long: 'Krankheitskosten, Pflege, Behinderung oder eine Beerdigung können abgesetzt werden, soweit sie über deiner zumutbaren Eigenbelastung liegen - diese Grenze hängt von Einkommen und Kinderzahl ab. Das heißt für dich: Sammle solche Kosten möglichst in einem Jahr, dann überspringst du die Grenze eher.',
    category: 'steuer'
  },
  {
    term: 'Grundfreibetrag',
    short: 'Der Teil des Einkommens, auf den gar keine Steuer anfällt.',
    long: 'Bis zu diesem Betrag bleibt dein Jahreseinkommen steuerfrei, er sichert das Existenzminimum und steigt fast jedes Jahr. Erst darüber beginnt die Steuer. Das heißt für dich: Hast du wenig verdient und trotzdem Lohnsteuer gezahlt, lohnt sich eine freiwillige Steuererklärung fast immer.',
    category: 'steuer'
  },

  // --- Gericht / Mahnverfahren / Vollstreckung ---
  {
    term: 'Mahnbescheid',
    aliases: ['gerichtlicher Mahnbescheid', 'Mahnverfahren'],
    short: 'Gelbes Gerichtsschreiben, mit dem jemand Geld von dir verlangt.',
    long: 'Ein Mahnbescheid wird vom Gericht verschickt, ohne dass geprüft wurde, ob die Forderung berechtigt ist. Du hast zwei Wochen ab Zustellung Zeit, mit dem beiliegenden Formular zu widersprechen. Das heißt für dich: Bist du dir unsicher, widersprich fristgerecht - das kostet nichts und verhindert, dass aus der Forderung ein Vollstreckungstitel wird.',
    category: 'gericht'
  },
  {
    term: 'Widerspruch gegen den Mahnbescheid',
    aliases: ['Widerspruch gegen Mahnbescheid'],
    short: 'Dein Kreuz auf dem Formular - zwei Wochen ab Zustellung.',
    long: 'Der Widerspruch stoppt das Mahnverfahren: Wer das Geld will, muss dann normal klagen und die Forderung beweisen. Eine Begründung brauchst du nicht, ein Teilwiderspruch ist möglich. Das heißt für dich: Formular ausfüllen, unterschreiben und innerhalb von zwei Wochen ans Gericht schicken - auch verspätet lohnt es sich noch, solange kein Vollstreckungsbescheid da ist.',
    category: 'gericht'
  },
  {
    term: 'Vollstreckungsbescheid',
    short: 'Der Schritt nach dem Mahnbescheid - damit kann gepfändet werden.',
    long: 'Hast du dem Mahnbescheid nicht widersprochen, folgt der Vollstreckungsbescheid; er ist ein Vollstreckungstitel und dreißig Jahre gültig. Dagegen hilft nur der Einspruch innerhalb von zwei Wochen ab Zustellung. Das heißt für dich: Jetzt zählt jeder Tag - Einspruch einlegen und sofort eine Schuldnerberatung aufsuchen.',
    category: 'gericht'
  },
  {
    term: 'Einspruch gegen den Vollstreckungsbescheid',
    short: 'Letzte Chance nach dem Mahnbescheid - zwei Wochen ab Zustellung.',
    long: 'Der Einspruch führt dazu, dass die Sache vor einem Gericht normal verhandelt wird. Er stoppt die Zwangsvollstreckung aber nicht automatisch, dafür brauchst du zusätzlich einen Antrag auf einstweilige Einstellung. Das heißt für dich: Beides in einem Schreiben beantragen und die Frist keinesfalls verstreichen lassen.',
    category: 'gericht'
  },
  {
    term: 'Vollstreckungstitel',
    aliases: ['titulierte Forderung', 'tituliert'],
    short: 'Das Papier, mit dem jemand dein Geld pfänden lassen darf.',
    long: 'Ein Titel entsteht durch Urteil, Vollstreckungsbescheid oder notarielle Urkunde und ist dreißig Jahre lang durchsetzbar - die normale Verjährung greift dann nicht mehr. Das heißt für dich: Unterschreib niemals ein Schuldanerkenntnis beim Notar oder einen Vergleich, ohne die Summe geprüft zu haben, damit machst du dich für Jahrzehnte angreifbar.',
    category: 'gericht'
  },
  {
    term: 'Zwangsvollstreckung',
    short: 'Die zwangsweise Durchsetzung einer Forderung durch Pfändung.',
    long: 'Mit einem Vollstreckungstitel darf der Gläubiger Konto, Lohn oder Sachen pfänden lassen. Dir bleibt dabei immer ein geschützter Betrag zum Leben. Das heißt für dich: Sobald ein Titel existiert, richte ein Pfändungsschutzkonto ein, bevor das Konto gesperrt wird.',
    category: 'gericht'
  },
  {
    term: 'Pfändung',
    aliases: ['gepfändet', 'Pfändungsbeschluss'],
    short: 'Zugriff auf dein Geld oder deine Sachen zugunsten eines Gläubigers.',
    long: 'Gepfändet werden können Konto, Lohn, Steuererstattung oder wertvolle Gegenstände - Dinge des täglichen Bedarfs und Arbeitsmittel bleiben geschützt. Die Pfändung wird dir zugestellt. Das heißt für dich: Prüfe sofort, ob die Pfändungsfreigrenze beachtet wurde, und widersprich der Höhe, wenn dir zu wenig bleibt.',
    category: 'gericht'
  },
  {
    term: 'Lohnpfändung',
    aliases: ['Gehaltspfändung'],
    short: 'Dein Arbeitgeber überweist einen Teil des Lohns direkt an den Gläubiger.',
    long: 'Bei einer Lohnpfändung behält der Arbeitgeber den pfändbaren Teil ein und leitet ihn weiter - den unpfändbaren Teil bekommst du weiter ausgezahlt. Wie viel geschützt ist, hängt von deinen Unterhaltspflichten ab. Das heißt für dich: Melde deinem Arbeitgeber unbedingt, für wie viele Personen du sorgst, sonst wird zu viel abgezogen.',
    category: 'gericht'
  },
  {
    term: 'Kontopfändung',
    short: 'Dein Konto wird gesperrt, der Gläubiger holt sich das Guthaben.',
    long: 'Nach Zustellung an die Bank ist das Guthaben zunächst blockiert; ohne Schutzkonto kommst du auch an Lohn oder Sozialleistungen nicht heran. Miete und Strom laufen währenddessen weiter. Das heißt für dich: Sofort bei deiner Bank die Umwandlung in ein Pfändungsschutzkonto verlangen, das geht rückwirkend innerhalb eines Monats.',
    category: 'gericht'
  },
  {
    term: 'Pfändungsfreigrenze',
    aliases: ['Pfändungsfreibetrag', 'unpfändbarer Betrag', 'Pfändungstabelle'],
    short: 'Der Betrag, der dir monatlich auf jeden Fall bleiben muss.',
    long: 'Ein Grundbetrag von gut fünfzehnhundert Euro im Monat ist unpfändbar, mehr, wenn du Unterhalt zahlst; die Beträge werden jedes Jahr zum 1. Juli angepasst. Alles darüber wird nur teilweise gepfändet. Das heißt für dich: Weise Unterhaltspflichten nach, jedes unterhaltsberechtigte Kind erhöht deinen geschützten Betrag deutlich.',
    category: 'gericht'
  },
  {
    term: 'Pfändungsschutzkonto',
    aliases: ['P-Konto'],
    short: 'Girokonto, auf dem dein Existenzminimum automatisch geschützt ist.',
    long: 'Jede Bank muss dein bestehendes Konto auf Verlangen kostenlos in ein P-Konto umwandeln; der Grundfreibetrag bleibt dann trotz Pfändung verfügbar. Für Kinder und bestimmte Leistungen gibt es mit Bescheinigung mehr. Das heißt für dich: Umwandlung schriftlich verlangen und dir eine Bescheinigung besorgen, sobald jemand von dir Unterhalt bezieht.',
    category: 'gericht'
  },
  {
    term: 'Gerichtsvollzieher',
    aliases: ['Gerichtsvollzieherin', 'Gerichtsvollzieherbüro'],
    short: 'Amtsperson, die Forderungen vor Ort eintreibt.',
    long: 'Der Gerichtsvollzieher kündigt sich meist schriftlich an, kann Zahlungen entgegennehmen, Raten vereinbaren und die Vermögensauskunft abnehmen. Deine Wohnung darf er nur mit deiner Erlaubnis oder einem richterlichen Beschluss betreten. Das heißt für dich: Nimm Kontakt auf, statt die Tür zu ignorieren - eine Ratenvereinbarung ist hier oft direkt möglich.',
    category: 'gericht'
  },
  {
    term: 'Vermögensauskunft',
    aliases: ['eidesstattliche Versicherung', 'Offenbarungseid', 'Vermögensverzeichnis'],
    short: 'Du musst unter Eid offenlegen, was du besitzt und verdienst.',
    long: 'Auf Antrag eines Gläubigers lädt dich der Gerichtsvollzieher zur Vermögensauskunft; falsche Angaben sind strafbar, das Nichterscheinen kann zum Haftbefehl führen. Die Auskunft wandert ins Schuldnerverzeichnis. Das heißt für dich: Termin unbedingt wahrnehmen - vollständige Zahlung oder eine Ratenvereinbarung vorher kann den Eintrag noch verhindern.',
    category: 'gericht'
  },
  {
    term: 'Schuldnerverzeichnis',
    short: 'Öffentliches Register über Menschen, die nicht zahlen konnten.',
    long: 'Nach einer Vermögensauskunft wirst du dort für drei Jahre eingetragen; Vermieter, Banken und Leasinggeber können das abfragen. Der Eintrag wird vorzeitig gelöscht, wenn du die Forderung begleichst und das nachweist. Das heißt für dich: Nach der Zahlung selbst die Löschung beantragen, automatisch passiert das nicht.',
    category: 'gericht'
  },
  {
    term: 'Prozesskostenhilfe',
    aliases: ['PKH'],
    short: 'Der Staat übernimmt die Kosten deines Gerichtsverfahrens.',
    long: 'Wer sich ein Verfahren nicht leisten kann und Aussicht auf Erfolg hat, bekommt Gerichts- und Anwaltskosten ganz oder gegen kleine Raten erstattet. Beantragt wird sie mit einem Formular über dein Einkommen beim Gericht. Das heißt für dich: Antrag zusammen mit der Klage stellen und Belege beilegen - Geldmangel ist kein Grund, auf dein Recht zu verzichten.',
    category: 'gericht'
  },
  {
    term: 'Beratungshilfe',
    aliases: ['Beratungshilfeschein'],
    short: 'Anwaltliche Beratung für einen kleinen Eigenanteil.',
    long: 'Beim Amtsgericht deines Wohnorts bekommst du einen Berechtigungsschein, mit dem dich ein Anwalt außergerichtlich berät und vertritt - du zahlst nur einen geringen Eigenanteil. Für Sozialleistungen gibt es die Beratung oft auch kostenlos bei Verbänden. Das heißt für dich: Schein vor dem Anwaltsbesuch holen und Bescheid sowie Einkommensnachweise mitbringen.',
    category: 'gericht'
  },
  {
    term: 'Versäumnisurteil',
    short: 'Urteil gegen dich, weil du zum Termin nicht erschienen bist.',
    long: 'Wer im Gerichtstermin fehlt, verliert automatisch - der Inhalt wird nicht geprüft. Dagegen hilft der Einspruch innerhalb von zwei Wochen ab Zustellung. Das heißt für dich: Termine immer wahrnehmen oder rechtzeitig verlegen lassen; kommt das Urteil doch, sofort Einspruch einlegen.',
    category: 'gericht'
  },
  {
    term: 'Kostenfestsetzungsbeschluss',
    short: 'Beschluss darüber, wer wem die Verfahrenskosten erstatten muss.',
    long: 'Nach einem Urteil wird in einem eigenen Beschluss ausgerechnet, welche Anwalts- und Gerichtskosten die unterlegene Seite zahlt - er ist selbst ein Vollstreckungstitel. Gegen die Höhe kannst du befristet Erinnerung einlegen. Das heißt für dich: Rechne die Positionen nach, hier schleichen sich regelmäßig zu hohe Ansätze ein.',
    category: 'gericht'
  },
  {
    term: 'Streitwert',
    aliases: ['Gegenstandswert'],
    short: 'Der Wert des Streits - danach richten sich alle Kosten.',
    long: 'Je höher der Streitwert, desto teurer werden Gericht und Anwälte. Er wird vom Gericht festgesetzt und kann angegriffen werden. Das heißt für dich: Frag vor einer Klage nach dem voraussichtlichen Kostenrisiko, es hängt fast vollständig an dieser einen Zahl.',
    category: 'gericht'
  },
  {
    term: 'Klagefrist',
    short: 'Zeitfenster, in dem du gegen eine Entscheidung klagen kannst.',
    long: 'Nach einem Widerspruchsbescheid hast du in der Regel einen Monat Zeit zu klagen; im Arbeitsrecht sind es drei Wochen ab Zugang der Kündigung. Läuft die Frist ab, wird die Entscheidung endgültig. Das heißt für dich: Das genaue Datum steht in der Rechtsbehelfsbelehrung - trag es sofort ein und plane die Beratung davor.',
    category: 'gericht'
  },

  // --- Vertrag ---
  {
    term: 'Allgemeine Geschäftsbedingungen',
    aliases: ['AGB', 'Kleingedrucktes', 'Vertragsbedingungen'],
    short: 'Das Kleingedruckte, das der Anbieter für alle Kunden vorformuliert hat.',
    long: 'AGB gelten nur, wenn sie dir vor Vertragsschluss zugänglich waren; überraschende oder stark benachteiligende Klauseln sind unwirksam, auch wenn du unterschrieben hast. Der Rest des Vertrags bleibt dann bestehen. Das heißt für dich: Eine unfaire Klausel im Kleingedruckten musst du nicht hinnehmen, nur weil sie dort steht.',
    category: 'vertrag'
  },
  {
    term: 'Widerrufsrecht',
    short: 'Recht, einen Vertrag ohne Grund innerhalb von 14 Tagen rückgängig zu machen.',
    long: 'Bei Verträgen im Internet, am Telefon oder an der Haustür kannst du binnen vierzehn Tagen widerrufen - ohne Begründung. Fehlt die Widerrufsbelehrung oder ist sie falsch, verlängert sich die Frist auf bis zu ein Jahr und vierzehn Tage. Das heißt für dich: Widerruf schriftlich und nachweisbar schicken, ein Anruf reicht nicht.',
    category: 'vertrag'
  },
  {
    term: 'Widerrufsbelehrung',
    short: 'Der Text, der dich über dein Widerrufsrecht informieren muss.',
    long: 'Sie muss klar sagen, ab wann die Frist läuft, wie du widerrufst und an wen. Ist sie fehlerhaft oder versteckt, startet die Frist gar nicht richtig. Das heißt für dich: Selbst nach Monaten kann ein Widerruf noch möglich sein, wenn die Belehrung fehlerhaft war - Vertragsunterlagen deshalb aufheben.',
    category: 'vertrag'
  },
  {
    term: 'Kündigungsfrist',
    short: 'Die Zeit zwischen deiner Kündigung und dem Vertragsende.',
    long: 'Die Kündigungsfrist sagt, wie lange der Vertrag nach deiner Kündigung noch läuft - entscheidend ist der Zugang beim Vertragspartner, nicht dein Absendedatum. Bei laufenden Verbraucherverträgen ist nach der Mindestlaufzeit meist ein Monat üblich. Das heißt für dich: Kündige früh, nachweisbar und behalte einen Sendebeleg.',
    category: 'vertrag'
  },
  {
    term: 'Mindestlaufzeit',
    aliases: ['Vertragslaufzeit', 'Erstlaufzeit'],
    short: 'Die Zeit, in der du gar nicht ordentlich kündigen kannst.',
    long: 'Bis zum Ende der Mindestlaufzeit bist du gebunden - bei Verbraucherverträgen sind höchstens zwei Jahre erlaubt. Danach greift nur noch die normale Kündigungsfrist. Das heißt für dich: Notiere Vertragsbeginn plus Laufzeit im Kalender, sonst verpasst du den einzigen einfachen Ausstiegszeitpunkt.',
    category: 'vertrag'
  },
  {
    term: 'automatische Verlängerung',
    aliases: [
      'Verlängerungsklausel',
      'stillschweigende Verlängerung',
      'verlängert sich automatisch'
    ],
    short: 'Der Vertrag läuft weiter, wenn du nicht rechtzeitig kündigst.',
    long: 'Nach der Mindestlaufzeit verlängern sich viele Verträge von allein. Bei Verbraucherverträgen darf das nur noch auf unbestimmte Zeit mit einer Kündigungsfrist von höchstens einem Monat geschehen - ältere Klauseln mit einem Jahr Verlängerung sind oft unwirksam. Das heißt für dich: Verlangt der Anbieter ein weiteres Jahr, lohnt der Widerspruch fast immer.',
    category: 'vertrag'
  },
  {
    term: 'Sonderkündigungsrecht',
    short: 'Vorzeitiger Ausstieg aus dem Vertrag bei bestimmten Anlässen.',
    long: 'Ein Sonderkündigungsrecht besteht zum Beispiel bei Preiserhöhungen, bei Umzug ohne Versorgungsmöglichkeit oder bei geänderten Vertragsbedingungen - meist nur wenige Wochen lang ab der Mitteilung. Das heißt für dich: Sobald ein Brief über Änderungen kommt, sofort prüfen, ob darin ein Ausstieg steckt, und die kurze Frist nutzen.',
    category: 'vertrag'
  },
  {
    term: 'Gerichtsstand',
    short: 'Der Ort, an dem im Streitfall verhandelt wird.',
    long: 'Die Klausel legt fest, welches Gericht zuständig ist. Gegenüber Verbrauchern ist sie meist unwirksam - du wirst in der Regel an deinem Wohnort verklagt und kannst dort auch selbst klagen. Das heißt für dich: Lass dich von einer Gerichtsstandsklausel in fernen Städten nicht abschrecken.',
    category: 'vertrag'
  },
  {
    term: 'salvatorische Klausel',
    short: 'Ist eine Regel unwirksam, bleibt der Rest des Vertrags gültig.',
    long: 'Die Klausel sorgt dafür, dass ein einzelner unwirksamer Punkt nicht den ganzen Vertrag kippt - die Lücke wird durch das Gesetz gefüllt. Sie steht meist am Ende. Das heißt für dich: Eine unwirksame Klausel nützt dir trotzdem, du musst nur genau diesen Punkt nicht befolgen.',
    category: 'vertrag'
  },
  {
    term: 'Schriftform',
    short: 'Nur ein unterschriebenes Papier gilt - keine E-Mail.',
    long: 'Verlangt ein Vertrag oder das Gesetz Schriftform, brauchst du ein Dokument mit eigenhändiger Unterschrift; Kündigungen von Wohnungen und Arbeitsverhältnissen fallen darunter. Eine E-Mail oder ein Fax genügt dann nicht. Das heißt für dich: Ausdrucken, unterschreiben, per Einwurf-Einschreiben senden und den Beleg aufbewahren.',
    category: 'vertrag'
  },
  {
    term: 'Textform',
    short: 'E-Mail reicht - eine Unterschrift ist nicht nötig.',
    long: 'Textform bedeutet lesbare Erklärung auf einem dauerhaften Träger, also E-Mail, Brief ohne Unterschrift oder Nachricht im Kundenportal. Für die meisten Verbraucherverträge genügt das inzwischen. Das heißt für dich: Speichere Versandbestätigung und Text ab, du musst den Zugang im Streitfall beweisen.',
    category: 'vertrag'
  },
  {
    term: 'Abtretung',
    aliases: ['abgetreten', 'Forderungsabtretung', 'Zession'],
    short: 'Eine Forderung wird an jemand anderen weiterverkauft.',
    long: 'Durch Abtretung wechselt der Gläubiger - meistens landet die Forderung bei einem Inkassounternehmen, das dann von dir Zahlung verlangt. Deine Einwendungen gegen die ursprüngliche Forderung bleiben dir erhalten. Das heißt für dich: Verlange den Nachweis der Abtretung, bevor du an einen neuen Gläubiger zahlst.',
    category: 'vertrag'
  },
  {
    term: 'Bürgschaft',
    aliases: ['Bürge', 'gebürgt'],
    short: 'Du haftest mit deinem Geld für die Schulden eines anderen.',
    long: 'Zahlt der Hauptschuldner nicht, wird der Bürge in voller Höhe herangezogen - oft ohne dass zuvor beim Schuldner vollstreckt werden muss. Bürgschaften brauchen Schriftform. Das heißt für dich: Unterschreib nur, wenn du die gesamte Summe notfalls selbst zahlen könntest, und niemals unter familiärem Druck.',
    category: 'vertrag'
  },
  {
    term: 'SCHUFA-Klausel',
    aliases: ['Schufa-Einwilligung', 'Datenübermittlung an die SCHUFA'],
    short: 'Deine Zustimmung, dass Vertragsdaten an eine Auskunftei gehen.',
    long: 'Mit dieser Klausel darf der Anbieter Zahlungsstörungen melden, was deine Kreditwürdigkeit für Jahre verschlechtert. Gemeldet werden dürfen offene Forderungen nur unter engen Bedingungen, etwa nach zwei erfolglosen Mahnungen. Das heißt für dich: Widersprich einer unberechtigten Meldung schriftlich und verlange die Löschung bei der Auskunftei.',
    category: 'vertrag'
  },
  {
    term: 'Vertragsstrafe',
    aliases: ['Konventionalstrafe'],
    short: 'Vorher festgelegte Zahlung, falls du eine Pflicht verletzt.',
    long: 'Die Vertragsstrafe wird fällig, ohne dass ein Schaden nachgewiesen werden muss - in vorformulierten Verträgen ist sie oft unwirksam, wenn sie unangemessen hoch ist. Das heißt für dich: Bevor du zahlst, prüfen lassen, ob die Klausel überhaupt wirksam ist; bei Verbraucherverträgen scheitern viele daran.',
    category: 'vertrag'
  },
  {
    term: 'Haftungsausschluss',
    aliases: ['Haftungsbeschränkung', 'keine Haftung'],
    short: 'Der Anbieter will für Schäden nicht geradestehen.',
    long: 'Für Vorsatz, grobe Fahrlässigkeit sowie Schäden an Leben, Körper und Gesundheit kann die Haftung nie ausgeschlossen werden - solche Klauseln sind in diesem Umfang unwirksam. Das heißt für dich: Lass dich von einem pauschalen Haftungsausschluss nicht abhalten, Schadenersatz zu verlangen.',
    category: 'vertrag'
  },
  {
    term: 'Gewährleistung',
    aliases: ['Mängelhaftung', 'Sachmängelhaftung'],
    short: 'Gesetzliches Recht auf Reparatur oder Ersatz bei einem Mangel.',
    long: 'Bei neuen Sachen gilt sie zwei Jahre ab Übergabe, und im ersten Jahr wird vermutet, dass der Mangel von Anfang an da war - der Verkäufer muss dann das Gegenteil beweisen. Sie kommt vom Gesetz, nicht vom Händler. Das heißt für dich: Wende dich mit Mängeln an den Verkäufer, nicht an den Hersteller, und setze schriftlich eine Frist zur Nachbesserung.',
    category: 'vertrag'
  },
  {
    term: 'Garantie',
    short: 'Freiwilliges Zusatzversprechen des Herstellers oder Händlers.',
    long: 'Eine Garantie kommt zusätzlich zur gesetzlichen Gewährleistung und gilt nur zu den Bedingungen, die in der Garantieerklärung stehen. Sie ersetzt deine gesetzlichen Rechte nicht. Das heißt für dich: Läuft die Garantie ab oder greift sie nicht, kannst du dich immer noch auf die Gewährleistung berufen.',
    category: 'vertrag'
  },
  {
    term: 'Rücktritt',
    aliases: ['zurücktreten', 'Rücktritt vom Vertrag'],
    short: 'Der Vertrag wird rückabgewickelt - Ware zurück, Geld zurück.',
    long: 'Ein Rücktritt setzt meist voraus, dass du zuvor erfolglos eine Frist zur Nacherfüllung gesetzt hast. Danach werden beide Leistungen zurückgegeben. Das heißt für dich: Erst schriftlich eine konkrete Frist setzen, sonst ist dein Rücktritt unwirksam.',
    category: 'vertrag'
  },
  {
    term: 'Anfechtung',
    aliases: ['anfechten', 'angefochten'],
    short: 'Ein Vertrag wird nachträglich für nichtig erklärt.',
    long: 'Wer arglistig getäuscht oder bedroht wurde, kann anfechten - dann gilt der Vertrag als nie geschlossen. Bei Täuschung hast du dafür ein Jahr ab Entdeckung Zeit. Das heißt für dich: Sammle Beweise für die Falschangabe und erkläre die Anfechtung schriftlich und eindeutig.',
    category: 'vertrag'
  },
  {
    term: 'Verjährung',
    aliases: ['verjährt', 'Verjährungsfrist'],
    short: 'Nach Ablauf der Frist muss die Forderung nicht mehr gezahlt werden.',
    long: 'Die meisten Forderungen verjähren in drei Jahren, gerechnet ab dem Ende des Jahres, in dem sie entstanden sind. Verjährung wirkt aber nur, wenn du dich ausdrücklich darauf berufst - titulierte Forderungen halten dreißig Jahre. Das heißt für dich: Bei alten Rechnungen schriftlich die Einrede der Verjährung erheben, statt einfach nicht zu reagieren.',
    category: 'vertrag'
  },
  {
    term: 'Vollmacht',
    short: 'Erlaubnis für jemand anderen, in deinem Namen zu handeln.',
    long: 'Mit einer Vollmacht darf eine andere Person Verträge schließen, Anträge stellen oder Auskünfte einholen - im Umfang, den du festlegst. Behörden und Banken verlangen sie schriftlich. Das heißt für dich: Begrenze die Vollmacht auf den konkreten Vorgang und widerrufe sie schriftlich, wenn sie nicht mehr gebraucht wird.',
    category: 'vertrag'
  },

  // --- Geld / Schulden ---
  {
    term: 'Mahnung',
    aliases: ['Zahlungserinnerung', 'letzte Mahnung'],
    short: 'Aufforderung zu zahlen, nachdem die Rechnung fällig war.',
    long: 'Eine Mahnung ist ein einfacher Brief des Gläubigers, kein Gerichtsschreiben - sie setzt dich in Verzug und löst damit Zinsen und Kosten aus. Drei Mahnungen sind nicht vorgeschrieben, eine reicht. Das heißt für dich: Verwechsle sie nicht mit dem Mahnbescheid, aber ignoriere sie auch nicht - der nächste Schritt ist teurer.',
    category: 'geld'
  },
  {
    term: 'Verzug',
    aliases: ['in Verzug', 'Zahlungsverzug'],
    short: 'Du zahlst zu spät - ab jetzt kostet es extra.',
    long: 'Verzug tritt durch eine Mahnung ein oder automatisch dreißig Tage nach Zugang einer Rechnung, wenn darauf hingewiesen wurde. Ab diesem Zeitpunkt darf der Gläubiger Zinsen und Kosten verlangen. Das heißt für dich: Kannst du nicht zahlen, melde dich vorher und schlage Raten vor - das verhindert Verzug in der Regel nicht, aber meist die Eskalation.',
    category: 'geld'
  },
  {
    term: 'Verzugszinsen',
    short: 'Zinsen auf die offene Summe für die Zeit ab dem Verzug.',
    long: 'Gegenüber Verbrauchern liegen sie fünf Prozentpunkte über dem Basiszinssatz, unter Unternehmen neun. Sie werden nur auf die Hauptforderung berechnet, nicht auf Mahnkosten. Das heißt für dich: Prüfe in der Forderungsaufstellung, ab welchem Datum und auf welchen Betrag Zinsen berechnet wurden - hier wird oft zu viel angesetzt.',
    category: 'geld'
  },
  {
    term: 'Mahnkosten',
    short: 'Pauschale, die der Gläubiger für eine Mahnung berechnet.',
    long: 'Ersetzt werden nur die tatsächlichen Kosten der Mahnung, also im Wesentlichen Porto und Material - Pauschalen von mehreren Euro pro Brief sind meist überhöht. Für die erste Mahnung dürfen in der Regel gar keine Kosten berechnet werden. Das heißt für dich: Zahle die Hauptforderung und widersprich überhöhten Mahnkosten schriftlich.',
    category: 'geld'
  },
  {
    term: 'Inkasso',
    aliases: ['Inkassounternehmen', 'Inkassobüro', 'Forderungsmanagement'],
    short: 'Firma, die im Auftrag eines Gläubigers Geld eintreibt.',
    long: 'Ein Inkassobüro ist keine Behörde und kann nichts pfänden - dafür bräuchte es einen Vollstreckungstitel. Es darf mahnen, telefonieren und die Forderung an ein Gericht weitergeben. Das heißt für dich: Bleib ruhig, verlange die Unterlagen zur Forderung und zahle nichts, was du nicht nachvollziehen kannst.',
    category: 'geld'
  },
  {
    term: 'Inkassokosten',
    short: 'Die Gebühren des Inkassobüros, die du zusätzlich zahlen sollst.',
    long: 'Erstattungsfähig sind sie nur, wenn die Hauptforderung berechtigt ist und du bereits in Verzug warst - und höchstens in der Höhe, die auch ein Anwalt hätte verlangen dürfen. Bei kleinen Forderungen gelten strenge Obergrenzen. Das heißt für dich: Hauptforderung unter Vorbehalt zahlen und die überhöhten Nebenkosten getrennt bestreiten.',
    category: 'geld'
  },
  {
    term: 'Hauptforderung',
    short: 'Der eigentliche Rechnungsbetrag, ohne Zinsen und Gebühren.',
    long: 'Die Hauptforderung ist das, was du ursprünglich schuldest - alles andere sind Nebenforderungen. Zahlungen werden ohne deine Anweisung zuerst auf Kosten und Zinsen verrechnet. Das heißt für dich: Schreib bei der Überweisung ausdrücklich dazu, dass sie auf die Hauptforderung gehen soll, sonst wächst der Rest weiter.',
    category: 'geld'
  },
  {
    term: 'Nebenforderung',
    aliases: ['Nebenforderungen'],
    short: 'Zinsen, Mahn- und Inkassokosten zusätzlich zur eigentlichen Schuld.',
    long: 'Nebenforderungen entstehen erst durch Verzug und sind oft der Teil, der eine kleine Rechnung stark aufbläht. Sie sind angreifbar, ohne dass du die Hauptsache bestreiten musst. Das heißt für dich: Sortiere die Aufstellung in Hauptforderung und Rest - beim Rest lohnt der Einwand am häufigsten.',
    category: 'geld'
  },
  {
    term: 'Forderungsaufstellung',
    aliases: ['Forderungskonto', 'Saldenaufstellung'],
    short: 'Liste, aus der sich die geforderte Gesamtsumme zusammensetzt.',
    long: 'Sie zeigt Hauptforderung, Zinsen, Kosten und bereits geleistete Zahlungen mit Datum. Ohne sie lässt sich eine Forderung nicht prüfen, und du hast Anspruch darauf. Das heißt für dich: Fordere sie schriftlich an und vergleiche jede Position mit deinen Kontoauszügen.',
    category: 'geld'
  },
  {
    term: 'effektiver Jahreszins',
    aliases: ['Effektivzins', 'effektiver Zins'],
    short: 'Der ehrliche Preis eines Kredits pro Jahr, inklusive aller Kosten.',
    long: 'Im Effektivzins stecken Zinsen und die meisten Nebenkosten - nur er macht Angebote vergleichbar, der reine Sollzins nicht. Nicht enthalten sind freiwillige Zusatzprodukte wie eine Restschuldversicherung. Das heißt für dich: Vergleiche Kredite ausschließlich über diese Zahl und lass dir die Gesamtsumme aller Raten nennen.',
    category: 'geld'
  },
  {
    term: 'Sollzins',
    aliases: ['Sollzinssatz', 'Nominalzins'],
    short: 'Der reine Zins auf die Kreditsumme, ohne Nebenkosten.',
    long: 'Der Sollzins wirkt niedriger als der effektive Jahreszins, weil Gebühren fehlen - er sagt allein wenig über den echten Preis. Er kann fest oder veränderlich vereinbart sein. Das heißt für dich: Achte darauf, ob der Zins für die gesamte Laufzeit festgeschrieben ist, sonst steigt deine Rate später womöglich.',
    category: 'geld'
  },
  {
    term: 'Vorfälligkeitsentschädigung',
    aliases: ['Vorfälligkeitsentgelt', 'Vorfälligkeit'],
    short: 'Ausgleich an die Bank, wenn du einen Kredit vorzeitig ablöst.',
    long: 'Löst du einen Immobilienkredit vor Ende der Zinsbindung ab, verlangt die Bank Ersatz für die entgangenen Zinsen - das können mehrere tausend Euro sein. Nach zehn Jahren Zinsbindung darfst du mit sechs Monaten Frist kündigen, dann entfällt sie. Das heißt für dich: Berechnung immer nachprüfen lassen, Fehler darin sind häufig und teuer.',
    category: 'geld'
  },
  {
    term: 'Restschuldversicherung',
    aliases: ['RSV', 'Ratenschutzversicherung', 'Kreditausfallversicherung'],
    short: 'Zusatzversicherung zum Kredit, die die Raten teuer macht.',
    long: 'Sie soll bei Arbeitslosigkeit, Krankheit oder Tod die Raten übernehmen, hat aber viele Ausschlüsse und kostet oft einen erheblichen Teil der Kreditsumme. Sie ist freiwillig und darf nicht Bedingung für den Kredit sein. Das heißt für dich: Sie ist getrennt widerrufbar - prüfe Police und Kosten, oft lohnt sich der Widerruf.',
    category: 'geld'
  },
  {
    term: 'Ratenzahlungsvereinbarung',
    aliases: ['Ratenzahlung', 'Ratenplan', 'Stundungsvereinbarung'],
    short: 'Schriftliche Abmachung, die Schuld in Teilbeträgen zu zahlen.',
    long: 'Mit einer Ratenvereinbarung verzichtet der Gläubiger vorerst auf Vollstreckung, solange du die Raten hältst. Achtung: Viele Vereinbarungen enthalten ein Schuldanerkenntnis, das die Verjährung neu starten lässt. Das heißt für dich: Rate realistisch wählen und vor der Unterschrift prüfen, ob die Forderung überhaupt berechtigt ist.',
    category: 'geld'
  },
  {
    term: 'Schuldanerkenntnis',
    aliases: ['Anerkenntnis', 'Schuldbeitritt'],
    short: 'Deine Unterschrift darauf, dass die Forderung stimmt.',
    long: 'Mit einem Anerkenntnis gibst du fast alle Einwendungen auf, und die Verjährung beginnt von vorn. Eine notarielle Variante ist sogar sofort vollstreckbar. Das heißt für dich: Unterschreib so etwas nie, um Ruhe zu haben - prüfe die Forderung erst oder lass dich beraten.',
    category: 'geld'
  },
  {
    term: 'Lastschriftmandat',
    aliases: ['SEPA-Lastschriftmandat', 'Einzugsermächtigung'],
    short: 'Erlaubnis, Geld von deinem Konto abzubuchen.',
    long: 'Mit dem Mandat darf ein Anbieter selbst abbuchen. Eine unberechtigte Lastschrift kannst du acht Wochen lang ohne Begründung zurückholen lassen, bei fehlendem Mandat sogar dreizehn Monate. Das heißt für dich: Kontoauszüge kontrollieren und widerrufene Mandate auch dem Anbieter schriftlich mitteilen.',
    category: 'geld'
  },
  {
    term: 'Rücklastschrift',
    aliases: ['Rückbuchung', 'Lastschrift geplatzt'],
    short: 'Eine Abbuchung ging zurück - meist wegen fehlender Deckung.',
    long: 'Die Bank berechnet dafür Gebühren, und der Anbieter fordert seine Kosten zusätzlich ein. Erstattungsfähig sind aber nur die tatsächlich entstandenen Bankkosten, keine hohen Pauschalen. Das heißt für dich: Zahle den Rechnungsbetrag zügig nach und widersprich unangemessenen Rücklastschriftpauschalen.',
    category: 'geld'
  },
  {
    term: 'Verbraucherinsolvenz',
    aliases: ['Privatinsolvenz', 'Verbraucherinsolvenzverfahren'],
    short: 'Geordnetes Verfahren, um Schulden endgültig loszuwerden.',
    long: 'Nach einem gescheiterten außergerichtlichen Einigungsversuch wird das Verfahren beim Amtsgericht eröffnet; pfändbares Einkommen geht an einen Treuhänder, alles Unpfändbare bleibt dir. Es endet in der Regel nach drei Jahren mit der Restschuldbefreiung. Das heißt für dich: Der Weg führt über eine anerkannte Schuldnerberatung, die dort ist meist kostenlos.',
    category: 'geld'
  },
  {
    term: 'Restschuldbefreiung',
    short: 'Am Ende der Insolvenz sind die restlichen Schulden weg.',
    long: 'Nach drei Jahren korrekter Mitwirkung erlässt das Gericht die verbliebenen Schulden - ausgenommen bleiben unter anderem Geldstrafen und Forderungen aus vorsätzlich begangenen Taten. Danach kannst du neu anfangen. Das heißt für dich: Halte während des Verfahrens alle Auskunfts- und Arbeitspflichten ein, sonst fällt die Befreiung weg.',
    category: 'geld'
  },

  // --- Arbeit ---
  {
    term: 'Abmahnung',
    short: 'Schriftliche Rüge des Arbeitgebers mit Warnung vor der Kündigung.',
    long: 'Eine Abmahnung benennt ein konkretes Fehlverhalten und droht für den Wiederholungsfall Konsequenzen an - sie ist meist die Vorstufe einer verhaltensbedingten Kündigung. Es gibt keine Frist, um zu reagieren. Das heißt für dich: Unterschreib höchstens den Erhalt, nie die Richtigkeit, und leg eine schriftliche Gegendarstellung für deine Personalakte nach.',
    category: 'arbeit'
  },
  {
    term: 'Aufhebungsvertrag',
    aliases: ['Auflösungsvertrag'],
    short: 'Einvernehmliche Beendigung des Arbeitsverhältnisses per Unterschrift.',
    long: 'Beim Aufhebungsvertrag endet der Job zum vereinbarten Datum, ohne Kündigungsfrist und ohne Kündigungsschutz - dafür droht bei der Agentur für Arbeit fast immer eine Sperrzeit. Es gibt kein Widerrufsrecht. Das heißt für dich: Nie sofort unterschreiben, sondern Bedenkzeit verlangen und vorher Beratung einholen.',
    category: 'arbeit'
  },
  {
    term: 'Abfindung',
    short: 'Einmalzahlung als Ausgleich für den Verlust des Arbeitsplatzes.',
    long: 'Ein gesetzlicher Anspruch besteht nur selten - meist wird die Abfindung im Vergleich vor dem Arbeitsgericht ausgehandelt, häufig ein halbes Monatsgehalt pro Beschäftigungsjahr. Sie ist voll steuerpflichtig, aber beitragsfrei in der Sozialversicherung. Das heißt für dich: Die Kündigungsschutzklage ist in der Praxis der Hebel, mit dem Abfindungen überhaupt entstehen.',
    category: 'arbeit'
  },
  {
    term: 'Freistellung',
    aliases: ['freigestellt', 'unwiderrufliche Freistellung'],
    short: 'Du musst nicht mehr arbeiten, bekommst aber bis zum Ende Geld.',
    long: 'Bei einer Freistellung läuft das Arbeitsverhältnis weiter, du bleibst versichert und bekommst Lohn. Bei unwiderruflicher Freistellung wird meist der Resturlaub darauf angerechnet. Das heißt für dich: Lass schriftlich festhalten, ob Urlaub und Überstunden damit abgegolten sind, sonst streitest du später darüber.',
    category: 'arbeit'
  },
  {
    term: 'ordentliche Kündigung',
    aliases: ['fristgerechte Kündigung'],
    short: 'Kündigung unter Einhaltung der gesetzlichen oder vertraglichen Frist.',
    long: 'Die gesetzliche Grundfrist beträgt vier Wochen zum 15. oder zum Monatsende und verlängert sich für den Arbeitgeber mit der Dauer der Beschäftigung. In Betrieben mit mehr als zehn Beschäftigten braucht er zusätzlich einen anerkannten Grund. Das heißt für dich: Prüfe Frist und Zugangsdatum - eine zu kurze Frist macht die Kündigung nicht unwirksam, verschiebt aber das Enddatum.',
    category: 'arbeit'
  },
  {
    term: 'außerordentliche Kündigung',
    aliases: ['fristlose Kündigung', 'fristlos gekündigt'],
    short: 'Sofortige Beendigung ohne Frist wegen eines schweren Vorfalls.',
    long: 'Sie setzt einen wichtigen Grund voraus und muss innerhalb von zwei Wochen ausgesprochen werden, nachdem der Arbeitgeber davon erfahren hat. Häufig scheitert sie daran, dass eine Abmahnung gefehlt hat. Das heißt für dich: Auch hier gilt die Drei-Wochen-Frist für die Kündigungsschutzklage - sie läuft ab Zugang, nicht ab dem Vorfall.',
    category: 'arbeit'
  },
  {
    term: 'Änderungskündigung',
    short: 'Kündigung verbunden mit dem Angebot, zu schlechteren Bedingungen weiterzuarbeiten.',
    long: 'Der Arbeitgeber kündigt und bietet gleichzeitig einen geänderten Vertrag an, etwa mit weniger Lohn oder anderem Einsatzort. Du kannst annehmen, ablehnen oder unter Vorbehalt annehmen und die Änderung gerichtlich prüfen lassen. Das heißt für dich: Die Annahme unter Vorbehalt musst du innerhalb von drei Wochen erklären - das ist meist die sicherste Variante.',
    category: 'arbeit'
  },
  {
    term: 'Kündigungsschutzklage',
    short: 'Klage gegen eine Kündigung - nur drei Wochen ab Zugang möglich.',
    long: 'Mit der Klage lässt du prüfen, ob die Kündigung wirksam war; sie muss innerhalb von drei Wochen nach Zugang der Kündigung beim Arbeitsgericht eingehen, sonst gilt die Kündigung selbst bei groben Fehlern als wirksam. In der ersten Instanz trägt jede Seite ihre Anwaltskosten selbst. Das heißt für dich: Diese drei Wochen sind die wichtigste Frist im Arbeitsrecht - Termin sofort eintragen und Beratung noch in derselben Woche suchen.',
    category: 'arbeit'
  },
  {
    term: 'Kündigungsschutz',
    aliases: ['Kündigungsschutzgesetz', 'allgemeiner Kündigungsschutz'],
    short: 'Schutz vor grundloser Kündigung in größeren Betrieben.',
    long: 'Er greift, wenn du länger als sechs Monate dabei bist und der Betrieb mehr als zehn Vollzeitkräfte hat - dann braucht die Kündigung einen personen-, verhaltens- oder betriebsbedingten Grund. Besonderen Schutz genießen Schwangere, Eltern in Elternzeit und schwerbehinderte Menschen. Das heißt für dich: Zähle die Beschäftigten nach, an dieser Schwelle entscheidet sich, wie stark deine Position ist.',
    category: 'arbeit'
  },
  {
    term: 'Probezeit',
    short: 'Anfangsphase mit kurzer Kündigungsfrist von zwei Wochen.',
    long: 'Die Probezeit darf höchstens sechs Monate dauern; in dieser Zeit können beide Seiten mit zwei Wochen Frist kündigen, ohne Grund. Der allgemeine Kündigungsschutz beginnt ohnehin erst nach sechs Monaten. Das heißt für dich: Auch eine Kündigung in der Probezeit kann angreifbar sein, etwa bei Schwangerschaft - die Drei-Wochen-Frist gilt trotzdem.',
    category: 'arbeit'
  },
  {
    term: 'Arbeitszeugnis',
    short: 'Schriftliche Beurteilung deiner Arbeit beim Ausscheiden.',
    long: 'Du hast Anspruch darauf, es muss wohlwollend formuliert sein und darf dein Fortkommen nicht behindern - gleichzeitig muss es wahr sein. Verlangen musst du es selbst. Das heißt für dich: Fordere ausdrücklich ein qualifiziertes Arbeitszeugnis, sonst bekommst du nur die knappe einfache Variante.',
    category: 'arbeit'
  },
  {
    term: 'qualifiziertes Arbeitszeugnis',
    short: 'Zeugnis mit Bewertung von Leistung und Verhalten.',
    long: 'Es beschreibt Aufgaben, bewertet Leistung und Sozialverhalten und endet mit einer Schlussformel - das ist die Variante, die Personalabteilungen erwarten. Die Bewertung steckt in der Zeugnissprache, nicht in Schulnoten. Das heißt für dich: Lass das Zeugnis prüfen; auf Korrektur einzelner Formulierungen hast du einen einklagbaren Anspruch.',
    category: 'arbeit'
  },
  {
    term: 'einfaches Arbeitszeugnis',
    short: 'Nur Angaben zu Person, Dauer und Tätigkeit - ohne Bewertung.',
    long: 'Das einfache Zeugnis listet auf, wer wann was gemacht hat, und sagt nichts über die Qualität. In der Bewerbung wirkt es wie ein Warnsignal, weil der Verdacht naheliegt, dass eine Bewertung vermieden werden sollte. Das heißt für dich: Verlange schriftlich die qualifizierte Fassung, der Anspruch darauf besteht jederzeit.',
    category: 'arbeit'
  },
  {
    term: 'Zwischenzeugnis',
    short: 'Zeugnis während des laufenden Arbeitsverhältnisses.',
    long: 'Ein Zwischenzeugnis kannst du bei triftigem Anlass verlangen, etwa bei einem Vorgesetztenwechsel, einer Umstrukturierung oder für eine Bewerbung. Es bindet den Arbeitgeber später inhaltlich weitgehend. Das heißt für dich: Hol es dir, solange die Stimmung gut ist - das Abschlusszeugnis darf danach kaum noch schlechter ausfallen.',
    category: 'arbeit'
  },
  {
    term: 'Zeugnissprache',
    aliases: ['Zeugniscode', 'Geheimcode im Zeugnis'],
    short: 'Verschlüsselte Formulierungen, hinter denen Schulnoten stecken.',
    long: 'Weil ein Zeugnis wohlwollend klingen muss, wird über feste Wendungen bewertet: "stets zu unserer vollsten Zufriedenheit" ist die Bestnote, "zu unserer Zufriedenheit" entspricht einer Drei, und Auslassungen sind ebenfalls eine Aussage. Das heißt für dich: Achte auf die kleinen Wörter wie stets, vollste und immer - sie entscheiden über die Note.',
    category: 'arbeit'
  },
  {
    term: 'Schlussformel',
    aliases: ['Dankes- und Wunschformel'],
    short: 'Der Dank am Ende des Zeugnisses - sein Fehlen ist ein Signal.',
    long: 'Üblich sind Dank für die Zusammenarbeit, Bedauern über das Ausscheiden und gute Wünsche. Einklagbar ist die Formel nicht, aber ihr Fehlen fällt Personalverantwortlichen sofort auf. Das heißt für dich: Bitte ausdrücklich darum, sie zu ergänzen - meist geschieht das ohne Streit.',
    category: 'arbeit'
  },
  {
    term: 'Wettbewerbsverbot',
    aliases: ['nachvertragliches Wettbewerbsverbot', 'Konkurrenzklausel'],
    short: 'Verbot, nach dem Job für die Konkurrenz zu arbeiten.',
    long: 'Ein Wettbewerbsverbot nach Vertragsende gilt höchstens zwei Jahre und nur, wenn dir für diese Zeit eine Karenzentschädigung von mindestens der Hälfte deiner letzten Bezüge zugesagt ist. Ohne diese Zusage ist die Klausel unverbindlich. Das heißt für dich: Prüfe im Vertrag, ob eine Entschädigung genannt ist - fehlt sie, kannst du dich in der Regel frei bewerben.',
    category: 'arbeit'
  },
  {
    term: 'Karenzentschädigung',
    short: 'Bezahlung dafür, dass du nach dem Job nicht zur Konkurrenz gehst.',
    long: 'Sie beträgt mindestens fünfzig Prozent der zuletzt bezogenen Leistungen und wird monatlich für die Dauer des Wettbewerbsverbots gezahlt; anderweitiger Verdienst wird teilweise angerechnet. Das heißt für dich: Hältst du dich an das Verbot, musst du das Geld aktiv einfordern - gezahlt wird es nicht von allein.',
    category: 'arbeit'
  },
  {
    term: 'Betriebsratsanhörung',
    aliases: ['Anhörung des Betriebsrats'],
    short: 'Vor jeder Kündigung muss der Betriebsrat gefragt werden.',
    long: 'Existiert ein Betriebsrat, ist die Kündigung ohne seine ordnungsgemäße Anhörung unwirksam - unabhängig davon, ob der Grund stichhaltig war. Der Arbeitgeber muss ihm alle Gründe mitteilen. Das heißt für dich: Frag im Kündigungsschutzverfahren gezielt danach, dieser Formfehler kippt in der Praxis viele Kündigungen.',
    category: 'arbeit'
  },
  {
    term: 'Urlaubsabgeltung',
    aliases: ['Resturlaub auszahlen', 'abgegoltener Urlaub'],
    short: 'Auszahlung von Urlaub, den du bis zum Ende nicht nehmen konntest.',
    long: 'Endet das Arbeitsverhältnis mit offenem Urlaub, muss er in Geld ausgezahlt werden. Verfallen kann Urlaub nur, wenn der Arbeitgeber dich vorher nachweislich aufgefordert hat, ihn zu nehmen. Das heißt für dich: Alte Urlaubstage sind oft noch offen - rechne sie in der Endabrechnung nach und fordere sie schriftlich ein.',
    category: 'arbeit'
  },
  {
    term: 'Arbeitsbescheinigung',
    short: 'Formular des Arbeitgebers für die Agentur für Arbeit.',
    long: 'Darin stehen Beschäftigungszeit, Verdienst und Grund der Beendigung - ohne sie kann dein Arbeitslosengeld nicht berechnet werden. Der Arbeitgeber muss sie übermitteln. Das heißt für dich: Verzögert sich die Bescheinigung, melde das sofort der Agentur, die fordert sie dann selbst an und zahlt vorläufig.',
    category: 'arbeit'
  },

  // --- Wohnen / Miete ---
  {
    term: 'Betriebskostenabrechnung',
    aliases: ['Nebenkostenabrechnung', 'Betriebskosten', 'Nebenkosten', 'Heizkostenabrechnung'],
    short: 'Jahresabrechnung über Heizung, Wasser, Müll und Hausnebenkosten.',
    long: 'Der Vermieter muss spätestens zwölf Monate nach Ende des Abrechnungszeitraums abrechnen - danach kann er keine Nachzahlung mehr verlangen, ein Guthaben musst du aber trotzdem bekommen. Umgelegt werden dürfen nur Kosten, die im Mietvertrag vereinbart sind. Das heißt für dich: Nach Erhalt hast du zwölf Monate Zeit für Einwendungen und darfst vorher die Belege einsehen.',
    category: 'wohnen'
  },
  {
    term: 'Nebenkostenvorauszahlung',
    aliases: ['Vorauszahlung Nebenkosten', 'Betriebskostenvorauszahlung', 'Abschlag'],
    short: 'Monatlicher Abschlag auf die späteren Betriebskosten.',
    long: 'Die Vorauszahlung wird mit der Jahresabrechnung verrechnet - daraus entsteht eine Nachzahlung oder ein Guthaben. Nach einer Abrechnung darf jede Seite die Höhe anpassen. Das heißt für dich: War die Nachzahlung hoch, erhöhe die Vorauszahlung freiwillig, sonst wiederholt sich der Schock jedes Jahr.',
    category: 'wohnen'
  },
  {
    term: 'Abrechnungsfrist',
    short: 'Zwölf Monate, in denen der Vermieter abrechnen muss.',
    long: 'Die Frist läuft ab dem Ende des Abrechnungszeitraums; kommt die Abrechnung später, entfällt der Anspruch auf Nachzahlung, außer der Vermieter hat die Verspätung nicht zu vertreten. Das heißt für dich: Prüfe zuerst das Datum - eine verspätete Abrechnung musst du in aller Regel nicht nachzahlen.',
    category: 'wohnen'
  },
  {
    term: 'Umlageschlüssel',
    aliases: ['Verteilerschlüssel', 'Umlagemaßstab'],
    short: 'Die Regel, nach der Kosten auf die Wohnungen verteilt werden.',
    long: 'Üblich ist die Verteilung nach Wohnfläche, nach Personenzahl oder nach Verbrauch; welcher Schlüssel gilt, steht im Mietvertrag, sonst zählt die Fläche. Bei Heizkosten muss ein großer Teil verbrauchsabhängig abgerechnet werden. Das heißt für dich: Vergleiche den angesetzten Schlüssel mit deinem Vertrag, ein falscher Maßstab verschiebt schnell dreistellige Beträge.',
    category: 'wohnen'
  },
  {
    term: 'Kaution',
    aliases: ['Mietkaution', 'Mietsicherheit'],
    short: 'Sicherheit für den Vermieter - höchstens drei Nettokaltmieten.',
    long: 'Die Kaution darf drei Monatsmieten ohne Nebenkosten nicht übersteigen und du darfst sie in drei Raten zahlen, die erste zu Mietbeginn. Sie muss getrennt vom Vermietervermögen angelegt und verzinst werden. Das heißt für dich: Nach dem Auszug hat der Vermieter einige Monate Zeit zur Abrechnung - danach kannst du die Rückzahlung schriftlich mit Frist verlangen.',
    category: 'wohnen'
  },
  {
    term: 'Mieterhöhung',
    aliases: ['Mieterhöhungsverlangen', 'Erhöhung der Miete'],
    short: 'Verlangen des Vermieters, künftig mehr Miete zu zahlen.',
    long: 'Eine Erhöhung bis zur ortsüblichen Vergleichsmiete muss begründet werden, etwa mit dem Mietspiegel, und die letzte Erhöhung muss mindestens fünfzehn Monate her sein. Du hast bis zum Ende des übernächsten Monats Zeit zuzustimmen - ohne Zustimmung muss der Vermieter klagen. Das heißt für dich: Prüfe Begründung und Kappungsgrenze, bevor du zustimmst, eine Unterschrift ist nicht zurückzunehmen.',
    category: 'wohnen'
  },
  {
    term: 'ortsübliche Vergleichsmiete',
    aliases: ['Vergleichsmiete', 'ortsüblich'],
    short: 'Die übliche Miete für ähnliche Wohnungen am selben Ort.',
    long: 'Sie bildet die Obergrenze für eine normale Mieterhöhung und ergibt sich aus Mietspiegel, Gutachten oder Vergleichswohnungen. Maßgeblich sind Größe, Lage, Ausstattung und Zustand. Das heißt für dich: Liegt deine Miete schon darüber, ist eine Erhöhung unzulässig - der Vergleich lohnt sich immer.',
    category: 'wohnen'
  },
  {
    term: 'Mietspiegel',
    short: 'Amtliche Übersicht über die üblichen Mieten in deiner Stadt.',
    long: 'Der Mietspiegel ordnet Wohnungen nach Baujahr, Größe, Lage und Ausstattung eine Preisspanne zu und ist die häufigste Begründung für Mieterhöhungen. Er ist meist kostenlos bei der Stadt erhältlich. Das heißt für dich: Such deine Wohnung selbst im Mietspiegel - oft ist die verlangte Miete am oberen Rand angesetzt, obwohl die Ausstattung das nicht hergibt.',
    category: 'wohnen'
  },
  {
    term: 'Kappungsgrenze',
    short: 'Deckel dafür, wie stark die Miete in drei Jahren steigen darf.',
    long: 'Innerhalb von drei Jahren darf die Miete um höchstens zwanzig Prozent steigen, in Gebieten mit angespanntem Wohnungsmarkt nur um fünfzehn. Das gilt zusätzlich zur ortsüblichen Vergleichsmiete. Das heißt für dich: Rechne die Steigerung der letzten drei Jahre zusammen - überschreitet sie die Grenze, ist die Erhöhung insoweit unwirksam.',
    category: 'wohnen'
  },
  {
    term: 'Mietpreisbremse',
    short: 'Obergrenze für die Miete bei Neuvermietung in angespannten Lagen.',
    long: 'Wo sie gilt, darf die neue Miete höchstens zehn Prozent über der ortsüblichen Vergleichsmiete liegen; Ausnahmen bestehen für Neubauten und umfassend sanierte Wohnungen. Der Vermieter muss unaufgefordert über eine höhere Vormiete informieren. Das heißt für dich: Zu viel gezahlte Miete kannst du rügen und für die Zukunft senken lassen, teilweise auch rückwirkend zurückfordern.',
    category: 'wohnen'
  },
  {
    term: 'Modernisierungsumlage',
    aliases: ['Modernisierungsmieterhöhung'],
    short: 'Dauerhafte Mieterhöhung nach einer Modernisierung.',
    long: 'Acht Prozent der auf deine Wohnung entfallenden Modernisierungskosten dürfen jährlich auf die Miete aufgeschlagen werden, gedeckelt auf drei Euro je Quadratmeter in sechs Jahren. Reine Instandhaltung darf nicht umgelegt werden. Das heißt für dich: Verlange die Aufschlüsselung und lass prüfen, welcher Anteil nur Reparatur war - dieser Teil muss herausgerechnet werden.',
    category: 'wohnen'
  },
  {
    term: 'Modernisierungsankündigung',
    short: 'Ankündigung der Bauarbeiten, drei Monate vorher und schriftlich.',
    long: 'Sie muss Art, Umfang, Beginn, Dauer und die zu erwartende Mieterhöhung nennen. Fehlt sie oder ist sie unvollständig, verschiebt sich die Erhöhung. Das heißt für dich: Heb das Schreiben auf und vergleiche es später mit der Abrechnung der Modernisierungsumlage.',
    category: 'wohnen'
  },
  {
    term: 'Eigenbedarf',
    aliases: ['Eigenbedarfskündigung'],
    short: 'Kündigung, weil der Vermieter die Wohnung selbst oder für Angehörige braucht.',
    long: 'Die Kündigung muss die Person und den Grund konkret benennen; es gelten die normalen Fristen von drei bis neun Monaten je nach Mietdauer. Vorgeschobener Eigenbedarf verpflichtet zu Schadenersatz. Das heißt für dich: Prüfe die Begründung genau und melde binnen zwei Monaten vor Vertragsende Härtegründe an, etwa Alter, Krankheit oder lange Wohndauer.',
    category: 'wohnen'
  },
  {
    term: 'Staffelmiete',
    short: 'Im Vertrag festgelegte Mieterhöhungen zu festen Terminen.',
    long: 'Jede Stufe und ihr Datum müssen als Betrag im Vertrag stehen, und zwischen zwei Stufen muss mindestens ein Jahr liegen. Daneben sind normale Mieterhöhungen ausgeschlossen. Das heißt für dich: Du weißt genau, was kommt - trag die Termine ein und prüfe, ob die Erhöhung auch wirklich vertragsgemäß umgesetzt wird.',
    category: 'wohnen'
  },
  {
    term: 'Indexmiete',
    short: 'Miete, die automatisch mit den Lebenshaltungskosten steigt.',
    long: 'Die Miete folgt dem amtlichen Verbraucherpreisindex; der Vermieter muss die Erhöhung schriftlich mit der Indexentwicklung begründen und darf sie höchstens einmal pro Jahr verlangen. Andere Erhöhungen außer für Betriebskosten sind ausgeschlossen. Das heißt für dich: In Zeiten hoher Inflation kann das teuer werden - rechne die genannten Indexwerte nach.',
    category: 'wohnen'
  },
  {
    term: 'Mietminderung',
    aliases: ['Miete mindern', 'gemindert'],
    short: 'Weniger Miete zahlen, solange die Wohnung einen Mangel hat.',
    long: 'Bei Schimmel, Heizungsausfall oder Baulärm darf die Miete für die Dauer des Mangels gekürzt werden - Voraussetzung ist, dass du den Mangel angezeigt hast. Wer zu viel mindert, riskiert eine Kündigung wegen Zahlungsverzug. Das heißt für dich: Mangel schriftlich melden, Fotos machen und die Minderung vorsichtshalber unter Vorbehalt zahlen.',
    category: 'wohnen'
  },
  {
    term: 'Schönheitsreparaturen',
    aliases: ['Renovierungsklausel', 'Endrenovierung'],
    short: 'Streichen und Tapezieren - oft vertraglich auf dich abgewälzt.',
    long: 'Viele Klauseln dazu sind unwirksam, besonders starre Fristenpläne und die Pflicht zur Endrenovierung bei unrenoviert übernommener Wohnung. Dann muss der Vermieter selbst renovieren. Das heißt für dich: Bevor du beim Auszug streichst oder zahlst, die Klausel prüfen lassen - hier holen sich Mieter besonders häufig Geld zurück.',
    category: 'wohnen'
  },
  {
    term: 'Räumungsklage',
    short: 'Klage des Vermieters, damit du die Wohnung verlassen musst.',
    long: 'Sie folgt auf eine Kündigung, der du nicht nachgekommen bist; erst ein Räumungsurteil und der Gerichtsvollzieher können dich tatsächlich aus der Wohnung setzen. Das Gericht kann eine Räumungsfrist gewähren. Das heißt für dich: Reagiere unbedingt schriftlich auf die Klage und beantrage Prozesskostenhilfe sowie eine Räumungsfrist.',
    category: 'wohnen'
  },
  {
    term: 'Schonfristzahlung',
    short: 'Nachzahlung, die eine fristlose Kündigung wegen Mietschulden heilt.',
    long: 'Zahlst du die offenen Mieten innerhalb von zwei Monaten nach Zustellung der Räumungsklage vollständig nach - oder eine Stelle wie das Jobcenter übernimmt sie -, wird die fristlose Kündigung unwirksam. Eine gleichzeitig ausgesprochene ordentliche Kündigung kann aber bestehen bleiben. Das heißt für dich: Sofort beim Jobcenter oder Sozialamt die Übernahme der Mietschulden beantragen, die Frist ist knapp.',
    category: 'wohnen'
  },
  {
    term: 'Übergabeprotokoll',
    aliases: ['Wohnungsübergabeprotokoll', 'Abnahmeprotokoll'],
    short: 'Schriftliche Zustandsaufnahme bei Ein- und Auszug.',
    long: 'Das Protokoll hält Zählerstände, Schlüssel und vorhandene Schäden fest und ist im Streit um die Kaution das wichtigste Beweismittel. Beide Seiten unterschreiben. Das heißt für dich: Nichts unterschreiben, was du nicht selbst geprüft hast, Fotos machen und eine Kopie mitnehmen.',
    category: 'wohnen'
  },
  {
    term: 'Wohnungsgeberbestätigung',
    aliases: ['Vermieterbescheinigung', 'Wohnungsgeberbescheinigung'],
    short: 'Bestätigung des Vermieters, die du zum Anmelden brauchst.',
    long: 'Ohne sie kannst du dich beim Einwohnermeldeamt nicht anmelden; der Vermieter muss sie innerhalb von zwei Wochen nach Einzug ausstellen. Die Anmeldung selbst ist Pflicht. Das heißt für dich: Fordere sie schon bei der Schlüsselübergabe an - fehlt die Anmeldung, drohen ein Bußgeld und Probleme mit Bank und Behörden.',
    category: 'wohnen'
  },
  {
    term: 'Nachmieter',
    aliases: ['Nachmieterklausel', 'Ersatzmieter'],
    short: 'Jemand, der früher in deinen Mietvertrag einsteigt.',
    long: 'Einen Anspruch darauf, vorzeitig auszuziehen, hast du nur bei entsprechender Vereinbarung oder in Härtefällen - der Vermieter muss einen Nachmieter grundsätzlich nicht akzeptieren. Üblich ist, drei zumutbare Kandidaten vorzuschlagen. Das heißt für dich: Vereinbare den vorzeitigen Ausstieg schriftlich, mündliche Zusagen helfen dir später nicht.',
    category: 'wohnen'
  }
]

// ============================================================================
// Normalisierung + Nachschlagen
// ============================================================================

/**
 * Faltet EIN Zeichen fuer den Vergleich: Kleinschreibung plus deutsche
 * Ersatzschreibweisen. Dadurch findet "Saeumniszuschlag" auch
 * "Säumniszuschlag" und "Strasse" auch "Straße".
 *
 * Gibt bewusst einen String zurueck, weil ein Zeichen zu zwei werden kann -
 * der Matcher braucht das, um Offsets zurueckrechnen zu koennen.
 */
export function foldChar(ch: string): string {
  const lower = ch.toLowerCase()
  switch (lower) {
    case 'ä':
      return 'ae'
    case 'ö':
      return 'oe'
    case 'ü':
      return 'ue'
    case 'ß':
      return 'ss'
    default:
      return lower
  }
}

/** Normalisiert einen Begriff: gefaltet, getrimmt, Mehrfach-Leerzeichen weg. */
export function normalizeGlossaryTerm(value: string): string {
  let out = ''
  for (const ch of value) out += foldChar(ch)
  return out.trim().replace(/\s+/g, ' ')
}

let lookupIndex: Map<string, GlossaryEntry> | null = null

function getLookupIndex(): Map<string, GlossaryEntry> {
  if (lookupIndex) return lookupIndex
  const index = new Map<string, GlossaryEntry>()
  // Zwei Durchlaeufe: kanonische Begriffe gewinnen gegen fremde Aliase.
  for (const entry of GLOSSARY) index.set(normalizeGlossaryTerm(entry.term), entry)
  for (const entry of GLOSSARY) {
    for (const alias of entry.aliases ?? []) {
      const key = normalizeGlossaryTerm(alias)
      if (!index.has(key)) index.set(key, entry)
    }
  }
  lookupIndex = index
  return index
}

/**
 * Schlaegt einen Begriff nach - unabhaengig von Gross-/Kleinschreibung,
 * Umlaut-Ersatzschreibung und Aliasen. Kein Treffer -> undefined.
 */
export function lookupTerm(term: string): GlossaryEntry | undefined {
  return getLookupIndex().get(normalizeGlossaryTerm(term))
}
