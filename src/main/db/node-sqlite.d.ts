// Minimale Typen für Nodes eingebautes sqlite-Modul (Node >= 24).
// Nur in Unit-Tests genutzt; @types/node 20 (via Electron) kennt es noch nicht.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): {
      get(...params: unknown[]): unknown
      run(...params: unknown[]): unknown
      all(...params: unknown[]): unknown[]
    }
    close(): void
  }
}
