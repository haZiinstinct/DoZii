import { describe, it, expect } from 'vitest'
import { parseLetter, extractPlaceholders } from './parse-letter'

const FULL_DE = `
## Hinweis
Das ist ein Entwurf, keine Rechtsberatung. Pruefe die Frist selbst im Bescheid.

## Betreff
Widerspruch gegen den Bescheid vom [Datum des Bescheids], Aktenzeichen [Aktenzeichen]

## Brief
[Dein Name]
[Deine Adresse]

Jobcenter Musterstadt

[Ort], [Datum]

Widerspruch gegen den Bescheid vom [Datum des Bescheids]

Sehr geehrte Damen und Herren,

hiermit lege ich Widerspruch gegen den Bescheid vom [Datum des Bescheids], Aktenzeichen [Aktenzeichen], ein. Eine ausfuehrliche Begruendung reiche ich nach.

Mit freundlichen Gruessen

[Unterschrift]
[Dein Name]

## Das musst du noch ergaenzen
- [Dein Name] - dein vollstaendiger Name
- [Aktenzeichen] - steht oben rechts auf dem Bescheid

## Bevor du abschickst
- [ ] Frist pruefen
- [x] Kopie behalten
- [ ] Per Einschreiben senden

## Wo du Hilfe bekommst
- Sozialverband in deiner Naehe
- Beratungshilfeschein beim Amtsgericht
`

