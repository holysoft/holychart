import { BAKED_ICONS } from './bakedIcons'

// Cache keyed by "iconName|#hexcolor"
const imageCache = new Map<string, HTMLImageElement | Promise<HTMLImageElement>>()

export function themeToHex(theme: string): string {
  // If it's already a hex color, use it directly
  if (theme.startsWith('#')) return theme
  // Otherwise it's a theme name — read the current --text CSS variable
  return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e2e8f0'
}

function cacheKey(iconName: string, hex: string) {
  return `${iconName}|${hex}`
}

/** Inject a color into a currentColor SVG and return a data URI. */
export function svgToDataUri(svg: string, color: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/currentColor/g, color))
}

/** Get a data URI for a baked icon with the given color, or null if not baked. */
export function getBakedIconUri(iconName: string, color: string): string | null {
  const svg = BAKED_ICONS[iconName]
  if (!svg) return null
  return svgToDataUri(svg, color)
}

function parseIconName(iconName: string): { collection: string; name: string } {
  const i = iconName.indexOf(':')
  if (i < 0) return { collection: 'mdi', name: iconName }
  return { collection: iconName.slice(0, i), name: iconName.slice(i + 1) }
}

async function iconToImage(iconName: string, hex: string): Promise<HTMLImageElement> {
  const dataUri = getBakedIconUri(iconName, hex)
  const src = dataUri ?? (() => {
    const { collection, name } = parseIconName(iconName)
    return `https://api.iconify.design/${collection}/${name}.svg?height=128&color=${encodeURIComponent(hex)}`
  })()

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${iconName}`))
    img.src = src
  })
}

/** Load an icon into the canvas image cache. */
export function loadIcon(
  iconName: string,
  colorOrTheme: string,
  onLoad?: () => void
): void {
  const hex = themeToHex(colorOrTheme)
  const key = cacheKey(iconName, hex)

  if (imageCache.has(key)) {
    const cached = imageCache.get(key)!
    if (!(cached instanceof HTMLImageElement)) cached.then(() => onLoad?.()).catch(() => {})
    else onLoad?.()
    return
  }

  const promise = iconToImage(iconName, hex)
  imageCache.set(key, promise)
  promise
    .then((img) => { imageCache.set(key, img); onLoad?.() })
    .catch(() => { imageCache.delete(key) })
}

/** Get a cached icon image synchronously. Returns null if not yet loaded. */
export function getIconImage(iconName: string, colorOrTheme: string): HTMLImageElement | null {
  const cached = imageCache.get(cacheKey(iconName, themeToHex(colorOrTheme)))
  return cached instanceof HTMLImageElement ? cached : null
}
