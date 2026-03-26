import type { ConnectionElement } from '../store/types'

/**
 * Computes the perpendicular curve offset for a connection.
 * Returns 0 for normal connections, or a positive/negative offset
 * for bidirectional connections so they curve apart.
 */
export function getCurveOffset(
  conn: ConnectionElement,
  connections: ConnectionElement[]
): number {
  const OFFSET = 25
  // Check if there's a reverse connection (B→A when this is A→B)
  const hasReverse = connections.some(
    (c) => c.id !== conn.id && c.fromId === conn.toId && c.toId === conn.fromId
  )
  if (!hasReverse) return 0
  // Use consistent side assignment: the connection whose fromId is "smaller" curves one way
  return conn.fromId < conn.toId ? OFFSET : -OFFSET
}

/**
 * Computes the quadratic bezier control point for a curved connection.
 * The control point is offset perpendicular to the midpoint of the straight line.
 */
export function curveControlPoint(
  x1: number, y1: number,
  x2: number, y2: number,
  offset: number
): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  if (offset === 0) return { cx: mx, cy: my }
  // Always compute perpendicular from the same canonical direction
  // so that A→B and B→A get opposite curves instead of the same one.
  // The offset sign (+/-) already encodes which side each connection should curve to.
  // We use a consistent direction: min(x1,y1)→max(x2,y2) lexicographically.
  let dx = x2 - x1
  let dy = y2 - y1
  // Canonical direction: flip if start > end (ensures same perpendicular for both directions)
  if (x1 > x2 || (x1 === x2 && y1 > y2)) {
    dx = -dx
    dy = -dy
  }
  const len = Math.hypot(dx, dy)
  if (len === 0) return { cx: mx, cy: my }
  // Normal vector (perpendicular, rotated 90° CCW)
  const nx = -dy / len
  const ny = dx / len
  return { cx: mx + nx * offset, cy: my + ny * offset }
}

/**
 * Point on a quadratic bezier at parameter t.
 */
export function quadBezierPoint(
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  }
}

/**
 * Tangent angle at the end of a quadratic bezier (t=1).
 * Used for arrow head direction.
 */
export function quadBezierEndAngle(
  cx: number, cy: number,
  x2: number, y2: number
): number {
  return Math.atan2(y2 - cy, x2 - cx)
}

/**
 * Minimum distance from a point to a quadratic bezier curve.
 * Approximates by sampling the curve.
 */
export function distToQuadBezier(
  px: number, py: number,
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  samples?: number
): number {
  if (samples === undefined) {
    const arcEstimate = (Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy)
      + Math.hypot(x2 - x1, y2 - y1)) / 2
    samples = Math.max(20, Math.ceil(arcEstimate / 8))
  }
  let minDist = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = quadBezierPoint(x1, y1, cx, cy, x2, y2, t)
    const d = Math.hypot(px - pt.x, py - pt.y)
    if (d < minDist) minDist = d
  }
  return minDist
}

/**
 * Checks if a quadratic bezier curve passes through an obstacle's bounding box.
 */
function curveHitsRect(
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  obs: { x: number; y: number; width: number; height: number },
  margin: number,
  samples = 24
): boolean {
  const left = obs.x - margin
  const right = obs.x + obs.width + margin
  const top = obs.y - margin
  const bottom = obs.y + obs.height + margin
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = quadBezierPoint(x1, y1, cx, cy, x2, y2, t)
    if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) {
      return true
    }
  }
  return false
}

/**
 * Computes a curve offset that routes the connection around obstructing icon elements.
 * Uses the same canonical normal direction as curveControlPoint so offsets can be summed.
 * Iteratively checks the resulting curve to catch icons the curve swings into.
 * Returns 0 if no avoidance is needed.
 */
