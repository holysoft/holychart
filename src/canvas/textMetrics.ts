// Shared constants for text element layout
export const TEXT_PAD_X = 12
export const TEXT_PAD_Y = 8
export const TEXT_LINE_H = 1.5 // multiplier of fontSize

// Singleton offscreen canvas for measuring text without a real render context
let _ctx: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d')!
  return _ctx
}

/** Measure the rendered width and height of a (possibly multi-line) text element. */
export function measureTextElement(text: string, fontSize: number): { width: number; height: number } {
  const ctx = getMeasureCtx()
  const fontUi = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif'
  ctx.font = `${fontSize}px ${fontUi}`
  const lines = text.split('\n')
  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l || ' ').width))
  return {
    width: Math.max(120, Math.ceil(maxLineW + TEXT_PAD_X * 2)),
    height: Math.max(40, Math.ceil(lines.length * fontSize * TEXT_LINE_H + TEXT_PAD_Y * 2)),
  }
}
