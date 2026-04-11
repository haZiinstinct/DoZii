import { app } from 'electron'
import { createHmac, createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { networkInterfaces } from 'os'
import type { LicenseInfo, LicenseTier } from '@shared/types'
import { DEFAULT_LICENSE } from '@shared/types'
import { logger } from './logger.service'

/**
 * License system - offline-first.
 *
 * Design goals:
 * 1. Zero external calls by default (privacy-first app)
 * 2. License key is verified locally via HMAC signature
 * 3. Hardware-bound: a license file embeds a machine ID so a leaked file
 *    can't be used on another machine
 * 4. Validation is cheap - just HMAC check + JSON parse
 *
 * Key format: `DOZII-XXXX-XXXX-XXXX-XXXX` where the last segment is an
 * HMAC-derived check code. On activation the app writes a signed license
 * file to the userData directory. Subsequent launches read + verify it
 * without network access.
 *
 * NOTE: This is scaffolding - the actual secret (`LICENSE_SECRET`) is a
 * placeholder. In production, you'd embed this at build time via env var
 * and NEVER commit the real secret to git. The same secret is also on the
 * license-issuing server so it can generate valid keys.
 */

const LICENSE_FILENAME = 'license.json'

// Placeholder. In production replace via build-time env injection.
// IMPORTANT: This MUST match the secret used by your license generation
// endpoint on the server. If you change it, all existing licenses break.
const LICENSE_SECRET = process.env.DOZII_LICENSE_SECRET || 'DOZII-DEV-SECRET-CHANGE-ME'

interface StoredLicense {
  tier: LicenseTier
  key: string
  email: string | null
  activatedAt: string
  expiresAt: string | null
  machineId: string
  signature: string
}

function getLicensePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, LICENSE_FILENAME)
}

/**
 * Generate a stable machine ID from non-PII hardware characteristics.
 * This is a coarse fingerprint; it survives OS reinstalls but not
 * hardware replacements. We only use it for license binding.
 */
function getMachineId(): string {
  const interfaces = networkInterfaces()
  const macs: string[] = []
  for (const name of Object.keys(interfaces).sort()) {
    const addrs = interfaces[name]
    if (!addrs) continue
    for (const addr of addrs) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        macs.push(addr.mac)
      }
    }
  }
  const fingerprint = macs.sort().join('|') || 'no-mac'
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)
}

/**
 * Compute the HMAC signature for a license. This is what the server
 * would compute when issuing a license, and what the client verifies
 * locally on each launch.
 */
function signLicense(
  key: string,
  tier: LicenseTier,
  email: string | null,
  machineId: string,
  expiresAt: string | null
): string {
  const payload = [key, tier, email ?? '', machineId, expiresAt ?? ''].join('|')
  return createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex')
}

/**
 * Parse a license key to extract its tier. Keys are formatted as:
 * `DOZII-<TIER>-XXXX-XXXX-XXXX` where TIER is `FREE`, `PRO`, `BIZZ`.
 * This is a simple decoding used for client-side tier detection.
 *
 * A real license generator would use a longer cryptographically-derived
 * key; this is enough for the scaffolding phase.
 */
function parseLicenseKey(
  key: string
): { tier: LicenseTier; valid: boolean } | null {
  const normalized = key.trim().toUpperCase()
  const match = normalized.match(/^DOZII-(FREE|PRO|BIZZ)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  if (!match) return null
  const tierCode = match[1]
  const tier: LicenseTier =
    tierCode === 'PRO' ? 'pro' : tierCode === 'BIZZ' ? 'business' : 'free'
  return { tier, valid: true }
}

export function getLicense(): LicenseInfo {
  const path = getLicensePath()
  if (!existsSync(path)) {
    return { ...DEFAULT_LICENSE }
  }

  try {
    const content = readFileSync(path, 'utf8')
    const stored = JSON.parse(content) as StoredLicense
    const machineId = getMachineId()

    if (stored.machineId !== machineId) {
      logger.warn('license.service', 'License machine ID mismatch - license invalid on this device')
      return { ...DEFAULT_LICENSE }
    }

    const expected = signLicense(
      stored.key,
      stored.tier,
      stored.email,
      stored.machineId,
      stored.expiresAt
    )
    if (expected !== stored.signature) {
      logger.warn('license.service', 'License signature invalid - tampered or wrong secret')
      return { ...DEFAULT_LICENSE }
    }

    if (stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now()) {
      logger.info('license.service', 'License expired', { expiresAt: stored.expiresAt })
      return { ...DEFAULT_LICENSE }
    }

    return {
      tier: stored.tier,
      key: stored.key,
      email: stored.email,
      activatedAt: stored.activatedAt,
      expiresAt: stored.expiresAt
    }
  } catch (err) {
    logger.error('license.service', 'Failed to read license file', {
      error: err instanceof Error ? err.message : String(err)
    })
    return { ...DEFAULT_LICENSE }
  }
}

export interface ActivationResult {
  ok: boolean
  error?: string
  info: LicenseInfo
}

export function activateLicense(key: string, email: string | null): ActivationResult {
  const parsed = parseLicenseKey(key)
  if (!parsed) {
    return {
      ok: false,
      error: 'Ungueltiges Lizenz-Format. Erwartet: DOZII-TIER-XXXX-XXXX-XXXX',
      info: getLicense()
    }
  }

  // For now the tier comes directly from the key; in production the
  // server would return a signed receipt that we'd verify here instead
  // of trusting the key format alone.
  const machineId = getMachineId()
  const activatedAt = new Date().toISOString()
  const expiresAt: string | null = null // perpetual for now

  const normalizedKey = key.trim().toUpperCase()
  const signature = signLicense(normalizedKey, parsed.tier, email, machineId, expiresAt)
  const stored: StoredLicense = {
    tier: parsed.tier,
    key: normalizedKey,
    email,
    activatedAt,
    expiresAt,
    machineId,
    signature
  }

  try {
    writeFileSync(getLicensePath(), JSON.stringify(stored, null, 2), 'utf8')
    logger.info('license.service', 'License activated', { tier: parsed.tier })
    return {
      ok: true,
      info: {
        tier: parsed.tier,
        key: normalizedKey,
        email,
        activatedAt,
        expiresAt
      }
    }
  } catch (err) {
    logger.error('license.service', 'Failed to write license file', {
      error: err instanceof Error ? err.message : String(err)
    })
    return {
      ok: false,
      error: 'Lizenz konnte nicht gespeichert werden',
      info: getLicense()
    }
  }
}

export function deactivateLicense(): LicenseInfo {
  const path = getLicensePath()
  try {
    if (existsSync(path)) {
      writeFileSync(path, JSON.stringify({ deactivated: true }, null, 2), 'utf8')
    }
    logger.info('license.service', 'License deactivated')
  } catch (err) {
    logger.warn('license.service', 'Deactivate failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
  return { ...DEFAULT_LICENSE }
}

/**
 * Quick tier check for feature gating. Returns true if the user has at
 * least the given tier. `free` means no license at all.
 */
export function hasTier(required: LicenseTier): boolean {
  const tier = getLicense().tier
  const ORDER: LicenseTier[] = ['free', 'pro', 'business']
  return ORDER.indexOf(tier) >= ORDER.indexOf(required)
}
