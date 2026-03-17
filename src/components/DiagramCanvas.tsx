import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { GestureController } from '../canvas/GestureController'
import { applyGestureDelta, screenToWorld, resetRotation } from '../canvas/ViewportMatrix'
import { hitTest, hitTestConnection, elementsInRect } from '../canvas/HitTest'
import { render } from '../canvas/CanvasRenderer'
import { loadIcon } from '../icons/iconifyClient'
import type { IconElement, TextElement, BoxElement } from '../store/types'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Text input overlay ────────────────────────────────────────────────────────

function TextInputOverlay() {
  const { textInputPos, closeTextInput, viewport, addElement, setSelected, defaultFontSize } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textInputPos) { setValue(''); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [textInputPos])

  if (!textInputPos) return null

  const confirm = () => {
    if (!value.trim()) { closeTextInput(); return }
    const worldPos = screenToWorld(textInputPos.screenX, textInputPos.screenY, viewport)
    const el: TextElement = {
      id: genId(), type: 'text',
      x: worldPos.x, y: worldPos.y,
      width: 300, height: defaultFontSize * 1.5,
      text: value, fontSize: defaultFontSize,
    }
    addElement(el); setSelected(el.id); closeTextInput()
  }

  const isDark = theme === 'dark'
  return (
    <div style={{ position: 'fixed', left: textInputPos.screenX, top: textInputPos.screenY, zIndex: 200, transform: 'translate(-8px, -8px)' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') closeTextInput() }}
        onBlur={confirm}
        placeholder="Type text…"
        style={{
          background: isDark ? 'rgba(15,15,25,0.95)' : 'rgba(255,255,255,0.97)',
          border: `1px solid ${isDark ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.5)'}`,
          borderRadius: 6, color: isDark ? '#e2e8f0' : '#1e293b',
          fontSize: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          padding: '4px 10px', outline: 'none', minWidth: 180,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────────

export function DiagramCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gestureRef = useRef<GestureController | null>(null)
  const rafRef = useRef<number>(0)
  const dprRef = useRef(window.devicePixelRatio || 1)
  const cursorPosRef = useRef({ x: 0, y: 0 })

  const dragStateRef = useRef<{
    kind: 'move'
    ids: string[]
    startWorldX: number; startWorldY: number
    origPositions: Map<string, { x: number; y: number }>
  } | {
    kind: 'resize'
    id: string; handle: number
    startWorldX: number; startWorldY: number
    origX: number; origY: number; origW: number; origH: number
  } | {
    kind: 'marquee'
    startWorldX: number; startWorldY: number
  } | null>(null)

  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const {
    viewport, elements, connections, selectedIds, selectedConnectionId, toolMode, rotationEnabled, defaultFontSize,
    setViewport, addElement, updateElement, setSelected, setSelectedIds, setSelectedConnection,
    deleteElement, deleteSelected, deleteConnection, updateConnection,
    openIconSearch, openTextInput, closeTextInput,
    startConnecting, finishConnecting, cancelConnecting, setConnectionPreviewPos,
    connectingFromId, connectionPreviewPos,
    copySelected, paste, clipboard,
    openColorPicker, closeColorPicker,
    openRename, closeRename,
  } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)

  const vpRef = useRef(viewport); vpRef.current = viewport
  const elementsRef = useRef(elements); elementsRef.current = elements
  const selectedIdsRef = useRef(selectedIds); selectedIdsRef.current = selectedIds
  const toolModeRef = useRef(toolMode); toolModeRef.current = toolMode
  const themeRef = useRef(theme); themeRef.current = theme
  const rotationEnabledRef = useRef(rotationEnabled); rotationEnabledRef.current = rotationEnabled
  const defaultFontSizeRef = useRef(defaultFontSize); defaultFontSizeRef.current = defaultFontSize
  const connectingFromIdRef = useRef(connectingFromId); connectingFromIdRef.current = connectingFromId
  const selectedConnectionIdRef = useRef(selectedConnectionId); selectedConnectionIdRef.current = selectedConnectionId
  const clipboardRef = useRef(clipboard); clipboardRef.current = clipboard
  const connectionPreviewPosRef = useRef(connectionPreviewPos); connectionPreviewPosRef.current = connectionPreviewPos
  const connectionsRef = useRef(connections); connectionsRef.current = connections

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1; dprRef.current = dpr
    const cssW = canvas.offsetWidth; const cssH = canvas.offsetHeight
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr; canvas.height = cssH * dpr
    }
    gestureRef.current?.invalidateRect()
  }, [])

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    render(
      ctx, elementsRef.current, connectionsRef.current, vpRef.current,
      selectedIdsRef.current, selectedConnectionIdRef.current,
      connectingFromIdRef.current, connectionPreviewPosRef.current,
      marqueeRef.current,
      dprRef.current, canvas.offsetWidth, canvas.offsetHeight, themeRef.current,
      useAppStore.getState().defaultFontSize,
    )
    rafRef.current = requestAnimationFrame(renderFrame)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    resizeCanvas()
    const ro = new ResizeObserver(resizeCanvas); ro.observe(canvas)
    return () => ro.disconnect()
  }, [resizeCanvas])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [renderFrame])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIdsRef.current.length > 0) { deleteSelected(); return }
        if (selectedConnectionIdRef.current) { deleteConnection(selectedConnectionIdRef.current); return }
      }
      // Copy / paste / duplicate
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        if (selectedIdsRef.current.length > 0) { e.preventDefault(); copySelected() }
        return
      }
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        if (clipboardRef.current) {
          e.preventDefault()
          paste()
          // Ensure icon image is loaded for the pasted element
          const pasted = useAppStore.getState().elements.at(-1)
          if (pasted?.type === 'icon') loadIcon(pasted.iconName, themeRef.current)
        }
        return
      }
      if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey) {
        if (selectedConnectionIdRef.current) {
          e.preventDefault()
          useAppStore.getState().reverseConnection(selectedConnectionIdRef.current)
        }
        return
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        if (selectedIdsRef.current.length > 0) {
          e.preventDefault()
          copySelected()
          paste()
          const pasted = useAppStore.getState().elements.at(-1)
          if (pasted?.type === 'icon') loadIcon(pasted.iconName, themeRef.current)
        }
        return
      }
      if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const text = prompt('Box label (optional):') ?? ''
        const canvas = canvasRef.current
        const cx = (canvas?.offsetWidth ?? 800) / 2
        const cy = (canvas?.offsetHeight ?? 600) / 2
        const worldPos = screenToWorld(cx, cy, vpRef.current)
        const el: BoxElement = {
          id: genId(), type: 'box',
          x: worldPos.x - 120, y: worldPos.y - 80,
          width: 240, height: 160,
          text, fontSize: Math.max(11, defaultFontSize - 2),
        }
        addElement(el); setSelected(el.id)
        return
      }
      if (e.key === 'i' || e.key === '/') { e.preventDefault(); openIconSearch() }
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (selectedConnectionIdRef.current) {
          const label = prompt('Connection label (leave blank to clear):') ?? null
          if (label !== null) updateConnection(selectedConnectionIdRef.current, { label: label || undefined })
          return
        }
        const canvas = canvasRef.current
        openTextInput((canvas?.offsetWidth ?? 800) / 2, (canvas?.offsetHeight ?? 600) / 2)
      }
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey) {
        // S on a selected icon = swap image
        const primaryId = selectedIdsRef.current[0]
        if (primaryId) {
          const el = elementsRef.current.find((e) => e.id === primaryId)
          if (el?.type === 'icon') {
            e.preventDefault()
            openIconSearch(undefined, primaryId)
            return
          }
        }
        if (selectedConnectionIdRef.current) {
          e.preventDefault()
          const conn = connectionsRef.current.find((c) => c.id === selectedConnectionIdRef.current)
          if (conn) {
            const styles = ['solid', 'dashed', 'animated'] as const
            const next = styles[(styles.indexOf(conn.style ?? 'solid') + 1) % styles.length]
            updateConnection(selectedConnectionIdRef.current, { style: next })
          }
        }
        return
      }
      if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey) {
        if (selectedIdsRef.current[0] && toolModeRef.current !== 'connect') {
          e.preventDefault()
          startConnecting(selectedIdsRef.current[0])
        }
      }
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey) {
        const s = useAppStore.getState()
        if (s.isColorPickerOpen) {
          // Picker already open — cycle to next preset
          e.preventDefault()
          const cycle = ['', '#6366f1', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#38bdf8']
          const primaryId = s.selectedIds[0] ?? null
          const current = primaryId
            ? (s.elements.find((el) => el.id === primaryId)?.color ?? '')
            : (s.connections.find((c) => c.id === s.selectedConnectionId)?.color ?? '')
          const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
          if (primaryId) s.updateElement(primaryId, { color: next || undefined })
          else if (s.selectedConnectionId) s.updateConnection(s.selectedConnectionId, { color: next || undefined })
          return
        }
        if (selectedIdsRef.current.length > 0 || selectedConnectionIdRef.current) {
          e.preventDefault()
          const { x, y } = cursorPosRef.current
          openColorPicker(x, y)
        }
        return
      }
      if ((e.key === 'n' || e.key === 'N') && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        useAppStore.getState().createDiagram()
        return
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        const id = selectedIdsRef.current[0]
        if (id) { e.preventDefault(); openRename(id) }
        return
      }
      if (e.key === 'Escape') {
        if (toolModeRef.current === 'connect') { cancelConnecting(); return }
        closeColorPicker(); closeRename()
        setSelected(null); setSelectedConnection(null); closeTextInput()
        useAppStore.getState().closeIconSearch()
      }
      if (e.key === '[') setViewport({ ...vpRef.current, rotation: vpRef.current.rotation - 0.1 })
      if (e.key === ']') setViewport({ ...vpRef.current, rotation: vpRef.current.rotation + 0.1 })
      if (e.key === 'o' && !e.metaKey && !e.ctrlKey) {
        const canvas = canvasRef.current
        setViewport(resetRotation(vpRef.current, canvas?.offsetWidth ?? 800, canvas?.offsetHeight ?? 600))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteElement, deleteSelected, deleteConnection, updateConnection, openIconSearch, openTextInput, closeTextInput, setSelected, setViewport, startConnecting, cancelConnecting, copySelected, paste, openColorPicker, closeColorPicker, openRename, closeRename])

  // Mouse move for connection preview
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY }
    if (toolModeRef.current !== 'connect') return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left; const screenY = e.clientY - rect.top
    const worldPos = screenToWorld(screenX, screenY, vpRef.current)
    setConnectionPreviewPos(worldPos)
  }, [setConnectionPreviewPos])

  // Gesture controller
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    const ctrl = new GestureController(canvas, {
      onGestureDelta: (delta) => {
        const d = rotationEnabledRef.current ? delta : { ...delta, deltaRotation: 0 }
        setViewport(applyGestureDelta(vpRef.current, d))
      },

      onClick: (screenX, screenY) => {
        const worldPos = screenToWorld(screenX, screenY, vpRef.current)

        if (toolModeRef.current === 'connect') {
          const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, null)
          if (hit.kind === 'element' && hit.id !== connectingFromIdRef.current) {
            finishConnecting(hit.id)
          } else {
            cancelConnecting()
          }
          return
        }
        if (toolModeRef.current === 'text') { openTextInput(screenX, screenY); return }

        const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
        if (hit.kind === 'element') { setSelected(hit.id); return }
        // Try connections
        const connId = hitTestConnection(connectionsRef.current, elementsRef.current, worldPos.x, worldPos.y)
        if (connId) { setSelectedConnection(connId); return }
        setSelectedIds([])
      },

      onDragStart: (screenX, screenY) => {
        if (toolModeRef.current !== 'select') return
        const worldPos = screenToWorld(screenX, screenY, vpRef.current)
        const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
        if (hit.kind === 'handle') {
          const el = elementsRef.current.find((e) => e.id === hit.id)
          if (el) {
            dragStateRef.current = {
              kind: 'resize', id: hit.id, handle: hit.handle,
              startWorldX: worldPos.x, startWorldY: worldPos.y,
              origX: el.x, origY: el.y, origW: el.width, origH: el.height,
            }
          }
        } else if (hit.kind === 'element') {
          const idsToMove = selectedIdsRef.current.includes(hit.id)
            ? selectedIdsRef.current
            : [hit.id]
          if (!selectedIdsRef.current.includes(hit.id)) setSelectedIds([hit.id])
          dragStateRef.current = {
            kind: 'move',
            ids: idsToMove,
            startWorldX: worldPos.x,
            startWorldY: worldPos.y,
            origPositions: new Map(idsToMove.map((id) => {
              const el = elementsRef.current.find((e) => e.id === id)
              return [id, { x: el?.x ?? 0, y: el?.y ?? 0 }]
            })),
          }
        } else {
          // marquee
          setSelectedIds([])
          dragStateRef.current = { kind: 'marquee', startWorldX: worldPos.x, startWorldY: worldPos.y }
          marqueeRef.current = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y }
        }
      },

      onDragMove: (_dx, _dy, screenX, screenY) => {
        const ds = dragStateRef.current; if (!ds) return
        const worldPos = screenToWorld(screenX, screenY, vpRef.current)
        if (ds.kind === 'move') {
          const dx = worldPos.x - ds.startWorldX
          const dy = worldPos.y - ds.startWorldY
          for (const [id, orig] of ds.origPositions) {
            updateElement(id, { x: orig.x + dx, y: orig.y + dy })
          }
        } else if (ds.kind === 'resize') {
          // Resize: handle indices map to corners/edges
          // 0=TL 1=TM 2=TR 3=MR 4=BR 5=BM 6=BL 7=ML
          const dx = worldPos.x - ds.startWorldX
          const dy = worldPos.y - ds.startWorldY
          let { origX: x, origY: y, origW: w, origH: h } = ds
          const MIN = 40
          switch (ds.handle) {
            case 0: x+=dx; y+=dy; w-=dx; h-=dy; break // TL
            case 1:         y+=dy;         h-=dy; break // TM
            case 2:         y+=dy; w+=dx;  h-=dy; break // TR
            case 3:                w+=dx;         break // MR
            case 4:                w+=dx;  h+=dy; break // BR
            case 5:                        h+=dy; break // BM
            case 6: x+=dx;         w-=dx;  h+=dy; break // BL
            case 7: x+=dx;         w-=dx;         break // ML
          }
          updateElement(ds.id, {
            x, y,
            width: Math.max(MIN, w),
            height: Math.max(MIN, h),
          })
        } else if (ds.kind === 'marquee') {
          marqueeRef.current = { x1: ds.startWorldX, y1: ds.startWorldY, x2: worldPos.x, y2: worldPos.y }
        }
      },

      onDragEnd: () => {
        const ds = dragStateRef.current
        if (ds?.kind === 'marquee' && marqueeRef.current) {
          const rect = marqueeRef.current
          const ids = elementsInRect(elementsRef.current, {
            x: Math.min(rect.x1, rect.x2),
            y: Math.min(rect.y1, rect.y2),
            w: Math.abs(rect.x2 - rect.x1),
            h: Math.abs(rect.y2 - rect.y1),
          })
          setSelectedIds(ids)
          marqueeRef.current = null
        }
        dragStateRef.current = null
      },
    })

    gestureRef.current = ctrl
    return () => { ctrl.detach(); gestureRef.current = null }
  }, [setViewport, setSelected, setSelectedIds, updateElement, openTextInput, finishConnecting, cancelConnecting])

  const cursor = toolMode === 'text' ? 'text' : toolMode === 'connect' ? 'crosshair' : 'default'

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        style={{ display: 'block', width: '100%', height: '100%', cursor, touchAction: 'none', userSelect: 'none' }}
      />
      <TextInputOverlay />
    </>
  )
}

// ── Icon placement (called from IconSearch) ───────────────────────────────────

export function placeIcon(iconName: string, label: string) {
  const store = useAppStore.getState()
  const theme = selectResolvedTheme(store)

  // Swap mode: update existing icon element
  if (store.swappingIconId) {
    const existing = store.elements.find((e) => e.id === store.swappingIconId)
    if (existing?.type === 'icon') {
      loadIcon(iconName, theme)
      store.updateElement(store.swappingIconId, { iconName, label: label || existing.label })
    }
    store.closeIconSearch()
    return
  }

  // Place mode: create new element
  const vp = store.viewport
  const canvas = document.querySelector('canvas')
  const cssW = canvas?.offsetWidth ?? 800; const cssH = canvas?.offsetHeight ?? 600
  const pos = store.pendingPlacementPos ?? screenToWorld(cssW / 2, cssH / 2, vp)

  const el: IconElement = {
    id: Math.random().toString(36).slice(2, 10),
    type: 'icon', x: pos.x - 40, y: pos.y - 40, width: 80, height: 80,
    iconName, label,
  }
  loadIcon(iconName, theme)
  store.addElement(el); store.setSelected(el.id); store.closeIconSearch()
}
