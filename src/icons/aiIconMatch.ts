/**
 * Ask the server to use the Claude Code Agent SDK to find the best icon for a word.
 * Uses your existing Claude Code authentication — no API key needed.
 * Falls back gracefully on error.
 */
export async function aiIconMatch(word: string): Promise<string | null> {
  try {
    const response = await fetch('/api/icon-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { iconName?: string }
    return data.iconName ?? null
  } catch (err) {
    console.warn('AI icon match failed:', err)
    return null
  }
}
