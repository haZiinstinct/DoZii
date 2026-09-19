import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { escapeLikePattern, LIKE_ESCAPE_CHAR } from '@shared/like-pattern'

/**
 * Der eigentliche Regressionstest: die Abfrage wird gegen eine echte
 * SQLite-Datenbank gefahren. Der Fehler, den das hier verhindert, war kein
 * Tippfehler in der Logik, sondern ein verschluckter Backslash im
 * SQL-Text - und der faellt nur auf, wenn SQLite die Abfrage wirklich sieht.
 */
describe('LIKE-Suche gegen echtes SQLite', () => {
  function seededDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE docs (filename TEXT NOT NULL, body TEXT NOT NULL);
      INSERT INTO docs VALUES ('bescheid.pdf', 'Widerspruch innerhalb eines Monats');
      INSERT INTO docs VALUES ('rabatt.pdf', 'Sie erhalten 50% Nachlass');
      INSERT INTO docs VALUES ('egal.pdf', 'voellig anderer Inhalt');
    `)
    return db
  }

  function search(db: DatabaseSync, needle: string): string[] {
    const pattern = `%${escapeLikePattern(needle.toLowerCase())}%`
    return db
      .prepare(
        'SELECT filename FROM docs WHERE lower(filename) LIKE ? ESCAPE ? OR lower(body) LIKE ? ESCAPE ?'
      )
      .all(pattern, LIKE_ESCAPE_CHAR, pattern, LIKE_ESCAPE_CHAR)
      .map((r) => (r as { filename: string }).filename)
  }

  it('findet ueber den Inhalt', () => {
    const db = seededDb()
    expect(search(db, 'Widerspruch')).toEqual(['bescheid.pdf'])
    db.close()
  })

  it('findet ueber den Dateinamen', () => {
    const db = seededDb()
    expect(search(db, 'rabatt')).toEqual(['rabatt.pdf'])
    db.close()
  })

  it('"50%" trifft nur den Rabatt, nicht alles', () => {
    const db = seededDb()
    expect(search(db, '50%')).toEqual(['rabatt.pdf'])
    db.close()
  })

  it('ein einzelnes Prozentzeichen trifft nicht jedes Dokument', () => {
    const db = seededDb()
    // Ohne Escaping waere '%' ein Platzhalter und alle drei Zeilen kaemen zurueck.
    expect(search(db, '%')).toEqual(['rabatt.pdf'])
    db.close()
  })

  it('Unterstrich ist kein Platzhalter fuer ein beliebiges Zeichen', () => {
    const db = seededDb()
    expect(search(db, 'e_al')).toEqual([])
    db.close()
  })
})
