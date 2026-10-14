import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const dir = mkdtempSync(join(tmpdir(), 'dozii-logger-'))
vi.mock('electron', () => ({ app: { getPath: () => dir, isReady: () => true } }))

const { logger } = await import('./logger.service')

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('logger - Rotation zur Laufzeit', () => {
  it('wechselt beim Tageswechsel in die neue Tagesdatei', () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-10-13T23:59:00Z'))
    logger.info('test', 'vor Mitternacht')
    expect(logger.getCurrentLogFile()).toMatch(/dozii-2026-10-13\.log$/)

    vi.setSystemTime(new Date('2026-10-14T00:01:00Z'))
    logger.info('test', 'nach Mitternacht')
    expect(logger.getCurrentLogFile()).toMatch(/dozii-2026-10-14\.log$/)

    expect(readdirSync(join(dir, 'logs')).sort()).toEqual([
      'dozii-2026-10-13.log',
      'dozii-2026-10-14.log'
    ])
    vi.useRealTimers()
  })
})
