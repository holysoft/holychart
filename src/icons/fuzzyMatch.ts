import { ICON_MAP } from './iconList'

export interface MatchResult {
  iconName: string
  keyword: string
  score: number
}

/**
 * Score a query against an entry key.
 * Returns 0 if no match, higher is better.
 */
function score(query: string, key: string): number {
  if (query === key) return 100
  if (key.startsWith(query)) return 80
  if (key.includes(query)) return 60
  // Substring match on any word in the key
  const words = key.split(/[\s-_]+/)
  for (const word of words) {
    if (word.startsWith(query)) return 50
    if (word.includes(query)) return 30
  }
  // Fuzzy: how many chars of query appear in order in key
  let qi = 0
  for (let i = 0; i < key.length && qi < query.length; i++) {
    if (key[i] === query[qi]) qi++
  }
  const ratio = qi / query.length
  if (ratio >= 0.8) return Math.floor(ratio * 20)
  return 0
}

export function fuzzyMatchIcons(query: string, maxResults = 8): MatchResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const results: MatchResult[] = []

  for (const [keyword, iconName] of Object.entries(ICON_MAP)) {
    const s = score(q, keyword)
    if (s > 0) {
      results.push({ iconName, keyword, score: s })
    }
  }

  // Deduplicate by iconName, keeping highest score
  const seen = new Map<string, MatchResult>()
  for (const r of results) {
    const existing = seen.get(r.iconName)
    if (!existing || existing.score < r.score) {
      seen.set(r.iconName, r)
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}
