// Safari GestureEvent types (not in standard TypeScript DOM lib)
declare global {
  interface GestureEvent extends UIEvent {
    readonly rotation: number
    readonly scale: number
    readonly clientX: number
    readonly clientY: number
  }
}

export interface GestureDelta {
  deltaRotation: number // radians
  deltaZoom: number     // multiplicative (1 = no change)
  deltaPanX: number     // CSS pixels
  deltaPanY: number     // CSS pixels
  originX: number       // CSS pixels, gesture center
  originY: number
}

export interface GestureCallbacks {
  onGestureDelta: (delta: GestureDelta) => void
  onClick?: (x: number, y: number) => void
  onDragStart?: (x: number, y: number) => void
  onDragMove?: (dx: number, dy: number, x: number, y: number) => void
  onDragEnd?: (x: number, y: number) => void
}

interface PointerPos {
  x: number
  y: number
}

export class GestureController {
  private canvas: HTMLCanvasElement
  private callbacks: GestureCallbacks
  private activePointers = new Map<number, PointerPos>()

  // Two-pointer gesture state
  private lastTwoAngle = 0
  private lastTwoDist = 0
  private lastTwoCentroid: PointerPos = { x: 0, y: 0 }

  // Safari gesture state — when gesturechange fires, skip two-pointer calc
  private isSafariGesture = false
  private lastGestureRotation = 0
  private lastGestureScale = 1

  // Single-pointer drag state
  private isDragging = false
  private dragStartPos: PointerPos = { x: 0, y: 0 }
  private lastDragPos: PointerPos = { x: 0, y: 0 }
  private dragStartTime = 0

  // Space key pan
  private spaceHeld = false

