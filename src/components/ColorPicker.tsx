import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore, selectPrimaryId } from '../store/useAppStore'

// Default swatch first — must match the cycle order in DiagramCanvas 'c' key handler
const PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Cyan',    value: '#06b6d4' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Violet',  value: '#8b5cf6' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Sky',     value: '#38bdf8' },
]

const RADIUS = 54
const SWATCH = 26
const MARGIN = 90

// ── Color math ────────────────────────────────────────────────────────────────

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, max === 0 ? 0 : d / max, max]
}

function hsvToHex(h: number, s: number, v: number): string {
  const hi = h / 60
  const i = Math.floor(hi)
  const f = hi - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r: number, g: number, b: number
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    default: r = v; g = p; b = q; break
  }
  return '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// ── Main component ────────────────────────────────────────────────────────────

export function ColorPicker() {
  const {
    isColorPickerOpen, closeColorPicker, colorPickerPos,
    selectedConnectionId,
    updateElement, updateConnection,
    elements, connections,
  } = useAppStore()
  const selectedId = useAppStore(selectPrimaryId)
  const containerRef = useRef<HTMLDivElement>(null)
  const customPanelRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const activeId = selectedId ?? selectedConnectionId

  const [customOpen, setCustomOpen] = useState(false)
  const [hsv, setHsv] = useState<[number, number, number]>([220, 0.7, 0.9])
  const [hexInput, setHexInput] = useState('#6366f1')

  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2])

  useEffect(() => {
    if (!isColorPickerOpen) setCustomOpen(false)
  }, [isColorPickerOpen])

  const handleOutside = useCallback((e: MouseEvent) => {
    const ref = customOpen ? customPanelRef : containerRef
    if (ref.current && !ref.current.contains(e.target as Node)) {
      closeColorPicker()
      setCustomOpen(false)
    }
  }, [closeColorPicker, customOpen])

  useEffect(() => {
    if (!isColorPickerOpen) return
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('wheel', closeColorPicker, { passive: true })
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('wheel', closeColorPicker)
    }
  }, [isColorPickerOpen, handleOutside, closeColorPicker])

  // Arrow key cycling
  useEffect(() => {
    if (!isColorPickerOpen || !activeId || customOpen) return
    const cycle = PRESETS.map((p) => p.value)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); closeColorPicker(); return }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault(); e.stopPropagation()
      const s = useAppStore.getState()
      const primaryId = s.selectedIds[0] ?? null
      const current = (primaryId
        ? s.elements.find((el) => el.id === primaryId)?.color
        : s.connections.find((c) => c.id === s.selectedConnectionId)?.color) ?? ''
      const idx = cycle.indexOf(current)
      const next = e.key === 'ArrowRight'
        ? cycle[(idx + 1) % cycle.length]
        : cycle[(idx - 1 + cycle.length) % cycle.length]
      if (primaryId) s.updateElement(primaryId, { color: next || undefined })
      else if (s.selectedConnectionId) s.updateConnection(s.selectedConnectionId, { color: next || undefined })
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [isColorPickerOpen, activeId, customOpen])

  if (!isColorPickerOpen || !activeId) return null

  const isConn = !!selectedConnectionId
  const currentColor = isConn
    ? (connections.find((c) => c.id === selectedConnectionId)?.color ?? '')
    : (elements.find((e) => e.id === selectedId)?.color ?? '')
  if (!isConn && !elements.find((e) => e.id === selectedId)) return null

  const cx = Math.max(MARGIN, Math.min(window.innerWidth - MARGIN, colorPickerPos.x))
  const cy = Math.max(MARGIN, Math.min(window.innerHeight - MARGIN, colorPickerPos.y))

  const applyColor = (color: string) => {
    if (isConn) updateConnection(selectedConnectionId!, { color: color || undefined })
    else updateElement(selectedId!, { color: color || undefined })
  }

  const applyAndClose = (color: string) => {
    applyColor(color)
    closeColorPicker()
  }

  const openCustom = () => {
    const initial = currentColor || '#6366f1'
    setHsv(hexToHsv(initial))
    setHexInput(initial)
    setCustomOpen(true)
  }

  // ── SV drag ─────────────────────────────────────────────────────────────────

  const updateFromSv = (clientX: number, clientY: number, hue: number) => {
    if (!svRef.current) return
    const rect = svRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
    const next: [number, number, number] = [hue, s, v]
    setHsv(next)
    const hex = hsvToHex(hue, s, v)
    setHexInput(hex)
    applyColor(hex)
  }

  const startSvDrag = (e: React.MouseEvent) => {
    const hue = hsv[0]
    updateFromSv(e.clientX, e.clientY, hue)
    const onMove = (e: MouseEvent) => updateFromSv(e.clientX, e.clientY, hue)
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Hue drag ─────────────────────────────────────────────────────────────────

  const updateFromHue = (clientX: number, rect: DOMRect, sat: number, val: number) => {
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const hue = x * 360
    const next: [number, number, number] = [hue, sat, val]
    setHsv(next)
    const hex = hsvToHex(hue, sat, val)
    setHexInput(hex)
    applyColor(hex)
  }

  const startHueDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const [, sat, val] = hsv
    updateFromHue(e.clientX, rect, sat, val)
    const onMove = (e: MouseEvent) => updateFromHue(e.clientX, rect, sat, val)
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Custom panel ─────────────────────────────────────────────────────────────

  const PANEL_W = 224
  const PANEL_H = 252
  const px = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, cx - PANEL_W / 2))
  const py = Math.max(8, Math.min(window.innerHeight - PANEL_H - 8, cy - PANEL_H / 2))

  if (customOpen) {
    return (
      <div
        ref={customPanelRef}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: px,
          top: py,
          width: PANEL_W,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'var(--backdrop-blur)',
          padding: 12,
          zIndex: 151,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Custom color</span>
          <button
            onClick={() => closeColorPicker()}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, lineHeight: 1, fontSize: 14 }}
          >✕</button>
        </div>

        <div
          ref={svRef}
          onMouseDown={startSvDrag}
          style={{
            position: 'relative',
            width: '100%',
            height: 130,
            borderRadius: 'var(--radius-md)',
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv[0]}, 100%, 50%))`,
            cursor: 'crosshair',
            marginBottom: 10,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            background: currentHex,
          }} />
        </div>

        <div
          onMouseDown={startHueDrag}
          style={{
            position: 'relative',
            width: '100%',
            height: 12,
            borderRadius: 6,
            background: 'linear-gradient(to right, #f43f5e, #f59e0b, #84cc16, #10b981, #06b6d4, #6366f1, #ec4899, #f43f5e)',
            cursor: 'pointer',
            marginBottom: 12,
            userSelect: 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            left: `${hsv[0] / 360 * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            background: `hsl(${hsv[0]}, 100%, 50%)`,
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: currentHex,
            border: '1px solid var(--border-muted)',
            flexShrink: 0,
          }} />
          <input
            value={hexInput}
            onChange={(e) => {
              setHexInput(e.target.value)
              if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
                const newHsv = hexToHsv(e.target.value)
                setHsv(newHsv)
                applyColor(e.target.value)
              }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') closeColorPicker() }}
            placeholder="#000000"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'monospace',
              padding: '4px 8px',
              outline: 'none',
            }}
          />
        </div>
      </div>
    )
  }

  // ── Circular preset ring ──────────────────────────────────────────────────────

  const n = PRESETS.length
  const containerSize = (RADIUS + SWATCH / 2 + 8) * 2
  const center = containerSize / 2

  // Swatch angle and center position within the container
  const swatchAngle = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2
  const swatchCenter = (i: number) => {
    const a = swatchAngle(i)
    return { x: center + RADIUS * Math.cos(a), y: center + RADIUS * Math.sin(a), a }
  }

  // Arrow: from current preset to next in cycle
  const currentPresetIdx = PRESETS.findIndex((p) => p.value === currentColor)
  const showArrow = currentPresetIdx >= 0
  const nextPresetIdx = (currentPresetIdx + 1) % n

  const renderArrow = () => {
    if (!showArrow) return null
    const ARC_R = RADIUS + SWATCH / 2 + 5

    const from = swatchCenter(currentPresetIdx)
    const to = swatchCenter(nextPresetIdx)

    // Arc points just outside the swatch ring
    const startX = center + ARC_R * Math.cos(from.a)
    const startY = center + ARC_R * Math.sin(from.a)
    const endX = center + ARC_R * Math.cos(to.a)
    const endY = center + ARC_R * Math.sin(to.a)

    // Clockwise minor arc between adjacent swatches
    const diff = (nextPresetIdx - currentPresetIdx + n) % n
    const largeArc = diff > n / 2 ? 1 : 0
    const pathD = `M ${startX} ${startY} A ${ARC_R} ${ARC_R} 0 ${largeArc} 1 ${endX} ${endY}`

    // Arrowhead at end: clockwise tangent at to.a
    const tx = -Math.sin(to.a)
    const ty = Math.cos(to.a)
    const nx = -ty
    const ny = tx
    const aLen = 6
    const aWid = 3.5
    const bx = endX - tx * aLen
    const by = endY - ty * aLen
    const points = `${endX},${endY} ${bx + nx * aWid},${by + ny * aWid} ${bx - nx * aWid},${by - ny * aWid}`

    return (
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        width={containerSize}
        height={containerSize}
      >
        <path d={pathD} fill="none" style={{ stroke: 'var(--color-picker-arrow)' }} strokeWidth={1.5} />
        <polygon points={points} style={{ fill: 'var(--color-picker-arrow)' }} />
      </svg>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: cx,
        top: cy,
        transform: 'translate(-50%, -50%)',
        zIndex: 150,
        width: containerSize,
        height: containerSize,
        pointerEvents: 'none',
      }}
    >
      {/* Glass circle */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'var(--surface-glass)',
        border: '1px solid var(--border)',
        backdropFilter: 'var(--backdrop-blur)',
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'all',
      }} />

      {/* Cycle arrow */}
      {renderArrow()}

      {/* Swatches */}
      {PRESETS.map((p, i) => {
        const { x, y, a } = swatchCenter(i)
        const ox = Math.round(RADIUS * Math.cos(a))
        const oy = Math.round(RADIUS * Math.sin(a))
        const isActive = currentColor === p.value
        const isDefault = p.value === ''

        return (
          <button
            key={i}
            title={p.label}
            onClick={() => applyAndClose(isActive && !isDefault ? '' : p.value)}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(${ox}px - 50%), calc(${oy}px - 50%))`,
              width: SWATCH,
              height: SWATCH,
              borderRadius: '50%',
              background: isDefault
                ? 'var(--surface-overlay)'
                : p.value,
              border: isActive && isDefault
                ? `2.5px solid var(--color-picker-arrow)`
                : isActive
                  ? `2.5px solid #fff`
                  : isDefault
                    ? '2px dashed var(--border-muted)'
                    : '2px solid var(--border-muted)',
              boxShadow: isActive && !isDefault
                ? `0 0 0 1.5px ${p.value}, 0 0 12px ${p.value}88`
                : isActive
                  ? `0 0 0 1.5px var(--color-picker-arrow)`
                  : '0 2px 6px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 0.12s, box-shadow 0.12s',
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = `translate(calc(${ox}px - 50%), calc(${oy}px - 50%)) scale(1.2)` }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = `translate(calc(${ox}px - 50%), calc(${oy}px - 50%)) scale(1)` }}
          >
            {isDefault && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <line x1="2" y1="10" x2="10" y2="2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )
      })}

      {/* Center: open custom picker */}
      <button
        onClick={openCustom}
        title="Custom color"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 30,
          height: 30,
          borderRadius: '50%',
          pointerEvents: 'all',
          cursor: 'pointer',
          overflow: 'hidden',
          border: '2px solid var(--border-strong)',
          boxShadow: currentColor ? `0 0 0 1.5px ${currentColor}66` : 'none',
          padding: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: currentColor
            ? currentColor
            : 'conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #f43f5e)',
        }} />
      </button>
    </div>
  )
}
