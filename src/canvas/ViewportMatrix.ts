import type { ViewportState } from '../store/types'

export function buildViewportMatrix(vp: ViewportState): DOMMatrix {
  const m = new DOMMatrix()
  m.translateSelf(vp.panX, vp.panY)
  m.rotateSelf(0, 0, vp.rotation * (180 / Math.PI))
  m.scaleSelf(vp.zoom, vp.zoom)
  return m
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  vp: ViewportState
): { x: number; y: number } {
  const inv = buildViewportMatrix(vp).inverse()
  const pt = inv.transformPoint(new DOMPoint(screenX, screenY))
  return { x: pt.x, y: pt.y }
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  vp: ViewportState
): { x: number; y: number } {
  const m = buildViewportMatrix(vp)
  const pt = m.transformPoint(new DOMPoint(worldX, worldY))
  return { x: pt.x, y: pt.y }
}

export interface GestureDeltaInput {
  deltaRotation: number
  deltaZoom: number
  deltaPanX: number
  deltaPanY: number
  originX: number
  originY: number
}

/**
 * Apply a gesture delta to the viewport.
 * The key math: keep the world point under (originX, originY) fixed after the transform.
 */
export function applyGestureDelta(vp: ViewportState, delta: GestureDeltaInput): ViewportState {
  const { deltaRotation, deltaZoom, deltaPanX, deltaPanY, originX, originY } = delta

  const worldOrigin = screenToWorld(originX, originY, vp)

  const newZoom = Math.max(0.05, Math.min(30, vp.zoom * deltaZoom))
  const newRotation = vp.rotation + deltaRotation

  const cosR = Math.cos(newRotation)
  const sinR = Math.sin(newRotation)

  // Solve: origin = pan + rotate(worldOrigin) * newZoom
  const newPanX =
    originX - (worldOrigin.x * cosR - worldOrigin.y * sinR) * newZoom + deltaPanX
  const newPanY =
    originY - (worldOrigin.x * sinR + worldOrigin.y * cosR) * newZoom + deltaPanY

  return { panX: newPanX, panY: newPanY, zoom: newZoom, rotation: newRotation }
}

/**
 * Reset rotation to 0 while keeping the canvas center fixed on the same world point.
 * Pass the canvas CSS width/height so we can compute the center.
 */
export function resetRotation(vp: ViewportState, cssW: number, cssH: number): ViewportState {
  if (vp.rotation === 0) return vp
  return applyGestureDelta(vp, {
    deltaRotation: -vp.rotation,
    deltaZoom: 1,
    deltaPanX: 0,
    deltaPanY: 0,
    originX: cssW / 2,
    originY: cssH / 2,
  })
}
