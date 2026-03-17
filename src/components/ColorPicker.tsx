import { useRef, useEffect, useCallback } from 'react'
import { useAppStore, selectResolvedTheme, selectPrimaryId } from '../store/useAppStore'

const PRESETS = [
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Cyan',    value: '#06b6d4' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Violet',  value: '#8b5cf6' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Sky',     value: '#38bdf8' },
]

const RADIUS = 54   // distance from center to swatch center
const SWATCH = 26   // swatch diameter
const MARGIN = 90   // min distance from screen edge

export function ColorPicker() {
  const {
    isColorPickerOpen, closeColorPicker, colorPickerPos,
    selectedConnectionId,
    updateElement, updateConnection,
    elements, connections,
  } = useAppStore()
  const selectedId = useAppStore(selectPrimaryId)
  const theme = useAppStore(selectResolvedTheme)
  const customRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeId = selectedId ?? selectedConnectionId

  // Close on outside click or any scroll — no backdrop needed
  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      closeColorPicker()
    }
  }, [closeColorPicker])

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
    if (!isColorPickerOpen || !activeId) return
    const cycle = ['', ...PRESETS.map((p) => p.value)]

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
  }, [isColorPickerOpen, activeId])

  if (!isColorPickerOpen || !activeId) return null

  const isConn = !!selectedConnectionId
  const currentColor = isConn
    ? (connections.find((c) => c.id === selectedConnectionId)?.color ?? '')
    : (elements.find((e) => e.id === selectedId)?.color ?? '')
  if (!isConn && !elements.find((e) => e.id === selectedId)) return null

  // Clamp cursor position so the picker circle stays on screen
  const cx = Math.max(MARGIN, Math.min(window.innerWidth - MARGIN, colorPickerPos.x))
  const cy = Math.max(MARGIN, Math.min(window.innerHeight - MARGIN, colorPickerPos.y))

  const isDark = theme === 'dark'

  const apply = (color: string) => {
    if (isConn) updateConnection(selectedConnectionId!, { color: color || undefined })
    else updateElement(selectedId!, { color: color || undefined })
    closeColorPicker()
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: cx,
          top: cy,
          transform: 'translate(-50%, -50%)',
          zIndex: 150,
          width: (RADIUS + SWATCH / 2 + 8) * 2,
          height: (RADIUS + SWATCH / 2 + 8) * 2,
          pointerEvents: 'none', // children opt-in
        }}
      >
        {/* Glass circle background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: isDark ? 'rgba(12,12,22,0.82)' : 'rgba(255,255,255,0.88)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
          backdropFilter: 'blur(14px)',
          boxShadow: isDark
            ? '0 8px 40px rgba(0,0,0,0.55)'
            : '0 8px 32px rgba(0,0,0,0.12)',
          pointerEvents: 'all',
        }} />

        {/* Preset swatches in a circle */}
        {PRESETS.map((p, i) => {
          const angle = (i / PRESETS.length) * 2 * Math.PI - Math.PI / 2
          const ox = Math.round(RADIUS * Math.cos(angle))
          const oy = Math.round(RADIUS * Math.sin(angle))
          const isActive = currentColor === p.value

          return (
            <button
              key={p.value}
              title={p.label}
              onClick={() => apply(isActive ? '' : p.value)}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(${ox}px - 50%), calc(${oy}px - 50%))`,
                width: SWATCH,
                height: SWATCH,
                borderRadius: '50%',
                background: p.value,
                border: isActive ? '2.5px solid #fff' : `2px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                boxShadow: isActive ? `0 0 0 1.5px ${p.value}, 0 0 12px ${p.value}88` : '0 2px 6px rgba(0,0,0,0.25)',
                cursor: 'pointer',
                padding: 0,
                transition: 'transform 0.12s, box-shadow 0.12s',
                pointerEvents: 'all',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = `translate(calc(${ox}px - 50%), calc(${oy}px - 50%)) scale(1.2)` }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = `translate(calc(${ox}px - 50%), calc(${oy}px - 50%)) scale(1)` }}
            />
          )
        })}

        {/* Center: custom color picker */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 30, height: 30,
          borderRadius: '50%',
          pointerEvents: 'all',
          cursor: 'pointer',
          overflow: 'hidden',
          border: `2px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}`,
          boxShadow: currentColor ? `0 0 0 1.5px ${currentColor}66` : 'none',
        }}
          title="Custom color"
        >
          <input
            ref={customRef}
            type="color"
            value={currentColor || '#6366f1'}
            onChange={(e) => apply(e.target.value)}
            style={{
              opacity: 0, position: 'absolute', inset: 0,
              width: '100%', height: '100%', cursor: 'pointer', border: 'none',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: currentColor
              ? currentColor
              : 'conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #f43f5e)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </>
  )
}