export function getIconAvoidanceOffset(
  fromCx: number, fromCy: number,
  toCx: number, toCy: number,
  obstacles: { x: number; y: number; width: number; height: number }[]
): number {
  let dx = toCx - fromCx
  let dy = toCy - fromCy
  // Use same canonical direction as curveControlPoint
  if (fromCx > toCx || (fromCx === toCx && fromCy > toCy)) {
    dx = -dx
    dy = -dy
  }
  const len = Math.hypot(dx, dy)
  if (len < 1) return 0

  // Canonical perpendicular normal (same as curveControlPoint: CCW rotation)
  const nx = -dy / len
  const ny = dx / len

  // Original line direction for along-line projection (always from→to)
  const origDx = toCx - fromCx
  const origDy = toCy - fromCy
  const origUx = origDx / len
  const origUy = origDy / len

  const MARGIN = 20
  const activeSet = new Set<number>()
  let currentOffset = 0

  // Iteratively discover obstacles: first check the straight line, then check
  // the resulting curve to catch icons the curve might swing into.
  for (let pass = 0; pass < 4; pass++) {
    let foundNew = false

    if (pass === 0) {
      // First pass: check which obstacles the straight line intersects
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i]
        const ocx = obs.x + obs.width / 2
        const ocy = obs.y + obs.height / 2
        const ex = ocx - fromCx
        const ey = ocy - fromCy
        const along = ex * origUx + ey * origUy
        if (along < -obs.width || along > len + obs.width) continue
        const perp = ex * nx + ey * ny
        const projHalf = Math.abs(nx) * (obs.width / 2) + Math.abs(ny) * (obs.height / 2)
        if (Math.abs(perp) < projHalf + 5) {
          activeSet.add(i)
          foundNew = true
        }
      }
    } else {
      // Later passes: sample the current curve and check for new obstacles
      const cp = curveControlPoint(fromCx, fromCy, toCx, toCy, currentOffset)
      for (let i = 0; i < obstacles.length; i++) {
        if (activeSet.has(i)) continue
        if (curveHitsRect(fromCx, fromCy, cp.cx, cp.cy, toCx, toCy, obstacles[i], 8)) {
          activeSet.add(i)
          foundNew = true
        }
      }
    }

    if (!foundNew && pass > 0) break
    if (activeSet.size === 0) return 0

    // Compute minimum offset to clear all active obstacles
    let posMin = 0
    let negMin = 0

    for (const i of activeSet) {
      const obs = obstacles[i]
      const ocx = obs.x + obs.width / 2
      const ocy = obs.y + obs.height / 2
      const ex = ocx - fromCx
      const ey = ocy - fromCy
      const along = ex * origUx + ey * origUy
      const perp = ex * nx + ey * ny
      const projHalf = Math.abs(nx) * (obs.width / 2) + Math.abs(ny) * (obs.height / 2)

      // Curve displacement at parameter t: 2*t*(1-t)*offset
      const t = Math.max(0.05, Math.min(0.95, along / len))
      const curveFactor = 2 * t * (1 - t)
      if (curveFactor < 0.01) continue

      // To avoid by curving positive: curve must exceed the obstacle's positive edge
      const posRequired = (perp + projHalf + MARGIN) / curveFactor
      // To avoid by curving negative: curve must go below the obstacle's negative edge
      const negRequired = (perp - projHalf - MARGIN) / curveFactor

      if (posRequired > 0) posMin = Math.max(posMin, posRequired)
      if (negRequired < 0) negMin = Math.min(negMin, negRequired)
    }

    if (posMin === 0 && negMin === 0) return 0

    // Choose direction requiring less offset
    currentOffset = posMin === 0 ? negMin
      : negMin === 0 ? posMin
      : posMin <= Math.abs(negMin) ? posMin : negMin
  }

  return currentOffset
}

// ── Smooth cubic curve routing ─────────────────────────────────────────────────

/**
 * Compute cubic bezier control points for smooth curve routing.
 * Control points extend along the dominant axis for a natural-looking curve.
 */
export function smoothCurveControlPoints(
  x1: number, y1: number,
  x2: number, y2: number,
  offset: number
): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)
  const tension = Math.min(dist * 0.4, 100)

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number

  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx >= 0 ? 1 : -1
    cp1x = x1 + dir * tension
    cp1y = y1
    cp2x = x2 - dir * tension
    cp2y = y2
  } else {
    const dir = dy >= 0 ? 1 : -1
    cp1x = x1
    cp1y = y1 + dir * tension
    cp2x = x2
    cp2y = y2 - dir * tension
  }

  // Apply perpendicular offset for bidirectional separation
  if (offset !== 0 && dist > 0) {
    let ndx = dx, ndy = dy
    if (x1 > x2 || (x1 === x2 && y1 > y2)) { ndx = -ndx; ndy = -ndy }
    const nx = -ndy / dist
    const ny = ndx / dist
    cp1x += nx * offset
    cp1y += ny * offset
    cp2x += nx * offset
    cp2y += ny * offset
  }

  return { cp1x, cp1y, cp2x, cp2y }
}

/**
 * Point on a cubic bezier at parameter t.
 */
export function cubicBezierPoint(
  x1: number, y1: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x2: number, y2: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt * mt * mt * x1 + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * x2,
    y: mt * mt * mt * y1 + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * y2,
  }
}

/**
 * Tangent angle at the end of a cubic bezier (t=1).
 */
export function cubicBezierEndAngle(
  cp2x: number, cp2y: number,
  x2: number, y2: number
): number {
  return Math.atan2(y2 - cp2y, x2 - cp2x)
}

/**
 * Minimum distance from a point to a cubic bezier curve.
 */
export function distToCubicBezier(
  px: number, py: number,
  x1: number, y1: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x2: number, y2: number,
  samples?: number
): number {
  if (samples === undefined) {
    const arcEstimate = (Math.hypot(cp1x - x1, cp1y - y1) + Math.hypot(cp2x - cp1x, cp2y - cp1y)
      + Math.hypot(x2 - cp2x, y2 - cp2y) + Math.hypot(x2 - x1, y2 - y1)) / 2
    samples = Math.max(24, Math.ceil(arcEstimate / 8))
  }
  let minDist = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = cubicBezierPoint(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2, t)
    const d = Math.hypot(px - pt.x, py - pt.y)
    if (d < minDist) minDist = d
  }
  return minDist
}
