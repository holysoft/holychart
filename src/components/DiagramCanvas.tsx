import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { GestureController } from '../canvas/GestureController'
import { applyGestureDelta, screenToWorld, resetRotation } from '../canvas/ViewportMatrix'
import { hitTest, hitTestConnection, elementsInRect } from '../canvas/HitTest'
import { render } from '../canvas/CanvasRenderer'
import { loadIcon } from '../icons/iconifyClient'
import type { IconElement, TextElement, BoxElement } from '../store/types'
import { measureTextElement } from '../canvas/textMetrics'
import { FormatBar } from './FormatBar'
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownHtml'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

// Maps resize handle index → CSS cursor
const HANDLE_CURSORS = [
  'nwse-resize', // 0: TL
  'ns-resize',   // 1: TM
  'nesw-resize', // 2: TR
  'ew-resize',   // 3: MR
  'nwse-resize', // 4: BR
  'ns-resize',   // 5: BM
  'nesw-resize', // 6: BL
  'ew-resize',   // 7: ML
] as const

// Recursively collect IDs of elements fully contained within any box in `seedIds`
function collectContainedIds(seedIds: string[], elements: import('../store/types').DiagramElement[]): string[] {
  const result = new Set(seedIds)
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    const box = elements.find((e) => e.id === id)
    if (!box || box.type !== 'box') continue
    for (const el of elements) {
      if (result.has(el.id)) continue
      if (el.x >= box.x && el.y >= box.y &&
          el.x + el.width <= box.x + box.width &&
          el.y + el.height <= box.y + box.height) {
        result.add(el.id)
        if (el.type === 'box') queue.push(el.id)
      }
    }
  }
  return [...result]
}

// ── Text input overlay ────────────────────────────────────────────────────────

