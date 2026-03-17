import type { DiagramElement, ViewportState, Theme, ConnectionElement, BoxElement } from '../store/types'
import { buildViewportMatrix } from './ViewportMatrix'
import { getIconImage, loadIcon, themeToHex } from '../icons/iconifyClient'

const GRID_SIZE = 40

function gridColors(theme: Theme) {
  return theme === 'dark'
    ? { line: 'rgba(255,255,255,0.04)', accent: 'rgba(255,255,255,0.09)' }
    : { line: 'rgba(0,0,0,0.05)', accent: 'rgba(0,0,0,0.12)' }
}

function labelColor(theme: Theme) {
  return theme === 'dark' ? 'rgba(226,232,240,0.9)' : 'rgba(30,41,59,0.9)'
}

function placeholderColors(theme: Theme) {
  return theme === 'dark'
    ? { fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.4)', dot: 'rgba(99,102,241,0.6)' }
    : { fill: 'rgba(99,102,241,0.08)', stroke: 'rgba(99,102,241,0.35)', dot: 'rgba(99,102,241,0.5)' }
}

// Icon tint: dark theme gets light icons, light theme gets dark icons
export function iconTint(theme: Theme) {
  return theme === 'dark' ? '%23e2e8f0' : '%231e293b'
}

function drawGrid(ctx: CanvasRenderingContext2D, vp: ViewportState, cssW: number, cssH: number, theme: Theme) {
  // Draw grid in world space (already transformed)
  // Find visible world bounds by inverse-transforming canvas corners
  const matrix = buildViewportMatrix(vp)
  const inv = matrix.inverse()

  const corners = [
    new DOMPoint(0, 0),
    new DOMPoint(cssW, 0),
    new DOMPoint(0, cssH),
    new DOMPoint(cssW, cssH),
  ].map((p) => inv.transformPoint(p))

  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const startX = Math.floor(minX / GRID_SIZE) * GRID_SIZE
  const startY = Math.floor(minY / GRID_SIZE) * GRID_SIZE

  const { line, accent } = gridColors(theme)
  ctx.lineWidth = 1 / vp.zoom

  for (let x = startX; x <= maxX + GRID_SIZE; x += GRID_SIZE) {
    ctx.strokeStyle = x % (GRID_SIZE * 5) === 0 ? accent : line
    ctx.beginPath()
    ctx.moveTo(x, minY - GRID_SIZE)
    ctx.lineTo(x, maxY + GRID_SIZE)
    ctx.stroke()
  }

  for (let y = startY; y <= maxY + GRID_SIZE; y += GRID_SIZE) {
    ctx.strokeStyle = y % (GRID_SIZE * 5) === 0 ? accent : line
    ctx.beginPath()
    ctx.moveTo(minX - GRID_SIZE, y)
    ctx.lineTo(maxX + GRID_SIZE, y)
    ctx.stroke()
  }
}

