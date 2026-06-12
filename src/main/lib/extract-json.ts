/**
 * Extract a JSON object from a model response. Handles plain JSON, JSON inside
 * markdown fences, or JSON with leading/trailing prose.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    /* fall through */
  }
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      /* give up */
    }
  }
  return null
}
