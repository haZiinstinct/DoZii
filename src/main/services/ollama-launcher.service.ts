import { spawn, execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface OllamaInstallation {
  installed: boolean
  binaryPath: string | null
}

/**
 * Detect if Ollama is installed on the system and return the path to the binary.
 * Searches common Windows/macOS/Linux install locations first, then falls back to PATH lookup.
 */
export function detectOllamaInstallation(): OllamaInstallation {
  const candidates: string[] = []

  if (process.platform === 'win32') {
    // Standard Windows install location
    candidates.push(
      join(homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
      'C:\\Program Files\\Ollama\\ollama.exe',
      'C:\\Program Files (x86)\\Ollama\\ollama.exe'
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Ollama.app/Contents/Resources/ollama',
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama'
    )
  } else {
    // Linux
    candidates.push(
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      join(homedir(), '.local', 'bin', 'ollama')
    )
  }

  // Check direct paths
  for (const path of candidates) {
    if (existsSync(path)) {
      return { installed: true, binaryPath: path }
    }
  }

  // Fallback: PATH lookup via `where` (Windows) or `which`
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const output = execFileSync(cmd, ['ollama'], { encoding: 'utf8', timeout: 3000 }).trim()
    const firstLine = output.split(/\r?\n/)[0]
    if (firstLine && existsSync(firstLine)) {
      return { installed: true, binaryPath: firstLine }
    }
  } catch {
    // not in PATH
  }

  return { installed: false, binaryPath: null }
}

/**
 * Launch the Ollama server as a detached background process.
 * On Windows this uses `ollama serve` which listens on localhost:11434.
 * The process is unref'd so it survives the DoZii app exit.
 */
export async function startOllamaServer(): Promise<{
  started: boolean
  error?: string
}> {
  const { installed, binaryPath } = detectOllamaInstallation()
  if (!installed || !binaryPath) {
    return { started: false, error: 'Ollama ist nicht installiert' }
  }

  try {
    const child = spawn(binaryPath, ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })

    // Let the child run independently of the parent
    child.unref()

    // Watchdog: erst "gestartet" melden, wenn der Server wirklich antwortet.
    const reachable = await waitForOllama(15_000)
    if (!reachable) {
      return {
        started: false,
        error:
          'Ollama wurde gestartet, antwortet aber nicht auf Port 11434 (15s Timeout). ' +
          'Möglicherweise blockiert eine Firewall den Port oder der Start ist fehlgeschlagen.'
      }
    }

    return { started: true }
  } catch (err) {
    return {
      started: false,
      error: err instanceof Error ? err.message : 'Unbekannter Fehler beim Start'
    }
  }
}

/**
 * Stop the running Ollama server using execFileSync (safe, no shell).
 * Cross-platform kill commands.
 */
export async function stopOllamaServer(): Promise<{
  stopped: boolean
  error?: string
}> {
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/F', '/IM', 'ollama.exe'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      })
    } else if (process.platform === 'darwin') {
      execFileSync('pkill', ['-f', 'ollama serve'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      })
    } else {
      execFileSync('killall', ['ollama'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      })
    }

    // Give the process a moment to fully exit, then verify
    await new Promise((r) => setTimeout(r, 500))
    const isDown = await waitForOllamaDown(3_000)
    if (!isDown) {
      return { stopped: false, error: 'Ollama läuft weiterhin auf Port 11434' }
    }

    return { stopped: true }
  } catch (err) {
    // Some kill commands exit with non-zero if no matching process was found
    // (e.g. already stopped) - we treat that as success
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.includes('nicht gefunden') ||
      message.includes('not found') ||
      message.includes('no matching')
    ) {
      return { stopped: true }
    }
    return { stopped: false, error: message }
  }
}

/**
 * Poll the Ollama API until it responds or the timeout expires.
 */
async function waitForOllama(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(1000)
      })
      if (response.ok) return true
    } catch {
      // keep trying
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/**
 * Poll the Ollama API until it STOPS responding (process has actually exited)
 * or the timeout expires. Returns true if Ollama is confirmed down.
 */
async function waitForOllamaDown(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(500)
      })
    } catch {
      // connection refused means Ollama is down
      return true
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}
