import { ICON_MAP } from './iconList'

export interface MatchResult {
  iconName: string
  keyword: string
  score: number
  isRandom?: boolean
}

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function queryToSeed(q: string): number {
  let h = 0
  for (let i = 0; i < q.length; i++) {
    h = (Math.imul(31, h) + q.charCodeAt(i)) | 0
  }
  return h
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

  const results: MatchResult[] = []

  if (!q) {
    // No query — return seeded random icons
    const allEntries = Object.entries(ICON_MAP)
    const seenNames = new Set<string>()
    const candidates: Array<{ iconName: string; keyword: string }> = []
    for (const [keyword, iconName] of allEntries) {
      if (!seenNames.has(iconName)) {
        candidates.push({ iconName, keyword })
        seenNames.add(iconName)
      }
    }
    const rand = seededRandom(queryToSeed('__default__'))
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    return candidates.slice(0, maxResults).map((c) => ({
      iconName: c.iconName,
      keyword: c.keyword,
      score: 0,
      isRandom: true,
    }))
  }

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

  const matched = [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  if (matched.length >= maxResults) return matched

  // Fill remaining slots with seeded-random icons not already matched
  const matchedNames = new Set(matched.map((r) => r.iconName))
  const allEntries = Object.entries(ICON_MAP)
  const candidates: Array<{ iconName: string; keyword: string }> = []
  const seenNames = new Set<string>()
  for (const [keyword, iconName] of allEntries) {
    if (!matchedNames.has(iconName) && !seenNames.has(iconName)) {
      candidates.push({ iconName, keyword })
      seenNames.add(iconName)
    }
  }

  const rand = seededRandom(queryToSeed(q))
  // Fisher-Yates shuffle with seeded random
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const needed = maxResults - matched.length
  const randomResults: MatchResult[] = candidates.slice(0, needed).map((c) => ({
    iconName: c.iconName,
    keyword: c.keyword,
    score: 0,
    isRandom: true,
  }))

  return [...matched, ...randomResults]
}
