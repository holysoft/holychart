/**
 * Theme registry — the single source of truth for available themes.
 * To add a new theme:
 *   1. Create src/themes/mytheme.css with all CSS variables
 *   2. Add the import + name here
 */

import './dark.css'
import './light.css'
import './nord.css'
import './win95.css'
import './aqua.css'

export const THEMES = ['dark', 'light'] as const

export type ResolvedTheme = (typeof THEMES)[number]
export type Theme = ResolvedTheme | 'system'