describe('parseLetter', () => {
  it('parst alle sechs Abschnitte eines deutschen Entwurfs', () => {
    const result = parseLetter(FULL_DE)
    expect(result).not.toBeNull()
    expect(result!.notice).toBe(
      'Das ist ein Entwurf, keine Rechtsberatung. Pruefe die Frist selbst im Bescheid.'
    )
    expect(result!.subject).toBe(
      'Widerspruch gegen den Bescheid vom [Datum des Bescheids], Aktenzeichen [Aktenzeichen]'
    )
    expect(result!.body).toContain('hiermit lege ich Widerspruch')
    expect(result!.body.startsWith('[Dein Name]')).toBe(true)
    expect(result!.todos).toHaveLength(2)
    expect(result!.todos[1]).toBe('[Aktenzeichen] - steht oben rechts auf dem Bescheid')
    expect(result!.help).toEqual([
      'Sozialverband in deiner Naehe',
      'Beratungshilfeschein beim Amtsgericht'
    ])
  })

  it('sammelt die Platzhalter des Brieftexts dedupliziert in Reihenfolge', () => {
    const result = parseLetter(FULL_DE)
    expect(result!.placeholders).toEqual([
      '[Dein Name]',
      '[Deine Adresse]',
      '[Ort]',
      '[Datum]',
      '[Datum des Bescheids]',
      '[Aktenzeichen]',
      '[Unterschrift]'
    ])
  })

  it('entfernt die Checkbox-Marker aus der Checkliste', () => {
    const result = parseLetter(FULL_DE)
    expect(result!.checklist).toEqual([
      'Frist pruefen',
      'Kopie behalten',
      'Per Einschreiben senden'
    ])
  })

  it('akzeptiert englische Ueberschriften', () => {
    const md = `
## Notice
This is a draft, not legal advice.

## Subject
Objection against the decision of [Date]

## Letter
Dear Sir or Madam,

hiermit lege ich Widerspruch ein.

[Signature]

## What you still need to fill in
- [Your name] - your full name

## Before you send
- [ ] Check the deadline

## Where to get help
- Consumer advice centre
`
    const result = parseLetter(md)
    expect(result).not.toBeNull()
    expect(result!.notice).toBe('This is a draft, not legal advice.')
    expect(result!.subject).toBe('Objection against the decision of [Date]')
    expect(result!.placeholders).toEqual(['[Signature]'])
    expect(result!.todos).toEqual(['[Your name] - your full name'])
    expect(result!.checklist).toEqual(['Check the deadline'])
    expect(result!.help).toEqual(['Consumer advice centre'])
  })

  it('ist tolerant gegen fehlende Abschnitte', () => {
    const result = parseLetter('## Brief\nSehr geehrte Damen und Herren,\n\nich kuendige.')
    expect(result).not.toBeNull()
    expect(result!.body).toContain('ich kuendige.')
    expect(result!.notice).toBe('')
    expect(result!.subject).toBe('')
    expect(result!.todos).toEqual([])
    expect(result!.checklist).toEqual([])
    expect(result!.help).toEqual([])
  })

  it('liefert null ohne Brief-Abschnitt', () => {
    const md = `
## Hinweis
Das ist ein Entwurf.

## Bevor du abschickst
- [ ] Frist pruefen
`
    expect(parseLetter(md)).toBeNull()
  })

  it('liefert null bei leerer Eingabe oder strukturlosem Text', () => {
    expect(parseLetter('')).toBeNull()
    expect(parseLetter('   \n  ')).toBeNull()
    expect(parseLetter('Das Modell hat einfach drauflosgeschrieben.')).toBeNull()
  })

  it('liefert null wenn die Brief-Sektion leer bleibt', () => {
    expect(parseLetter('## Brief\n\n## Bevor du abschickst\n- [ ] Frist pruefen')).toBeNull()
  })

  it('erkennt Ueberschriften mit echten Umlauten und anderer Ebene', () => {
    const md = `
### Brief
Sehr geehrte Damen und Herren, [Platzhalter].

### Das musst du noch ergänzen
- [Platzhalter] - bitte ausfüllen
`
    const result = parseLetter(md)
    expect(result).not.toBeNull()
    expect(result!.todos).toEqual(['[Platzhalter] - bitte ausfüllen'])
  })

  it('entfernt einen Code-Block um den Brieftext', () => {
    const md = `
## Brief
\`\`\`
Sehr geehrte Damen und Herren,

hiermit kuendige ich zum naechstmoeglichen Termin.
\`\`\`

## Bevor du abschickst
- [ ] Kopie behalten
`
    const result = parseLetter(md)
    expect(result).not.toBeNull()
    expect(result!.body.startsWith('Sehr geehrte')).toBe(true)
    expect(result!.body).not.toContain('```')
    expect(result!.checklist).toEqual(['Kopie behalten'])
  })

  it('entfernt einen Code-Block um die gesamte Ausgabe', () => {
    const md = `\`\`\`markdown
## Brief
Sehr geehrte Damen und Herren, [Dein Name].
\`\`\``
    const result = parseLetter(md)
    expect(result).not.toBeNull()
    expect(result!.body).toBe('Sehr geehrte Damen und Herren, [Dein Name].')
  })

  it('putzt die Betreffzeile von Label, Fettung und Anfuehrungszeichen', () => {
    const md = `
## Betreff
**Betreff:** "Kuendigung meines Vertrags Nr. [Vertragsnummer]"
Diese zweite Zeile gehoert nicht in den Betreff.

## Brief
Sehr geehrte Damen und Herren, ich kuendige.
`
    const result = parseLetter(md)
    expect(result!.subject).toBe('Kuendigung meines Vertrags Nr. [Vertragsnummer]')
  })

  it('akzeptiert * und • als Aufzaehlungszeichen', () => {
    const md = `
## Brief
Sehr geehrte Damen und Herren, ich kuendige.

## Wo du Hilfe bekommst
* Mieterverein
• Verbraucherzentrale
`
    const result = parseLetter(md)
    expect(result!.help).toEqual(['Mieterverein', 'Verbraucherzentrale'])
  })
})

describe('extractPlaceholders', () => {
  it('zaehlt Markdown-Links nicht als Platzhalter', () => {
    const body = 'Mehr unter [Verbraucherzentrale](https://example.org), Gruss [Dein Name].'
    expect(extractPlaceholders(body)).toEqual(['[Dein Name]'])
  })

  it('ignoriert Checkboxen, leere Klammern, Zahlen und Fussnoten', () => {
    const body = [
      '- [ ] offen',
      '- [x] erledigt',
      'leer: []',
      'Quelle [3]',
      'Fussnote [^1]',
      'Gruss [Dein Name]'
    ].join('\n')
    expect(extractPlaceholders(body)).toEqual(['[Dein Name]'])
  })

  it('dedupliziert ohne Ruecksicht auf Gross-/Kleinschreibung und behaelt die erste Schreibweise', () => {
    const body = '[Dein Name] ... [dein name] ... [DEIN  NAME] ... [Aktenzeichen]'
    expect(extractPlaceholders(body)).toEqual(['[Dein Name]', '[Aktenzeichen]'])
  })

  it('liefert eine leere Liste ohne Platzhalter', () => {
    expect(extractPlaceholders('')).toEqual([])
    expect(extractPlaceholders('Ein Brief ganz ohne eckige Klammern.')).toEqual([])
  })
})