function drawIconElement(
  ctx: CanvasRenderingContext2D,
  el: import('../store/types').IconElement,
  selected: boolean,
  showHandles: boolean,
  theme: Theme,
  fontSize: number
) {
  // Resolve which color variant to use
  const colorKey = el.color ?? theme
  const img = getIconImage(el.iconName, colorKey)

  if (img) {
    ctx.drawImage(img, el.x, el.y, el.width, el.height)
  } else {
    // Kick off load if not started, render loop picks it up next frame
    loadIcon(el.iconName, colorKey)
    const ph = placeholderColors(theme)
    ctx.fillStyle = ph.fill
    ctx.strokeStyle = ph.stroke
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(el.x, el.y, el.width, el.height, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = ph.dot
    const cx = el.x + el.width / 2
    const cy = el.y + el.height / 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(cx - 8 + i * 8, cy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (el.label) {
    ctx.fillStyle = el.color ?? labelColor(theme)
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(el.label, el.x + el.width / 2, el.y + el.height + 4)
  }

  if (selected) {
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2 / 1  // we handle zoom outside
    ctx.setLineDash([4, 2])
    ctx.beginPath()
    ctx.roundRect(el.x - 3, el.y - 3, el.width + 6, el.height + 6, 6)
    ctx.stroke()
    ctx.setLineDash([])

    if (showHandles) {
      // Resize handles
      drawHandles(ctx, el)
    }
  }
}

function drawBoxElement(
  ctx: CanvasRenderingContext2D,
  el: BoxElement,
  selected: boolean,
  showHandles: boolean,
  theme: Theme,
  fontSize: number
) {
  const isDark = theme === 'dark'
  const glowColor = el.color ?? (isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)')
  const strokeColor = el.color ?? (isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.4)')

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.width, el.height, 10)

  // Glow pass
  ctx.shadowColor = glowColor
  ctx.shadowBlur = selected ? 18 : (el.color ? 14 : 6)
  ctx.strokeStyle = el.color ?? (selected ? '#6366f1' : strokeColor)
  ctx.lineWidth = selected ? 2 : 1.5
  ctx.setLineDash(el.color || selected ? [] : [6, 4])
  ctx.stroke()
  ctx.restore()

  // Label top-left
  if (el.text) {
    ctx.save()
    ctx.fillStyle = el.color
      ? el.color
      : (isDark ? 'rgba(148,163,184,0.65)' : 'rgba(71,85,105,0.7)')
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(el.text, el.x + 12, el.y + 10)
    ctx.restore()
  }

  if (selected && showHandles) drawHandles(ctx, el)
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: import('../store/types').TextElement,
  selected: boolean,
  showHandles: boolean,
  theme: Theme,
  fontSize: number
) {
  ctx.fillStyle = el.color ?? (theme === 'dark' ? 'rgba(226,232,240,0.95)' : 'rgba(15,23,42,0.95)')
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(el.text, el.x, el.y)

  if (selected) {
    const metrics = ctx.measureText(el.text)
    const w = metrics.width
    const h = fontSize * 1.2
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 2])
    ctx.strokeRect(el.x - 4, el.y - 4, w + 8, h + 8)
    ctx.setLineDash([])

    if (showHandles) {
      drawHandles(ctx, { x: el.x - 4, y: el.y - 4, width: w + 8, height: h + 8 })
    }
  }
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: { x: number; y: number; width: number; height: number }
) {
  const handleSize = 7
  const positions = [
    [el.x, el.y],
    [el.x + el.width / 2, el.y],
    [el.x + el.width, el.y],
    [el.x + el.width, el.y + el.height / 2],
    [el.x + el.width, el.y + el.height],
    [el.x + el.width / 2, el.y + el.height],
    [el.x, el.y + el.height],
    [el.x, el.y + el.height / 2],
  ]

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 1.5

  for (const [hx, hy] of positions) {
    ctx.beginPath()
    ctx.arc(hx, hy, handleSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

// ── Connection rendering ──────────────────────────────────────────────────────

function elementCenter(el: DiagramElement) {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 }
}

/** Find the point where a line from `from` to `to` exits the element's bounding box */
function bboxEdgePoint(
  el: DiagramElement,
  from: { x: number; y: number }
): { x: number; y: number } {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const dx = from.x - cx
  const dy = from.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const hw = el.width / 2 + 4
  const hh = el.height / 2 + 4
  const sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity
  const sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(sx, sy)
  return { x: cx + dx * t, y: cy + dy * t }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string,
  connStyle: import('../store/types').ConnectionStyle = 'solid'
) {
  const headLen = 10
  const angle = Math.atan2(y2 - y1, x2 - x1)

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5

  if (connStyle === 'dashed') {
    ctx.setLineDash([8, 5])
  } else if (connStyle === 'animated') {
    ctx.setLineDash([8, 5])
    // Offset marches forward over time — render loop calls this every rAF frame
    ctx.lineDashOffset = -(performance.now() / 40) % 13
  }

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  connections: ConnectionElement[],
  elements: DiagramElement[],
  selectedConnectionId: string | null,
  theme: 'dark' | 'light',
  fontSize: number
) {
  const elMap = new Map(elements.map((e) => [e.id, e]))
  const defaultColor = theme === 'dark' ? 'rgba(148,163,184,0.6)' : 'rgba(71,85,105,0.6)'

  for (const conn of connections) {
    const from = elMap.get(conn.fromId)
    const to = elMap.get(conn.toId)
    if (!from || !to) continue

    const start = bboxEdgePoint(from, elementCenter(to))
    const end = bboxEdgePoint(to, elementCenter(from))
    const selected = conn.id === selectedConnectionId
    const color = conn.color ?? (selected ? '#6366f1' : defaultColor)

    ctx.save()
    if (selected) {
      ctx.shadowColor = conn.color ?? '#6366f1'
      ctx.shadowBlur = 10
    }
    drawArrow(ctx, start.x, start.y, end.x, end.y, color, conn.style ?? 'solid')
    ctx.restore()

    if (conn.label) {
      const mx = (start.x + end.x) / 2
      const my = (start.y + end.y) / 2
      ctx.save()
      ctx.fillStyle = conn.color ?? (theme === 'dark' ? 'rgba(226,232,240,0.8)' : 'rgba(30,41,59,0.8)')
      ctx.font = `${Math.max(10, fontSize - 2)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Small bg pill for readability
      const tw = ctx.measureText(conn.label).width
      ctx.fillStyle = theme === 'dark' ? 'rgba(15,15,25,0.75)' : 'rgba(241,245,249,0.85)'
      ctx.beginPath()
      ctx.roundRect(mx - tw / 2 - 5, my - 10, tw + 10, 18, 4)
      ctx.fill()
      ctx.fillStyle = conn.color ?? (theme === 'dark' ? 'rgba(226,232,240,0.9)' : 'rgba(30,41,59,0.9)')
      ctx.fillText(conn.label, mx, my)
      ctx.restore()
    }
  }
}

function drawConnectionPreview(
  ctx: CanvasRenderingContext2D,
  fromEl: DiagramElement,
  previewPos: { x: number; y: number },
  theme: 'dark' | 'light'
) {
  const start = bboxEdgePoint(fromEl, previewPos)
  const color = theme === 'dark' ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.8)'
  drawArrow(ctx, start.x, start.y, previewPos.x, previewPos.y, color, 'dashed')
}

function drawMarquee(
  ctx: CanvasRenderingContext2D,
  rect: { x1: number; y1: number; x2: number; y2: number },
  theme: 'dark' | 'light'
) {
  const x = Math.min(rect.x1, rect.x2)
  const y = Math.min(rect.y1, rect.y2)
  const w = Math.abs(rect.x2 - rect.x1)
  const h = Math.abs(rect.y2 - rect.y1)
  ctx.save()
  ctx.fillStyle = theme === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)'
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.setLineDash([])
  ctx.restore()
}

// ── Main render ───────────────────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  elements: DiagramElement[],
  connections: ConnectionElement[],
  vp: ViewportState,
  selectedIds: string[],
  selectedConnectionId: string | null,
  connectingFromId: string | null,
  connectionPreviewPos: { x: number; y: number } | null,
  marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null,
  dpr: number,
  cssW: number,
  cssH: number,
  theme: 'dark' | 'light',
  defaultFontSize: number
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cssW * dpr, cssH * dpr)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const m = buildViewportMatrix(vp)
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f)

  drawGrid(ctx, vp, cssW, cssH, theme)

  // Connections drawn before elements (elements render on top)
  drawConnections(ctx, connections, elements, selectedConnectionId, theme, defaultFontSize)

  // Connection preview
  if (connectingFromId && connectionPreviewPos) {
    const fromEl = elements.find((e) => e.id === connectingFromId)
    if (fromEl) drawConnectionPreview(ctx, fromEl, connectionPreviewPos, theme)
  }

  // Sort: elements NOT in selectedIds come first, elements IN selectedIds last (render on top)
  const selectedIdSet = new Set(selectedIds)
  const sorted = [...elements].sort((a, b) => {
    const aSelected = selectedIdSet.has(a.id) ? 1 : 0
    const bSelected = selectedIdSet.has(b.id) ? 1 : 0
    return aSelected - bSelected
  })

  for (const el of sorted) {
    ctx.save()
    const sel = selectedIds.includes(el.id)
    const showHandles = sel && selectedIds.length === 1
    if (el.type === 'icon') {
      drawIconElement(ctx, el, sel, showHandles, theme, defaultFontSize)
    } else if (el.type === 'text') {
      drawTextElement(ctx, el, sel, showHandles, theme, defaultFontSize)
    } else if (el.type === 'box') {
      drawBoxElement(ctx, el, sel, showHandles, theme, defaultFontSize)
    }
    ctx.restore()
  }

  if (marqueeRect) drawMarquee(ctx, marqueeRect, theme)
}
