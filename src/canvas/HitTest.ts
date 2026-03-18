import type { DiagramElement, ConnectionElement } from '../store/types'
import { measureTextElement } from './textMetrics'

function elBounds(el: DiagramElement): { width: number; height: number } {
  if (el.type === 'text') return measureTextElement(el.text, el.fontSize)
  return { width: el.width, height: el.height }
}

const HANDLE_RADIUS = 6

export type HitResult =
  | { kind: 'element'; id: string }
  | { kind: 'handle'; id: string; handle: number } // handle index 0-7
  | { kind: 'none' }

export function hitTest(
  elements: DiagramElement[],
  worldX: number,
  worldY: number,
  selectedId: string | null
): HitResult {
  // Check handles of selected element first
  if (selectedId) {
    const sel = elements.find((e) => e.id === selectedId)
    if (sel && sel.type !== 'text') {
      const { width, height } = elBounds(sel)
      const handleIdx = hitHandle({ x: sel.x, y: sel.y, width, height }, worldX, worldY)
      if (handleIdx >= 0) return { kind: 'handle', id: sel.id, handle: handleIdx }
    }
  }

  // Check elements in reverse order (top-most first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (hitElement(el, worldX, worldY, el.id === selectedId)) {
      return { kind: 'element', id: el.id }
    }
  }

  return { kind: 'none' }
}

function hitElement(el: DiagramElement, wx: number, wy: number, isSelected = false): boolean {
  const { width, height } = elBounds(el)
  if (el.type === 'box' && !isSelected) {
    const outer = 6
    const inner = 12
    const inOuter = wx >= el.x - outer && wx <= el.x + width + outer &&
                    wy >= el.y - outer && wy <= el.y + height + outer
    const inInner = wx > el.x + inner && wx < el.x + width - inner &&
                    wy > el.y + inner && wy < el.y + height - inner
    return inOuter && !inInner
  }
  const pad = 4
  return (
    wx >= el.x - pad &&
    wx <= el.x + width + pad &&
    wy >= el.y - pad &&
    wy <= el.y + height + pad
  )
}

/** Returns the id of the first connection whose line is within `threshold` world units of (wx, wy). */
export function hitTestConnection(
  connections: ConnectionElement[],
  elements: DiagramElement[],
  wx: number,
  wy: number,
  threshold = 8
): string | null {
  const elMap = new Map(elements.map((e) => [e.id, e]))
  for (const conn of connections) {
    const from = elMap.get(conn.fromId)
    const to = elMap.get(conn.toId)
    if (!from || !to) continue
    const { width: fw, height: fh } = elBounds(from)
    const { width: tw, height: th } = elBounds(to)
    const toC = { x: to.x + tw / 2, y: to.y + th / 2 }
    const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 }
    // edge points
    const p1 = bboxEdge(from, toC)
    const p2 = bboxEdge(to, fromC)
    if (distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= threshold) return conn.id
  }
  return null
}

function bboxEdge(el: DiagramElement, from: { x: number; y: number }) {
  const { width, height } = elBounds(el)
  const cx = el.x + width / 2, cy = el.y + height / 2
  const dx = from.x - cx, dy = from.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = width / 2 + 4, hh = height / 2 + 4
  const t = Math.min(
    Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity
  )
  return { x: cx + dx * t, y: cy + dy * t }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function hitHandle(
  el: { x: number; y: number; width: number; height: number },
  wx: number,
  wy: number
): number {
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

  for (let i = 0; i < positions.length; i++) {
    const [hx, hy] = positions[i]
    if (Math.hypot(wx - hx, wy - hy) <= HANDLE_RADIUS) return i
  }
  return -1
}

export function elementsInRect(
  elements: DiagramElement[],
  rect: { x: number; y: number; w: number; h: number }
): string[] {
  const { x, y, w, h } = rect
  const result: string[] = []
  for (const el of elements) {
    // Overlap check: two rects overlap if neither is fully outside the other
    const noOverlap =
      el.x + el.width < x ||
      el.x > x + w ||
      el.y + el.height < y ||
      el.y > y + h
    if (noOverlap) continue

    // For hollow boxes: don't select if the marquee is entirely inside the box
    // (marquee never touches the border lines)
    if (el.type === 'box') {
      const marqueeInsideBox =
        x >= el.x && x + w <= el.x + el.width &&
        y >= el.y && y + h <= el.y + el.height
      if (marqueeInsideBox) continue
    }

    result.push(el.id)
  }
  return result
}