function TextInputOverlay() {
  const { textInputPos, closeTextInput, viewport, addElement, setSelected, defaultFontSize } = useAppStore()
  const editorRef = useRef<HTMLDivElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    if (textInputPos) {
      committedRef.current = false
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = ''
          editorRef.current.focus()
        }
      }, 30)
    }
  }, [textInputPos])

  if (!textInputPos) return null

  const confirm = () => {
    if (committedRef.current) return
    committedRef.current = true
    const md = htmlToMarkdown(editorRef.current?.innerHTML ?? '')
    if (!md.trim()) { closeTextInput(); return }
    const worldPos = screenToWorld(textInputPos.screenX, textInputPos.screenY, viewport)
    const { width, height } = measureTextElement(md, defaultFontSize)
    const el: TextElement = {
      id: genId(), type: 'text',
      x: worldPos.x, y: worldPos.y,
      width, height,
      text: md, fontSize: defaultFontSize,
    }
    addElement(el); setSelected(el.id); closeTextInput()
  }

  const editorStyle: React.CSSProperties = {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--accent-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontSize: defaultFontSize,
    fontFamily: 'var(--font-ui)',
    lineHeight: 1.5,
    padding: '8px 12px',
    outline: 'none',
    width: 360,
    minHeight: 160,
    boxShadow: 'var(--shadow-input)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowY: 'auto',
    cursor: 'text',
  }

  return (
    <div style={{ position: 'fixed', left: textInputPos.screenX, top: textInputPos.screenY, zIndex: 200, transform: 'translate(-8px, -8px)' }}>
      <FormatBar editorRef={editorRef} hint="⌘↵ confirm" />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={(e) => {
          if (e.key === 'Escape') { closeTextInput(); return }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm(); return }
          if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); return }
          if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); return }
        }}
        onBlur={confirm}
        style={editorStyle}
        data-placeholder="Type text…"
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

  const [boxPlacementActive, setBoxPlacementActive] = useState(false)
  const boxPlacementActiveRef = useRef(false)
  const boxDrawStartRef = useRef<{ screenX: number; screenY: number } | null>(null)
  const boxDrawPreviewWorldRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const shiftHeldRef = useRef(false)

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
    viewport, elements, connections, selectedIds, selectedConnectionId, toolMode, rotationEnabled, hierarchyMove, defaultFontSize,
    setViewport, addElement, updateElement, setSelected, setSelectedIds, setSelectedConnection,
    deleteElement, deleteSelected, deleteConnection, updateConnection,
    openIconSearch, openTextInput, closeTextInput,
    startConnecting, finishConnecting, cancelConnecting, setConnectionPreviewPos,
    openConnectCreateMenu, setPendingConnectionFrom, cyclePendingConnectionStyle,
    pushHistory,
    connectingFromId, connectionPreviewPos,
    copySelected, paste, pasteAt, clipboard,
    openColorPicker, closeColorPicker,
    openRename, closeRename,
    openContextMenu, closeContextMenu,
  } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)

  const vpRef = useRef(viewport); vpRef.current = viewport
  const elementsRef = useRef(elements); elementsRef.current = elements
  const selectedIdsRef = useRef(selectedIds); selectedIdsRef.current = selectedIds
  const toolModeRef = useRef(toolMode); toolModeRef.current = toolMode
  const themeRef = useRef(theme); themeRef.current = theme
  const rotationEnabledRef = useRef(rotationEnabled); rotationEnabledRef.current = rotationEnabled
  const hierarchyMoveRef = useRef(hierarchyMove); hierarchyMoveRef.current = hierarchyMove
  const defaultFontSizeRef = useRef(defaultFontSize); defaultFontSizeRef.current = defaultFontSize
  const connectingFromIdRef = useRef(connectingFromId); connectingFromIdRef.current = connectingFromId
  const selectedConnectionIdRef = useRef(selectedConnectionId); selectedConnectionIdRef.current = selectedConnectionId
  const clipboardRef = useRef(clipboard); clipboardRef.current = clipboard
  const connectionPreviewPosRef = useRef(connectionPreviewPos); connectionPreviewPosRef.current = connectionPreviewPos
  const connectionsRef = useRef(connections); connectionsRef.current = connections
  const connectCandidateIdRef = useRef<string | null>(null)
  const pendingConnectionStyle = useAppStore((s) => s.pendingConnectionStyle)
  const pendingConnectionStyleRef = useRef(pendingConnectionStyle); pendingConnectionStyleRef.current = pendingConnectionStyle

  // Imperatively sets canvas cursor based on current mode, drag state, and hover position
  const updateCursor = useCallback((canvasX: number, canvasY: number) => {
    const canvas = canvasRef.current; if (!canvas) return
    const gc = gestureRef.current
    if (gc?.isPanning) { canvas.style.cursor = 'grabbing'; return }
    if (gc?.isSpaceHeld) { canvas.style.cursor = gc.isSpacePanActive ? 'grabbing' : 'grab'; return }
    if (boxPlacementActiveRef.current) { canvas.style.cursor = 'crosshair'; return }
    if (toolModeRef.current === 'connect') { canvas.style.cursor = 'crosshair'; return }
    if (toolModeRef.current === 'text') { canvas.style.cursor = 'text'; return }
    const ds = dragStateRef.current
    if (ds?.kind === 'move') { canvas.style.cursor = 'grabbing'; return }
    if (ds?.kind === 'resize') { canvas.style.cursor = HANDLE_CURSORS[ds.handle]; return }
    if (ds?.kind === 'marquee') { canvas.style.cursor = 'default'; return }
    const worldPos = screenToWorld(canvasX, canvasY, vpRef.current)
    const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
    if (hit.kind === 'handle') { canvas.style.cursor = HANDLE_CURSORS[hit.handle]; return }
    if (hit.kind === 'element') { canvas.style.cursor = 'move'; return }
    const connId = hitTestConnection(connectionsRef.current, elementsRef.current, worldPos.x, worldPos.y)
    canvas.style.cursor = connId ? 'pointer' : 'default'
  }, [])

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
      marqueeRef.current, boxDrawPreviewWorldRef.current,
      dprRef.current, canvas.offsetWidth, canvas.offsetHeight, themeRef.current,
      useAppStore.getState().defaultFontSize,
      connectCandidateIdRef.current,
      pendingConnectionStyleRef.current,
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
      // Prevent Alt from activating the browser/OS menu bar on Windows
      if (e.key === 'Alt') { e.preventDefault(); return }

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        useAppStore.getState().undo()
        return
      }
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
        if (clipboardRef.current.length > 0) {
          e.preventDefault()
          const canvas = canvasRef.current
          const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
          const wp = screenToWorld(cursorPosRef.current.x - rect.left, cursorPosRef.current.y - rect.top, vpRef.current)
          const prevCount = useAppStore.getState().elements.length
          pasteAt(wp.x, wp.y)
          const els = useAppStore.getState().elements.slice(prevCount)
          els.forEach((el) => { if (el.type === 'icon') loadIcon(el.iconName, themeRef.current) })
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
          const canvas = canvasRef.current
          const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
          const wp = screenToWorld(cursorPosRef.current.x - rect.left, cursorPosRef.current.y - rect.top, vpRef.current)
          const prevCount = useAppStore.getState().elements.length
          pasteAt(wp.x, wp.y)
          const els = useAppStore.getState().elements.slice(prevCount)
          els.forEach((el) => { if (el.type === 'icon') loadIcon(el.iconName, themeRef.current) })
        }
        return
      }
      if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (connectingFromIdRef.current) {
          // Create box at cursor and auto-connect
          const canvas = canvasRef.current
          const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
          const wp = screenToWorld(cursorPosRef.current.x - rect.left, cursorPosRef.current.y - rect.top, vpRef.current)
          setPendingConnectionFrom(connectingFromIdRef.current)
          cancelConnecting()
          const el: BoxElement = { id: genId(), type: 'box', x: wp.x - 120, y: wp.y - 80, width: 240, height: 160, text: '', fontSize: Math.max(11, defaultFontSizeRef.current - 2) }
          addElement(el); setSelected(el.id)
        } else {
          boxPlacementActiveRef.current = true
          setBoxPlacementActive(true)
        }
        return
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault()
        if (connectingFromIdRef.current) {
          const canvas = canvasRef.current
          const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
          const wp = screenToWorld(cursorPosRef.current.x - rect.left, cursorPosRef.current.y - rect.top, vpRef.current)
          setPendingConnectionFrom(connectingFromIdRef.current)
          cancelConnecting()
          openIconSearch({ x: wp.x, y: wp.y })
        } else {
          openIconSearch()
        }
      }
      if ((e.key === 'w' || e.key === 'W') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (selectedConnectionIdRef.current) {
          const label = prompt('Connection label (leave blank to clear):') ?? null
          if (label !== null) updateConnection(selectedConnectionIdRef.current, { label: label || undefined })
          return
        }
        if (connectingFromIdRef.current) {
          const { x, y } = cursorPosRef.current
          setPendingConnectionFrom(connectingFromIdRef.current)
          cancelConnecting()
          openTextInput(x, y)
          return
        }
        const canvas = canvasRef.current
        openTextInput((canvas?.offsetWidth ?? 800) / 2, (canvas?.offsetHeight ?? 600) / 2)
      }
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey) {
        if (connectingFromIdRef.current) {
          e.preventDefault()
          cyclePendingConnectionStyle()
          return
        }
        const primaryId = selectedIdsRef.current[0]
        if (primaryId) {
          const el = elementsRef.current.find((e) => e.id === primaryId)
          if (el?.type === 'icon') {
            // S on a selected icon = swap image
            e.preventDefault()
            openIconSearch(undefined, primaryId)
            return
          }
          if (el?.type === 'box') {
            // S on a selected box = cycle style
            e.preventDefault()
            const styles = ['solid', 'dashed', 'filled'] as const
            const current = (el as import('../store/types').BoxElement).style ?? 'solid'
            const next = styles[(styles.indexOf(current) + 1) % styles.length]
            updateElement(primaryId, { style: next } as Partial<import('../store/types').BoxElement>)
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
          const cycle = ['', '#6366f1', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899', '#38bdf8'] // must match PRESETS order in ColorPicker.tsx
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
      if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        useAppStore.getState().toggleHierarchyMove()
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
        if (boxPlacementActiveRef.current) {
          boxPlacementActiveRef.current = false
          setBoxPlacementActive(false)
          boxDrawStartRef.current = null
          boxDrawPreviewWorldRef.current = null
          return
        }
        if (toolModeRef.current === 'connect') { connectCandidateIdRef.current = null; cancelConnecting(); return }
        closeColorPicker(); closeRename(); closeContextMenu()
        setSelected(null); setSelectedConnection(null); closeTextInput()
        useAppStore.getState().closeIconSearch()
      }
      if (e.key === '[') setViewport({ ...vpRef.current, rotation: vpRef.current.rotation - 0.1 })
      if (e.key === ']') setViewport({ ...vpRef.current, rotation: vpRef.current.rotation + 0.1 })
      if (e.key === 'o' && !e.metaKey && !e.ctrlKey) {
        const canvas = canvasRef.current
        const w = canvas?.offsetWidth ?? 800
        const h = canvas?.offsetHeight ?? 600
        if (Math.abs(vpRef.current.rotation) > 0.001) {
          setViewport(resetRotation(vpRef.current, w, h))
        } else {
          setViewport({ panX: 0, panY: 0, zoom: 1, rotation: 0 })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteElement, deleteSelected, deleteConnection, updateConnection, openIconSearch, openTextInput, closeTextInput, setSelected, setViewport, startConnecting, cancelConnecting, copySelected, paste, pasteAt, openColorPicker, closeColorPicker, openRename, closeRename, pushHistory, closeContextMenu, openConnectCreateMenu, setPendingConnectionFrom, addElement, cyclePendingConnectionStyle])

  // Re-evaluate cursor whenever mode changes (box placement, tool mode)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    updateCursor(cursorPosRef.current.x - rect.left, cursorPosRef.current.y - rect.top)
  }, [boxPlacementActive, toolMode, updateCursor])

  // Mouse move for connection preview and box draw preview
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY }
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    if (canvas) updateCursor(canvasX, canvasY)
    if (boxPlacementActiveRef.current && boxDrawPreviewWorldRef.current) {
      const wp = screenToWorld(canvasX, canvasY, vpRef.current)
      boxDrawPreviewWorldRef.current = { ...boxDrawPreviewWorldRef.current, x2: wp.x, y2: wp.y }
    }
    if (toolModeRef.current !== 'connect') {
      connectCandidateIdRef.current = null
      return
    }
    const worldPos = screenToWorld(canvasX, canvasY, vpRef.current)
    setConnectionPreviewPos(worldPos)
    // Detect candidate destination element
    const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, null)
    connectCandidateIdRef.current = (hit.kind === 'element' && hit.id !== connectingFromIdRef.current) ? hit.id : null
  }, [setConnectionPreviewPos, updateCursor])

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, vpRef.current)
    // Auto-select element under cursor if not already selected
    const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
    if (hit.kind === 'element' && !selectedIdsRef.current.includes(hit.id)) {
      setSelected(hit.id)
    } else if (hit.kind === 'none' && !selectedIdsRef.current.length) {
      const connId = hitTestConnection(connectionsRef.current, elementsRef.current, worldPos.x, worldPos.y)
      if (connId) setSelectedConnection(connId)
    }
    openContextMenu(e.clientX, e.clientY)
  }, [openContextMenu, setSelected, setSelectedConnection])

  // Record the first corner on mousedown and capture shift state for click handler
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    shiftHeldRef.current = e.shiftKey
    if (!boxPlacementActiveRef.current) return
    boxDrawStartRef.current = { screenX: e.clientX, screenY: e.clientY }
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, vpRef.current)
    boxDrawPreviewWorldRef.current = { x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y }
  }, [])

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

        if (boxPlacementActiveRef.current) {
          // Simple click (no drag) — place a default-sized box centered on click
          const el: BoxElement = {
            id: genId(), type: 'box',
            x: worldPos.x - 120, y: worldPos.y - 80,
            width: 240, height: 160,
            text: '', fontSize: Math.max(11, defaultFontSizeRef.current - 2),
          }
          addElement(el); setSelected(el.id)
          boxPlacementActiveRef.current = false
          setBoxPlacementActive(false)
          boxDrawStartRef.current = null
          boxDrawPreviewWorldRef.current = null
          return
        }

        if (toolModeRef.current === 'connect') {
          const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, null)
          if (hit.kind === 'element' && hit.id !== connectingFromIdRef.current) {
            finishConnecting(hit.id)
          } else {
            openConnectCreateMenu(screenX, screenY, worldPos.x, worldPos.y)
          }
          return
        }
        if (toolModeRef.current === 'text') { openTextInput(screenX, screenY); return }

        const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
        if (hit.kind === 'element') {
          if (shiftHeldRef.current) {
            const already = selectedIdsRef.current.includes(hit.id)
            setSelectedIds(already
              ? selectedIdsRef.current.filter((id) => id !== hit.id)
              : [...selectedIdsRef.current, hit.id])
          } else {
            setSelected(hit.id)
          }
          return
        }
        // Try connections
        const connId = hitTestConnection(connectionsRef.current, elementsRef.current, worldPos.x, worldPos.y)
        if (connId) { setSelectedConnection(connId); return }
        setSelectedIds([])
      },

      onDoubleClick: (screenX, screenY) => {
        const worldPos = screenToWorld(screenX, screenY, vpRef.current)
        const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, null)
        if (hit.kind === 'element') {
          const el = elementsRef.current.find((e) => e.id === hit.id)
          if (el?.type === 'text') {
            setSelected(hit.id)
            openRename(hit.id)
          }
        }
      },

      onDragStart: (screenX, screenY) => {
        if (boxPlacementActiveRef.current) return // preview handled via onMouseDown/onMouseMove
        if (toolModeRef.current !== 'select') return
        const worldPos = screenToWorld(screenX, screenY, vpRef.current)
        const hit = hitTest(elementsRef.current, worldPos.x, worldPos.y, selectedIdsRef.current[0] ?? null)
        if (hit.kind === 'handle') {
          const el = elementsRef.current.find((e) => e.id === hit.id)
          if (el) {
            pushHistory()
            dragStateRef.current = {
              kind: 'resize', id: hit.id, handle: hit.handle,
              startWorldX: worldPos.x, startWorldY: worldPos.y,
              origX: el.x, origY: el.y, origW: el.width, origH: el.height,
            }
            updateCursor(screenX, screenY)
          }
        } else if (hit.kind === 'element') {
          const baseIds = selectedIdsRef.current.includes(hit.id)
            ? selectedIdsRef.current
            : [hit.id]
          if (!selectedIdsRef.current.includes(hit.id)) setSelectedIds([hit.id])
          pushHistory()
          const idsToMove = hierarchyMoveRef.current
            ? collectContainedIds(baseIds, elementsRef.current)
            : baseIds
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
          updateCursor(screenX, screenY)
        } else {
          // marquee
          setSelectedIds([])
          dragStateRef.current = { kind: 'marquee', startWorldX: worldPos.x, startWorldY: worldPos.y }
          marqueeRef.current = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y }
        }
      },

      onDragMove: (_dx, _dy, screenX, screenY) => {
        if (boxPlacementActiveRef.current) return // preview handled by React onMouseMove
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

          const resizingEl = elementsRef.current.find((e) => e.id === ds.id)
          if (resizingEl?.type === 'icon') {
            // Proportional resize from corners only — use dominant axis
            const ratio = ds.origW / ds.origH
            // Determine raw new size per axis for this corner
            const rawW = ds.handle === 0 || ds.handle === 6 ? ds.origW - dx : ds.origW + dx
            const rawH = ds.handle === 0 || ds.handle === 2 ? ds.origH - dy : ds.origH + dy
            const scaleW = rawW / ds.origW
            const scaleH = rawH / ds.origH
            const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH
            w = Math.max(MIN, ds.origW * scale)
            h = w / ratio
            // Keep the fixed corner stationary
            if (ds.handle === 0 || ds.handle === 6) x = ds.origX + ds.origW - w
            if (ds.handle === 0 || ds.handle === 2) y = ds.origY + ds.origH - h
          } else {
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
            w = Math.max(MIN, w)
            h = Math.max(MIN, h)
          }
          updateElement(ds.id, { x, y, width: w, height: h })
        } else if (ds.kind === 'marquee') {
          marqueeRef.current = { x1: ds.startWorldX, y1: ds.startWorldY, x2: worldPos.x, y2: worldPos.y }
        }
      },

      onDragEnd: (screenX, screenY) => {
        if (boxPlacementActiveRef.current) {
          const canvas = canvasRef.current
          const canvasRect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
          const worldEnd = screenToWorld(screenX, screenY, vpRef.current)
          if (boxDrawStartRef.current) {
            const worldStart = screenToWorld(
              boxDrawStartRef.current.screenX - canvasRect.left,
              boxDrawStartRef.current.screenY - canvasRect.top,
              vpRef.current,
            )
            const x = Math.min(worldStart.x, worldEnd.x)
            const y = Math.min(worldStart.y, worldEnd.y)
            const w = Math.max(20, Math.abs(worldEnd.x - worldStart.x))
            const h = Math.max(20, Math.abs(worldEnd.y - worldStart.y))
            const el: BoxElement = {
              id: genId(), type: 'box', x, y, width: w, height: h,
              text: '', fontSize: Math.max(11, defaultFontSizeRef.current - 2),
            }
            addElement(el); setSelected(el.id)
          }
          boxPlacementActiveRef.current = false
          setBoxPlacementActive(false)
          boxDrawStartRef.current = null
          boxDrawPreviewWorldRef.current = null
          return
        }
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
        updateCursor(screenX, screenY)
      },
    })

    gestureRef.current = ctrl
    return () => { ctrl.detach(); gestureRef.current = null }
  }, [setViewport, setSelected, setSelectedIds, updateElement, openTextInput, finishConnecting, cancelConnecting, pushHistory, updateCursor])


  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
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
