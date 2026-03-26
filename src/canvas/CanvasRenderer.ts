import type { DiagramElement, ViewportState, Theme, ConnectionElement, BoxElement } from '../store/types'
import { buildViewportMatrix } from './ViewportMatrix'
import { getIconImage, loadIcon, themeToHex } from '../icons/iconifyClient'
import { getThemeColors, type ThemeColors } from '../themes/themeColors'
import { measureTextElement, parseMarkdownLine, segmentFont, measureMarkdownLine, TEXT_PAD_X, TEXT_PAD_Y, TEXT_LINE_H } from './textMetrics'
import { getCurveOffset, getIconAvoidanceOffset, curveControlPoint as connCurveControlPoint, quadBezierEndAngle as connQuadBezierEndAngle, quadBezierPoint as connQuadBezierPoint, smoothCurveControlPoints, cubicBezierEndAngle, cubicBezierPoint } from './connectionPath'
import type { ConnectionRouting } from '../store/types'
import { resolveColorForBackground } from '../themes/colorNames'

const GRID_SIZE = 40

/** Resolve an element/connection color against the canvas background for visibility. */
function resolveColor(color: string | undefined, tc: ThemeColors): string | undefined {
  if (!color) return undefined
  return resolveColorForBackground(color, tc.canvasBg)
}

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
  const resolved = resolveColor(el.color, tc)
  const colorKey = resolved ?? theme
  // Always ensure the correct color variant is loading
  loadIcon(el.iconName, colorKey)
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
    ctx.fillStyle = resolved ?? tc.canvasLabelText
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
      drawHandles(ctx, el, tc, true) // icons: corners only
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
  tc: ThemeColors,
  hovered = false,
) {
  const boxStyle = el.style ?? 'solid'
  const resolved = resolveColor(el.color, tc)
  const glowColor = resolved ?? tc.canvasBoxGlow
  const strokeColor = resolved ?? tc.canvasBoxStroke

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
    const baseAlpha = resolved ? tc.canvasBoxColorFilledAlpha : tc.canvasBoxFilledBaseAlpha
    if (baseAlpha > 0) {
      ctx.globalAlpha = baseAlpha
      ctx.fillStyle = resolved ?? tc.canvasBoxFill
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // Gradient overlay
    if (tc.canvasBoxGradientStops) {
      const gradAlpha = resolved ? tc.canvasBoxColorGradientAlpha : tc.canvasBoxGradientAlpha
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
    const tintAlpha = resolved ? tc.canvasBoxColorTintAlpha : tc.canvasBoxSolidTintAlpha
    if (tintAlpha > 0) {
      ctx.globalAlpha = tintAlpha
      ctx.fillStyle = resolved ?? tc.canvasBoxFill
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
  if (resolved && tc.canvasBoxSeparator !== 'transparent') {
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
    const baseBlur = resolved ? tc.canvasGlowBlur * 2.3 : tc.canvasGlowBlur
    ctx.shadowColor = resolved ?? glowColor
    ctx.shadowBlur = hovered ? baseBlur + 8 : baseBlur
  }

  // Colored stroke
  strokePath()
  ctx.strokeStyle = resolved ?? strokeColor
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
  const lines = el.text.split('\n')
  const lineH = fontSize * TEXT_LINE_H

  // Compute display bounds fresh from content (guards against stale stored dimensions)
  const parsedLines = lines.map((l) => parseMarkdownLine(l || ' '))
  const maxLineW = Math.max(...parsedLines.map((segs) => measureMarkdownLine(ctx, segs, fontSize, tc.fontUi)))
  const w = Math.max(120, maxLineW + TEXT_PAD_X * 2)
  const h = Math.max(40, lines.length * lineH + TEXT_PAD_Y * 2)

  // Card background
  ctx.fillStyle = tc.canvasLabelBg
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, w, h, tc.radiusMd)
  ctx.fill()

  // Card border
  const resolved = resolveColor(el.color, tc)
  ctx.strokeStyle = resolved ?? tc.canvasBoxStroke
  ctx.lineWidth = tc.canvasStrokeWidth
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, w, h, tc.radiusMd)
  ctx.stroke()

  // Text lines with markdown rendering
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  parsedLines.forEach((segs, i) => {
    let xPos = el.x + TEXT_PAD_X
    const yPos = el.y + TEXT_PAD_Y + i * lineH
    for (const seg of segs) {
      ctx.font = segmentFont(seg, fontSize, tc.fontUi)
      ctx.fillStyle = resolved ?? tc.canvasLabelText
      ctx.fillText(seg.text, xPos, yPos)
      xPos += ctx.measureText(seg.text).width
    }
  })

  if (selected) {
    const sx = el.x - 3, sy = el.y - 3, sw = w + 6, sh = h + 6
    ctx.save()
    ctx.fillStyle = tc.canvasMarqueeFill
    ctx.beginPath()
    ctx.roundRect(sx, sy, sw, sh, tc.radiusMd)
    ctx.fill()
    ctx.strokeStyle = tc.accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: { x: number; y: number; width: number; height: number },
  tc: ThemeColors,
  cornersOnly = false
) {
  const handleSize = 7
  const allPositions: [number, number][] = [
    [el.x,                    el.y],                    // 0 TL
    [el.x + el.width / 2,     el.y],                    // 1 TM
    [el.x + el.width,         el.y],                    // 2 TR
    [el.x + el.width,         el.y + el.height / 2],   // 3 MR
    [el.x + el.width,         el.y + el.height],        // 4 BR
    [el.x + el.width / 2,     el.y + el.height],        // 5 BM
    [el.x,                    el.y + el.height],        // 6 BL
    [el.x,                    el.y + el.height / 2],   // 7 ML
  ]
  const positions = cornersOnly ? allPositions.filter((_, i) => i % 2 === 0) : allPositions

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
  lineWidth = 1.5,
  curveOffset = 0,
  routing: ConnectionRouting = 'straight'
) {
  const headLen = 10

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
  let angle: number

  if (routing === 'curve' && curveOffset === 0) {
    const { cp1x, cp1y, cp2x, cp2y } = smoothCurveControlPoints(x1, y1, x2, y2, 0)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2)
    angle = cubicBezierEndAngle(cp2x, cp2y, x2, y2)
  } else if (curveOffset !== 0) {
    const { cx, cy } = connCurveControlPoint(x1, y1, x2, y2, curveOffset)
    ctx.quadraticCurveTo(cx, cy, x2, y2)
    angle = connQuadBezierEndAngle(cx, cy, x2, y2)
  } else {
    ctx.lineTo(x2, y2)
    angle = Math.atan2(y2 - y1, x2 - x1)
  }
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
  tc: ThemeColors,
  connectedConnectionIds: Set<string> | null = null,
  routing: ConnectionRouting = 'straight',
  hoveredConnectionId: string | null = null,
) {
  const elMap = new Map(elements.map((e) => [e.id, e]))
  // Collect icon elements for avoidance routing
  const iconObstacles = elements.filter((e) => e.type === 'icon')
  // Collect labels for deferred drawing (allows overlap detection)
  const pendingLabels: { connId: string; fromId: string; toId: string; text: string; x: number; y: number; hw: number; hh: number; color: string; dimmed: boolean }[] = []

  const DIM_ALPHA = 0.25

  for (const conn of connections) {
    const from = elMap.get(conn.fromId)
    const to = elMap.get(conn.toId)
    if (!from || !to) continue

    const dimmed = connectedConnectionIds !== null && !connectedConnectionIds.has(conn.id)

    const biOffset = getCurveOffset(conn, connections)
    const fromCenter = elementCenter(from)
    const toCenter = elementCenter(to)

    const fromBounds = elementBounds(from)
    const toBounds = elementBounds(to)
    const avoidIcons = iconObstacles.filter((e) => {
      if (e.id === conn.fromId || e.id === conn.toId) return false
      const PAD = 10
      const overlapsFrom = e.x < from.x + fromBounds.width + PAD && e.x + e.width > from.x - PAD
        && e.y < from.y + fromBounds.height + PAD && e.y + e.height > from.y - PAD
      const overlapsTo = e.x < to.x + toBounds.width + PAD && e.x + e.width > to.x - PAD
        && e.y < to.y + toBounds.height + PAD && e.y + e.height > to.y - PAD
      return !overlapsFrom && !overlapsTo
    })
    const avoidOffset = avoidIcons.length > 0
      ? getIconAvoidanceOffset(fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, avoidIcons)
      : 0
    const offset = biOffset + avoidOffset

    // Resolve endpoints
    let aimFrom: { x: number; y: number } = toCenter
    let aimTo: { x: number; y: number } = fromCenter
    if (offset !== 0) {
      const cp = connCurveControlPoint(fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, offset)
      aimFrom = { x: cp.cx, y: cp.cy }
      aimTo = { x: cp.cx, y: cp.cy }
    }
    let start: { x: number; y: number }
    let end: { x: number; y: number }
    if (offset !== 0) {
      start = bboxEdgePoint(from, aimFrom)
      end = bboxEdgePoint(to, aimTo)
    } else {
      const s0 = bboxEdgePoint(from, aimFrom)
      end = bboxEdgePoint(to, s0)
      start = bboxEdgePoint(from, end)
    }
    const selected = conn.id === selectedConnectionId
    const hovered = conn.id === hoveredConnectionId && !selected
    const resolvedConn = resolveColor(conn.color, tc)
    const color = resolvedConn ?? (selected ? tc.accent : tc.canvasConnection)

    // Separator pass — solid white outline beneath colored arrows, always solid regardless of style
    if (resolvedConn && tc.canvasConnectionSeparator !== 'transparent') {
      ctx.save()
      if (dimmed) ctx.globalAlpha = DIM_ALPHA
      drawArrow(ctx, start.x, start.y, end.x, end.y, tc.canvasConnectionSeparator, 'solid', 6, offset, routing)
      ctx.restore()
    }

    ctx.save()
    if (dimmed) ctx.globalAlpha = DIM_ALPHA
    if (selected && tc.canvasGlowBlur > 0) {
      ctx.shadowColor = resolvedConn ?? tc.accent
      ctx.shadowBlur = 10
    } else if (hovered && tc.canvasGlowBlur > 0) {
      ctx.shadowColor = resolvedConn ?? tc.accent
      ctx.shadowBlur = 8
    }
    drawArrow(ctx, start.x, start.y, end.x, end.y, color, conn.style ?? 'solid', 1.5, offset, routing)
    ctx.restore()

    if (conn.label) {
      // Compute label position at midpoint of path
      let labelPos: { x: number; y: number }
      if (routing === 'curve' && offset === 0) {
        const { cp1x, cp1y, cp2x, cp2y } = smoothCurveControlPoints(start.x, start.y, end.x, end.y, 0)
        labelPos = cubicBezierPoint(start.x, start.y, cp1x, cp1y, cp2x, cp2y, end.x, end.y, 0.5)
      } else if (offset !== 0) {
        const cp = connCurveControlPoint(start.x, start.y, end.x, end.y, offset)
        labelPos = connQuadBezierPoint(start.x, start.y, cp.cx, cp.cy, end.x, end.y, 0.5)
      } else {
        labelPos = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      }

      ctx.save()
      ctx.font = `${Math.max(10, fontSize - 2)}px ${tc.fontUi}`
      const tw = ctx.measureText(conn.label).width
      const labelFontSize = Math.max(10, fontSize - 2)
      const th = labelFontSize * 1.2
      const px = 8
      const py = 4

      pendingLabels.push({
        connId: conn.id,
        fromId: conn.fromId,
        toId: conn.toId,
        text: conn.label,
        x: labelPos.x,
        y: labelPos.y,
        hw: tw / 2 + px,  // half-width of label box
        hh: th / 2 + py,  // half-height of label box
        color: resolvedConn ?? tc.canvasLabelText,
        dimmed,
      })
      ctx.restore()
    }
  }

  // Push apart overlapping labels on bidirectional connections
  for (let i = 0; i < pendingLabels.length; i++) {
    for (let j = i + 1; j < pendingLabels.length; j++) {
      const a = pendingLabels[i]
      const b = pendingLabels[j]
      // Only push apart labels that share the same two elements (bidirectional)
      const isBiPair = (a.fromId === b.toId && a.toId === b.fromId)
      if (!isBiPair) continue

      // Check if bounding boxes overlap
      const overlapX = a.hw + b.hw - Math.abs(a.x - b.x)
      const overlapY = a.hh + b.hh - Math.abs(a.y - b.y)
      if (overlapX <= 0 || overlapY <= 0) continue

      // Push apart by the minimum amount to clear the overlap
      const GAP = 4
      if (overlapX < overlapY) {
        // Less overlap horizontally — push apart on X axis
        const push = (overlapX + GAP) / 2
        if (a.x <= b.x) { a.x -= push; b.x += push }
        else { a.x += push; b.x -= push }
      } else {
        // Less overlap vertically — push apart on Y axis
        const push = (overlapY + GAP) / 2
        if (a.y <= b.y) { a.y -= push; b.y += push }
        else { a.y += push; b.y -= push }
      }
    }
  }

  // Draw all labels
  for (const label of pendingLabels) {
    ctx.save()
    if (label.dimmed) ctx.globalAlpha = DIM_ALPHA
    ctx.font = `${Math.max(10, fontSize - 2)}px ${tc.fontUi}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelBg = (tc.canvasLabelBg && tc.canvasLabelBg !== 'transparent')
      ? tc.canvasLabelBg
      : (tc.canvasTextBg !== 'transparent' ? tc.canvasTextBg : null)
    if (labelBg) {
      ctx.fillStyle = labelBg
      ctx.beginPath()
      ctx.roundRect(label.x - label.hw, label.y - label.hh, label.hw * 2, label.hh * 2, tc.radiusSm)
      ctx.fill()
    }
    ctx.fillStyle = label.color
    ctx.fillText(label.text, label.x, label.y)
    ctx.restore()
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
  defaultFontSize: number,
  connectCandidateId: string | null = null,
  pendingConnectionStyle: import('../store/types').ConnectionStyle = 'solid',
  connectionRouting: ConnectionRouting = 'straight',
  hoveredElementId: string | null = null,
  hoveredConnectionId: string | null = null,
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

  // Compute the set of element IDs connected to the selection (for dim effect)
  let connectedIdSet: Set<string> | null = null
  let connectedConnectionIds: Set<string> | null = null
  if (selectedIds.length > 0) {
    connectedIdSet = new Set(selectedIds)
    connectedConnectionIds = new Set<string>()
    for (const conn of connections) {
      if (selectedIdSet.has(conn.fromId) || selectedIdSet.has(conn.toId)) {
        connectedIdSet.add(conn.fromId)
        connectedIdSet.add(conn.toId)
        connectedConnectionIds.add(conn.id)
      }
    }
  } else if (selectedConnectionId) {
    const selConn = connections.find((c) => c.id === selectedConnectionId)
    if (selConn) {
      connectedIdSet = new Set([selConn.fromId, selConn.toId])
      connectedConnectionIds = new Set([selectedConnectionId])
    }
  }

  const DIM_ALPHA = 0.25

  const sorted = [...elements].sort((a, b) => {
    const aSelected = selectedIdSet.has(a.id) ? 1 : 0
    const bSelected = selectedIdSet.has(b.id) ? 1 : 0
    return aSelected - bSelected
  })

  for (const el of sorted) {
    ctx.save()
    // Dim elements not connected to the selection
    if (connectedIdSet && !connectedIdSet.has(el.id)) {
      ctx.globalAlpha = DIM_ALPHA
    }
    const sel = selectedIds.includes(el.id)
    const hovered = el.id === hoveredElementId && !sel
    const showHandles = sel && selectedIds.length === 1
    // Hover glow — applied here for icons/text (boxes handle it internally)
    if (hovered && el.type !== 'box' && tc.canvasGlowBlur > 0) {
      ctx.shadowColor = resolveColor(el.color, tc) ?? tc.accent
      ctx.shadowBlur = 8
    }
    if (el.type === 'icon') {
      drawIconElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc)
    } else if (el.type === 'text') {
      drawTextElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc)
    } else if (el.type === 'box') {
      drawBoxElement(ctx, el, sel, showHandles, theme, defaultFontSize, tc, hovered)
    }
    ctx.restore()
  }

  drawConnections(ctx, connections, elements, selectedConnectionId, theme, defaultFontSize, tc, connectedConnectionIds, connectionRouting, hoveredConnectionId)

  // Highlight connect candidate with connection-preview color outline
  if (connectCandidateId) {
    const candEl = elements.find((e) => e.id === connectCandidateId)
    if (candEl) {
      const { width, height } = elementBounds(candEl)
      const sx = candEl.x - 3, sy = candEl.y - 3, sw = width + 6, sh = height + 6
      ctx.save()
      ctx.fillStyle = tc.canvasMarqueeFill
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, tc.radiusMd); ctx.fill()
      ctx.strokeStyle = tc.canvasConnectCandidate
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  if (connectingFromId && connectionPreviewPos) {
    const fromEl = elements.find((e) => e.id === connectingFromId)
    if (fromEl) {
      // Snap to candidate element's edge when hovering over one
      const candEl = connectCandidateId ? elements.find((e) => e.id === connectCandidateId) : null
      const targetPos = candEl ? bboxEdgePoint(candEl, elementCenter(fromEl)) : connectionPreviewPos
      const startPos = candEl ? bboxEdgePoint(fromEl, elementCenter(candEl)) : bboxEdgePoint(fromEl, connectionPreviewPos)
      const arrowColor = candEl ? tc.canvasConnectCandidate : tc.canvasConnectionPreview
      drawArrow(ctx, startPos.x, startPos.y, targetPos.x, targetPos.y, arrowColor, pendingConnectionStyle, 1.5, 0, connectionRouting)
    }
  }

  if (marqueeRect) drawMarquee(ctx, marqueeRect, theme, tc)
  if (boxDrawPreview) drawMarquee(ctx, boxDrawPreview, theme, tc)
}
