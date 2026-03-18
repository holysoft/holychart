// Singleton offscreen canvas for measuring text without a real render context
let _ctx: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d')!
  return _ctx
}

/** Measure the rendered width and height of a text element's content. */
export function measureTextElement(text: string, fontSize: number): { width: number; height: number } {
  const ctx = getMeasureCtx()
  const fontUi = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif'
  ctx.font = `${fontSize}px ${fontUi}`
  return {
    width: Math.max(1, Math.ceil(ctx.measureText(text || ' ').width)),
    height: Math.ceil(fontSize * 1.2),
  }
}
