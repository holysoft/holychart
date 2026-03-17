import type { Theme } from '../store/types'

// Cache keyed by "iconName|#hexcolor"
const imageCache = new Map<string, HTMLImageElement | Promise<HTMLImageElement>>()

export function themeToHex(theme: Theme | string): string {
  if (theme === 'dark') return '#e2e8f0'
  if (theme === 'light') return '#1e293b'
  return theme // already a hex string
}

function cacheKey(iconName: string, hex: string) {
  return `${iconName}|${hex}`
}

function parseIconName(iconName: string): { collection: string; name: string } {
  const i = iconName.indexOf(':')
  if (i < 0) return { collection: 'mdi', name: iconName }
  return { collection: iconName.slice(0, i), name: iconName.slice(i + 1) }
}

async function fetchIcon(iconName: string, hex: string): Promise<HTMLImageElement> {
  const { collection, name } = parseIconName(iconName)
  const encoded = encodeURIComponent(hex)
  const url = `https://api.iconify.design/${collection}/${name}.svg?height=128&color=${encoded}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch icon: ${iconName}`)
  const svg = await res.text()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const blobUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error(`Failed to load: ${iconName}`)) }
    img.src = blobUrl
  })
}

/** Load an icon with a given color (hex string or 'dark'/'light' theme shorthand). */
export function loadIcon(
  iconName: string,
  colorOrTheme: string = 'dark',
  onLoad?: () => void
): void {
  const hex = themeToHex(colorOrTheme)
  const key = cacheKey(iconName, hex)

  if (imageCache.has(key)) {
    const cached = imageCache.get(key)!
    if (!(cached instanceof HTMLImageElement)) cached.then(() => onLoad?.()).catch(() => {})
    return
  }

  const promise = fetchIcon(iconName, hex)
  imageCache.set(key, promise)
  promise
    .then((img) => { imageCache.set(key, img); onLoad?.() })
    .catch(() => { imageCache.delete(key) })
}

/** Get a cached icon image synchronously. Returns null if not yet loaded. */
export function getIconImage(iconName: string, colorOrTheme: string = 'dark'): HTMLImageElement | null {
  const cached = imageCache.get(cacheKey(iconName, themeToHex(colorOrTheme)))
  return cached instanceof HTMLImageElement ? cached : null
}