  private canvasRect: DOMRect | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: GestureCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.attach()
  }

  invalidateRect() {
    this.canvasRect = null
  }

  private rect(): DOMRect {
    if (!this.canvasRect) this.canvasRect = this.canvas.getBoundingClientRect()
    return this.canvasRect
  }

  private rel(clientX: number, clientY: number): PointerPos {
    const r = this.rect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  private attach() {
    const c = this.canvas
    c.addEventListener('pointerdown', this.onPointerDown)
    c.addEventListener('pointermove', this.onPointerMove)
    c.addEventListener('pointerup', this.onPointerUp)
    c.addEventListener('pointercancel', this.onPointerUp)
    c.addEventListener('wheel', this.onWheel, { passive: false })
    // Safari-only gesture events
    c.addEventListener('gesturestart', this.onGestureStart as EventListener)
    c.addEventListener('gesturechange', this.onGestureChange as EventListener)
    c.addEventListener('gestureend', this.onGestureEnd as EventListener)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('resize', this.onResize)
  }

  detach() {
    const c = this.canvas
    c.removeEventListener('pointerdown', this.onPointerDown)
    c.removeEventListener('pointermove', this.onPointerMove)
    c.removeEventListener('pointerup', this.onPointerUp)
    c.removeEventListener('pointercancel', this.onPointerUp)
    c.removeEventListener('wheel', this.onWheel)
    c.removeEventListener('gesturestart', this.onGestureStart as EventListener)
    c.removeEventListener('gesturechange', this.onGestureChange as EventListener)
    c.removeEventListener('gestureend', this.onGestureEnd as EventListener)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('resize', this.onResize)
  }

  private onResize = () => {
    this.canvasRect = null
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      // Only engage space-pan if not in an input
      const target = e.target as Element
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        this.spaceHeld = true
        e.preventDefault()
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.spaceHeld = false
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    const pos = this.rel(e.clientX, e.clientY)
    this.activePointers.set(e.pointerId, pos)

    if (this.activePointers.size === 1) {
      this.isDragging = false
      this.dragStartPos = pos
      this.lastDragPos = pos
      this.dragStartTime = Date.now()
    } else if (this.activePointers.size === 2) {
      this.isDragging = false
      const [p1, p2] = Array.from(this.activePointers.values())
      this.lastTwoAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      this.lastTwoDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      this.lastTwoCentroid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) return
    const pos = this.rel(e.clientX, e.clientY)
    this.activePointers.set(e.pointerId, pos)

    if (this.activePointers.size === 1) {
      const dx = pos.x - this.lastDragPos.x
      const dy = pos.y - this.lastDragPos.y
      const totalMoved = Math.hypot(
        pos.x - this.dragStartPos.x,
        pos.y - this.dragStartPos.y
      )

      if (!this.isDragging && totalMoved > 4) {
        this.isDragging = true
        this.callbacks.onDragStart?.(this.dragStartPos.x, this.dragStartPos.y)
      }

      if (this.isDragging) {
        if (this.spaceHeld) {
          // Space+drag = pan
          this.callbacks.onGestureDelta({
            deltaRotation: 0,
            deltaZoom: 1,
            deltaPanX: dx,
            deltaPanY: dy,
            originX: pos.x,
            originY: pos.y,
          })
        } else {
          this.callbacks.onDragMove?.(dx, dy, pos.x, pos.y)
        }
      }

      this.lastDragPos = pos
    } else if (this.activePointers.size === 2 && !this.isSafariGesture) {
      const [p1, p2] = Array.from(this.activePointers.values())

      const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      let deltaRotation = currentAngle - this.lastTwoAngle
      // Normalize to [-π, π] to avoid jumps
      if (deltaRotation > Math.PI) deltaRotation -= 2 * Math.PI
      if (deltaRotation < -Math.PI) deltaRotation += 2 * Math.PI

      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const deltaZoom = this.lastTwoDist > 0 ? currentDist / this.lastTwoDist : 1

      const centroid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      const deltaPanX = centroid.x - this.lastTwoCentroid.x
      const deltaPanY = centroid.y - this.lastTwoCentroid.y

      this.callbacks.onGestureDelta({
        deltaRotation,
        deltaZoom,
        deltaPanX,
        deltaPanY,
        originX: centroid.x,
        originY: centroid.y,
      })

      this.lastTwoAngle = currentAngle
      this.lastTwoDist = currentDist
      this.lastTwoCentroid = centroid
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    const pos = this.rel(e.clientX, e.clientY)

    if (this.activePointers.size === 1) {
      if (this.isDragging) {
        if (!this.spaceHeld) {
          this.callbacks.onDragEnd?.(pos.x, pos.y)
        }
        this.isDragging = false
      } else {
        // It's a click
        const elapsed = Date.now() - this.dragStartTime
        const moved = Math.hypot(pos.x - this.dragStartPos.x, pos.y - this.dragStartPos.y)
        if (elapsed < 400 && moved < 8) {
          this.callbacks.onClick?.(pos.x, pos.y)
        }
      }
    }

    this.activePointers.delete(e.pointerId)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const pos = this.rel(e.clientX, e.clientY)

    if (e.altKey) {
      // Alt/Option + scroll = rotate canvas (works in Chrome, Firefox, Safari)
      const deltaRotation = e.deltaY * 0.004
      this.callbacks.onGestureDelta({
        deltaRotation,
        deltaZoom: 1,
        deltaPanX: 0,
        deltaPanY: 0,
        originX: pos.x,
        originY: pos.y,
      })
    } else if (e.ctrlKey) {
      // Trackpad pinch-to-zoom (macOS sends ctrlKey=true for pinch)
      const zoomFactor = Math.exp(-e.deltaY * 0.008)
      this.callbacks.onGestureDelta({
        deltaRotation: 0,
        deltaZoom: zoomFactor,
        deltaPanX: 0,
        deltaPanY: 0,
        originX: pos.x,
        originY: pos.y,
      })
    } else {
      // Trackpad two-finger scroll = pan
      this.callbacks.onGestureDelta({
        deltaRotation: 0,
        deltaZoom: 1,
        deltaPanX: -e.deltaX,
        deltaPanY: -e.deltaY,
        originX: pos.x,
        originY: pos.y,
      })
    }
  }

  private onGestureStart = (e: Event) => {
    e.preventDefault()
    const ge = e as GestureEvent
    this.isSafariGesture = true
    this.lastGestureRotation = ge.rotation
    this.lastGestureScale = ge.scale
  }

  private onGestureChange = (e: Event) => {
    e.preventDefault()
    const ge = e as GestureEvent
    const deltaRotation = (ge.rotation - this.lastGestureRotation) * (Math.PI / 180)
    const deltaZoom = this.lastGestureScale > 0 ? ge.scale / this.lastGestureScale : 1

    // Use the actual gesture position (GestureEvent has clientX/Y on Safari/macOS)
    const pos = this.rel(ge.clientX, ge.clientY)

    this.callbacks.onGestureDelta({
      deltaRotation,
      deltaZoom,
      deltaPanX: 0,
      deltaPanY: 0,
      originX: pos.x,
      originY: pos.y,
    })

    this.lastGestureRotation = ge.rotation
    this.lastGestureScale = ge.scale
  }

  private onGestureEnd = (e: Event) => {
    e.preventDefault()
    this.isSafariGesture = false
    this.lastGestureRotation = 0
    this.lastGestureScale = 1
  }
}
