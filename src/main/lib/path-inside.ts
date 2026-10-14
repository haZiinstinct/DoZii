import { isAbsolute, relative, resolve } from 'path'

/**
 * Liegt `file` innerhalb von `dir` (nicht `dir` selbst)?
 *
 * `file.startsWith(dir)` reicht nicht: "C:\Daten\documents-alt\x.pdf"
 * beginnt auch mit "C:\Daten\documents". path.relative kennt die
 * Pfadtrenner und loest ".." auf.
 */
export function isInsideDir(dir: string, file: string): boolean {
  const rel = relative(resolve(dir), resolve(file))
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}
