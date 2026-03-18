import type { DiagramElement, ViewportState, Theme, ConnectionElement, BoxElement } from '../store/types'
import { buildViewportMatrix } from './ViewportMatrix'
import { getIconImage, loadIcon, themeToHex } from '../icons/iconifyClient'
import { getThemeColors, type ThemeColors } from '../themes/themeColors'
import { measureTextElement } from './textMetrics'

const GRID_SIZE = 40

function drawGrid(ctx: CanvasRenderingContext2D, vp: ViewportState, cssW: number, cssH: number, tc: ThemeColors) {
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

  ctx.lineWidth = 1 / vp.zoom

  for (let x = startX; x <= maxX + GRID_SIZE; x += GRID_SIZE) {
    ctx.strokeStyle = x % (GRID_SIZE * 5) === 0 ? tc.canvasGridAccent : tc.canvasGrid
    ctx.beginPath()
    ctx.moveTo(x, minY - GRID_SIZE)
    ctx.lineTo(x, maxY + GRID_SIZE)
    ctx.stroke()
  }

  for (let y = startY; y <= maxY + GRID_SIZE; y += GRID_SIZE) {
    ctx.strokeStyle = y % (GRID_SIZE * 5) === 0 ? tc.canvasGridAccent : tc.canvasGrid
    ctx.beginPath()
    ctx.moveTo(minX - GRID_SIZE, y)
    ctx.lineTo(maxX + GRID_SIZE, y)
    ctx.stroke()
  }
}

