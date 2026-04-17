// ── Score response parsing utility
// Parses Gemini score responses with defaults for missing fields.
// Handles both raw JSON and markdown-fenced JSON.

/**
 * Parses a score response string (JSON or markdown-fenced JSON)
 * into a normalised object with defaults for missing fields.
 *
 * @param {string} raw - Raw response text (JSON or ```json ... ```)
 * @returns {{ score: number, reason: string, redFlags: string }}
 */
export function parseScoreResponse(raw) {
  let text = raw.trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { score: 60, reason: 'No reason provided', redFlags: 'none' };
  }

  return {
    score:    typeof parsed.score    === 'number' ? parsed.score    : 60,
    reason:   typeof parsed.reason   === 'string' ? parsed.reason   : 'No reason provided',
    redFlags: typeof parsed.redFlags === 'string' ? parsed.redFlags : 'none',
  };
}