function drawOriginMarker(ctx: CanvasRenderingContext2D, vp: ViewportState, tc: ThemeColors) {
  const s = 10 / vp.zoom
  const r = 3 / vp.zoom
  ctx.save()
  ctx.strokeStyle = tc.canvasOrigin
  ctx.fillStyle = tc.canvasOrigin
  ctx.lineWidth = 1.5 / vp.zoom
  ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawIconElement(
  ctx: CanvasRenderingContext2D,
  el: import('../store/types').IconElement,
  selected: boolean,
  showHandles: boolean,
  theme: Theme,
  fontSize: number,
  tc: ThemeColors
) {
  const colorKey = el.color ?? theme
  const img = getIconImage(el.iconName, colorKey)

  // Unified backing card — one shape covering icon + label together
  if (tc.canvasIconBg !== 'transparent') {
    const pad = 6
    const labelH = el.label ? fontSize * 1.2 + 8 : 0
    const totalH = el.height + pad * 2 + (el.label ? labelH + 4 : 0)
    let cardW = el.width
    if (el.label) {
      ctx.font = `${fontSize}px ${tc.fontUi}`
      const tw = ctx.measureText(el.label).width
      cardW = Math.max(el.width, tw + pad * 2)
    }
    const cardX = el.x + el.width / 2 - cardW / 2
    ctx.fillStyle = tc.canvasIconBg
    ctx.beginPath()
    ctx.roundRect(cardX - pad, el.y - pad, cardW + pad * 2, totalH, tc.radiusMd + pad)
    ctx.fill()
  }

  if (img) {
    ctx.drawImage(img, el.x, el.y, el.width, el.height)
  } else {
    loadIcon(el.iconName, colorKey)
    ctx.fillStyle = tc.canvasPlaceholderFill
    ctx.strokeStyle = tc.canvasPlaceholderStroke
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(el.x, el.y, el.width, el.height, tc.radiusMd)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = tc.canvasPlaceholderDot
    const cx = el.x + el.width / 2
    const cy = el.y + el.height / 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(cx - 8 + i * 8, cy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (el.label) {
    ctx.font = `${fontSize}px ${tc.fontUi}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    // No separate label backing needed — unified card above covers it
    ctx.fillStyle = el.color ?? tc.canvasLabelText
    ctx.fillText(el.label, el.x + el.width / 2, el.y + el.height + 4)
  }

  if (selected) {
    const sx = el.x - 3, sy = el.y - 3, sw = el.width + 6, sh = el.height + 6
    ctx.save()
    ctx.fillStyle = tc.canvasMarqueeFill
    ctx.beginPath()
    ctx.roundRect(sx, sy, sw, sh, tc.radiusMd)
    ctx.fill()
    ctx.strokeStyle = tc.accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke()       // top:    tl → tr
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke()       // left:   tl → bl  (same anchor as top)
    ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // right:  tr → br
    ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // bottom: bl → br
    ctx.setLineDash([])
    ctx.restore()

    if (showHandles) {
      drawHandles(ctx, el, tc)
    }
  }
}

function drawBoxElement(
  ctx: CanvasRenderingContext2D,
  el: BoxElement,
  selected: boolean,
  showHandles: boolean,
  _theme: Theme,
  fontSize: number,
  tc: ThemeColors
) {
  const boxStyle = el.style ?? 'solid'
  const glowColor = el.color ?? tc.canvasBoxGlow
  const strokeColor = el.color ?? tc.canvasBoxStroke

  const needsSolidFill = tc.canvasTextBg !== 'transparent'
  const lw = tc.canvasStrokeWidth

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.width, el.height, tc.radiusLg)

  // Opaque base — drawn first so overlapping colored boxes never bleed into each other
  if (tc.canvasBoxBase !== 'transparent') {
    ctx.fillStyle = tc.canvasBoxBase
    ctx.fill()
  }

  // White backing so boxes don't sit on a colored canvas background
  if (needsSolidFill) {
    ctx.fillStyle = tc.canvasBoxFill
    ctx.fill()
  }

  if (boxStyle === 'filled') {
    // Base fill
    const baseAlpha = el.color ? tc.canvasBoxColorFilledAlpha : tc.canvasBoxFilledBaseAlpha
    if (baseAlpha > 0) {
      ctx.globalAlpha = baseAlpha
      ctx.fillStyle = el.color ?? tc.canvasBoxFill
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // Gradient overlay
    if (tc.canvasBoxGradientStops) {
      const gradAlpha = el.color ? tc.canvasBoxColorGradientAlpha : tc.canvasBoxGradientAlpha
      if (gradAlpha > 0) {
        const grad = ctx.createLinearGradient(el.x, el.y, el.x, el.y + el.height)
        for (const [offset, color] of tc.canvasBoxGradientStops) grad.addColorStop(offset, color)
        ctx.globalAlpha = gradAlpha
        ctx.fillStyle = grad
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  } else {
    // Solid/dashed: tint only
    const tintAlpha = el.color ? tc.canvasBoxColorTintAlpha : tc.canvasBoxSolidTintAlpha
    if (tintAlpha > 0) {
      ctx.globalAlpha = tintAlpha
      ctx.fillStyle = el.color ?? tc.canvasBoxFill
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  const strokePath = () => {
    ctx.beginPath()
    if (needsSolidFill) {
      ctx.roundRect(el.x + lw, el.y + lw, el.width - lw * 2, el.height - lw * 2, tc.radiusLg)
    } else {
      ctx.roundRect(el.x, el.y, el.width, el.height, tc.radiusLg)
    }
  }

  // Separator ring — drawn before shadow is set so it stays clean
  if (el.color && tc.canvasBoxSeparator !== 'transparent') {
    const sep = 2
    ctx.beginPath()
    ctx.roundRect(el.x - sep, el.y - sep, el.width + sep * 2, el.height + sep * 2, tc.radiusLg + sep)
    ctx.strokeStyle = tc.canvasBoxSeparator
    ctx.lineWidth = lw
    ctx.setLineDash([])
    ctx.stroke()
  }

  // Glow shadow on the colored stroke only
  if (tc.canvasGlowBlur > 0) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = el.color ? tc.canvasGlowBlur * 2.3 : tc.canvasGlowBlur
  }

  // Colored stroke
  strokePath()
  ctx.strokeStyle = el.color ?? strokeColor
  ctx.lineWidth = lw
  ctx.setLineDash(boxStyle === 'dashed' ? [6, 4] : [])
  ctx.stroke()
  ctx.restore()

  if (el.text) {
    ctx.save()
    ctx.fillStyle = tc.canvasBoxText
    ctx.font = `600 ${fontSize}px ${tc.fontUi}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(el.text, el.x + 12, el.y + 10)
    ctx.restore()
  }

  if (selected) {
    const sx = el.x - 3, sy = el.y - 3, sw = el.width + 6, sh = el.height + 6
    ctx.save()
    ctx.fillStyle = tc.canvasMarqueeFill
    ctx.beginPath()
    ctx.roundRect(sx, sy, sw, sh, tc.radiusLg)
    ctx.fill()
    ctx.strokeStyle = tc.accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke()       // top:    tl → tr
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke()       // left:   tl → bl  (same anchor as top)
    ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // right:  tr → br
    ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // bottom: bl → br
    ctx.setLineDash([])
    ctx.restore()
  }

  if (selected && showHandles) drawHandles(ctx, el, tc)
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: import('../store/types').TextElement,
  selected: boolean,
  showHandles: boolean,
  _theme: Theme,
  fontSize: number,
  tc: ThemeColors
) {
  ctx.font = `${fontSize}px ${tc.fontUi}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  // Draw backing for readability on high-contrast backgrounds
  if (tc.canvasTextBg !== 'transparent') {
    const tw = ctx.measureText(el.text).width
    const th = fontSize * 1.2
    ctx.fillStyle = tc.canvasTextBg
    ctx.fillRect(el.x - 3, el.y - 2, tw + 6, th + 4)
  }
  ctx.fillStyle = el.color ?? tc.canvasTextStrong
  ctx.fillText(el.text, el.x, el.y)

  if (selected) {
    const metrics = ctx.measureText(el.text)
    const sx = el.x - 4, sy = el.y - 4, sw = metrics.width + 8, sh = fontSize * 1.2 + 8
    ctx.save()
    ctx.fillStyle = tc.canvasMarqueeFill
    ctx.fillRect(sx, sy, sw, sh)
    ctx.strokeStyle = tc.accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke()       // top:    tl → tr
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke()       // left:   tl → bl  (same anchor as top)
    ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // right:  tr → br
    ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.stroke() // bottom: bl → br
    ctx.setLineDash([])
    ctx.restore()

    if (showHandles) {
      drawHandles(ctx, { x: sx, y: sy, width: sw, height: sh }, tc)
    }
  }
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: { x: number; y: number; width: number; height: number },
  tc: ThemeColors
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

  ctx.fillStyle = tc.handleFill
  ctx.strokeStyle = tc.accent
  ctx.lineWidth = 1.5

  for (const [hx, hy] of positions) {
    ctx.beginPath()
    ctx.arc(hx, hy, handleSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

// ── Connection rendering ──────────────────────────────────────────────────────

function elementBounds(el: DiagramElement): { width: number; height: number } {
  if (el.type === 'text') return measureTextElement(el.text, el.fontSize)
  return { width: el.width, height: el.height }
}

function elementCenter(el: DiagramElement) {
  const { width, height } = elementBounds(el)
  return { x: el.x + width / 2, y: el.y + height / 2 }
}

function bboxEdgePoint(
  el: DiagramElement,
  from: { x: number; y: number }
): { x: number; y: number } {
  const { width, height } = elementBounds(el)
  const cx = el.x + width / 2
  const cy = el.y + height / 2
  const dx = from.x - cx
  const dy = from.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const hw = width / 2 + 4
  const hh = height / 2 + 4
  const sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity
  const sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(sx, sy)
  return { x: cx + dx * t, y: cy + dy * t }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string,
  connStyle: import('../store/types').ConnectionStyle = 'solid',
  lineWidth = 1.5
) {
  const headLen = 10
  const angle = Math.atan2(y2 - y1, x2 - x1)

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth

  if (connStyle === 'dashed') {
    ctx.setLineDash([8, 5])
  } else if (connStyle === 'animated') {
    ctx.setLineDash([8, 5])
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
  _theme: string,
  fontSize: number,
  tc: ThemeColors
) {
  const elMap = new Map(elements.map((e) => [e.id, e]))

  for (const conn of connections) {
    const from = elMap.get(conn.fromId)
    const to = elMap.get(conn.toId)
    if (!from || !to) continue

    const start = bboxEdgePoint(from, elementCenter(to))
    const end = bboxEdgePoint(to, elementCenter(from))
    const selected = conn.id === selectedConnectionId
    const color = conn.color ?? (selected ? tc.accent : tc.canvasConnection)

    // Separator pass — solid white outline beneath colored arrows, always solid regardless of style
    if (conn.color && tc.canvasConnectionSeparator !== 'transparent') {
      drawArrow(ctx, start.x, start.y, end.x, end.y, tc.canvasConnectionSeparator, 'solid', 6)
    }

    ctx.save()
    if (selected && tc.canvasGlowBlur > 0) {
      ctx.shadowColor = conn.color ?? tc.accent
      ctx.shadowBlur = 10
    }
    drawArrow(ctx, start.x, start.y, end.x, end.y, color, conn.style ?? 'solid')
    ctx.restore()

    if (conn.label) {
      const mx = (start.x + end.x) / 2
      const my = (start.y + end.y) / 2
      ctx.save()
      ctx.font = `${Math.max(10, fontSize - 2)}px ${tc.fontUi}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const tw = ctx.measureText(conn.label).width
      // Background behind label for readability
      const labelBg = (tc.canvasLabelBg && tc.canvasLabelBg !== 'transparent')
        ? tc.canvasLabelBg
        : (tc.canvasTextBg !== 'transparent' ? tc.canvasTextBg : null)
      if (labelBg) {
        const labelFontSize = Math.max(10, fontSize - 2)
        const th = labelFontSize * 1.2
        const px = 8
        const py = 4
        ctx.fillStyle = labelBg
        ctx.beginPath()
        ctx.roundRect(mx - tw / 2 - px, my - th / 2 - py, tw + px * 2, th + py * 2, tc.radiusSm)
        ctx.fill()
      }
      ctx.fillStyle = conn.color ?? tc.canvasLabelText
      ctx.fillText(conn.label, mx, my)
      ctx.restore()
    }
  }
}

function drawConnectionPreview(
  ctx: CanvasRenderingContext2D,
  fromEl: DiagramElement,
  previewPos: { x: number; y: number },
  _theme: string,
  tc: ThemeColors
) {
  const start = bboxEdgePoint(fromEl, previewPos)
  drawArrow(ctx, start.x, start.y, previewPos.x, previewPos.y, tc.canvasConnectionPreview, 'dashed')
}

function drawMarquee(
  ctx: CanvasRenderingContext2D,
  rect: { x1: number; y1: number; x2: number; y2: number },
  _theme: string,
  tc: ThemeColors
) {
  const { x1, y1, x2, y2 } = rect
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1)
  const h = Math.abs(y2 - y1)
  ctx.save()
  ctx.fillStyle = tc.canvasMarqueeFill
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = tc.accent
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1, y2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x2, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x1, y2)
  ctx.lineTo(x2, y2)
  ctx.stroke()
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
  boxDrawPreview: { x1: number; y1: number; x2: number; y2: number } | null,
  dpr: number,
  cssW: number,
  cssH: number,
  theme: string,
  defaultFontSize: number
) {
  const tc = getThemeColors()

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cssW * dpr, cssH * dpr)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const m = buildViewportMatrix(vp)
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f)

  drawGrid(ctx, vp, cssW, cssH, tc)
  drawOriginMarker(ctx, vp, tc)

  // Draw elements first, then connections on top
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
      drawIconElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc)
    } else if (el.type === 'text') {
      drawTextElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc)
    } else if (el.type === 'box') {
      drawBoxElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc)
    }
    ctx.restore()
  }

  drawConnections(ctx, connections, elements, selectedConnectionId, theme, defaultFontSize, tc)

  if (connectingFromId && connectionPreviewPos) {
    const fromEl = elements.find((e) => e.id === connectingFromId)
    if (fromEl) drawConnectionPreview(ctx, fromEl, connectionPreviewPos, theme, tc)
  }

  if (marqueeRect) drawMarquee(ctx, marqueeRect, theme, tc)
  if (boxDrawPreview) drawMarquee(ctx, boxDrawPreview, theme, tc)
}
