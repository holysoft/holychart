import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { worldToScreen } from '../canvas/ViewportMatrix'
import { curveControlPoint, quadBezierPoint, smoothCurveControlPoints, cubicBezierPoint, getCurveOffset, getIconAvoidanceOffset } from '../canvas/connectionPath'
import { measureTextElement } from '../canvas/textMetrics'
import { FormatBar } from './FormatBar'
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownHtml'
import type { ConnectionElement, ConnectionRouting, DiagramElement } from '../store/types'

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

function connectionLabelWorldPos(
  conn: ConnectionElement,
  elements: DiagramElement[],
  connections: ConnectionElement[],
  routing: ConnectionRouting
): { x: number; y: number } | null {
  const from = elements.find((el) => el.id === conn.fromId)
  const to = elements.find((el) => el.id === conn.toId)
  if (!from || !to) return null

  const biOffset = getCurveOffset(conn, connections)
  const fromCenter = elementCenter(from)
  const toCenter = elementCenter(to)

  const fromBounds = elementBounds(from)
  const toBounds = elementBounds(to)
  const avoidIcons = elements.filter((el) => {
    if (el.type !== 'icon') return false
    if (el.id === conn.fromId || el.id === conn.toId) return false
    const PAD = 10
    const overlapsFrom = el.x < from.x + fromBounds.width + PAD && el.x + el.width > from.x - PAD
      && el.y < from.y + fromBounds.height + PAD && el.y + el.height > from.y - PAD
    const overlapsTo = el.x < to.x + toBounds.width + PAD && el.x + el.width > to.x - PAD
      && el.y < to.y + toBounds.height + PAD && el.y + el.height > to.y - PAD
    return !overlapsFrom && !overlapsTo
  })
  const avoidOffset = avoidIcons.length > 0
    ? getIconAvoidanceOffset(fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, avoidIcons)
    : 0
  const offset = biOffset + avoidOffset

  let aimFrom: { x: number; y: number } = toCenter
  let aimTo: { x: number; y: number } = fromCenter
  if (offset !== 0) {
    const cp = curveControlPoint(fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, offset)
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

  if (routing === 'curve' && offset === 0) {
    const { cp1x, cp1y, cp2x, cp2y } = smoothCurveControlPoints(start.x, start.y, end.x, end.y, 0)
    return cubicBezierPoint(start.x, start.y, cp1x, cp1y, cp2x, cp2y, end.x, end.y, 0.5)
  }

  if (offset !== 0) {
    const cp = curveControlPoint(start.x, start.y, end.x, end.y, offset)
    return quadBezierPoint(start.x, start.y, cp.cx, cp.cy, end.x, end.y, 0.5)
  }

  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
}

export function RenameInput() {
  const { renamingTarget, closeRename, elements, connections, updateElement, updateConnection, viewport, connectionRouting } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const committedRef = useRef(false)

  const el = renamingTarget?.kind === 'element'
    ? elements.find((e) => e.id === renamingTarget.id) ?? null
    : null
  const conn = renamingTarget?.kind === 'connection'
    ? connections.find((c) => c.id === renamingTarget.id) ?? null
    : null

  useEffect(() => {
    committedRef.current = false
    if (el?.type === 'text') {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = markdownToHtml(el.text)
          editorRef.current.focus()
          // Select all
          const range = document.createRange()
          range.selectNodeContents(editorRef.current)
          window.getSelection()?.removeAllRanges()
          window.getSelection()?.addRange(range)
        }
      }, 30)
    } else if (el) {
      const current = el.type === 'box' ? el.text : (el.label ?? '')
      setValue(current)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
    } else if (conn) {
      setValue(conn.label ?? '')
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
    }
  }, [renamingTarget, el, conn]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!renamingTarget) return null
  if (renamingTarget.kind === 'element' && !el) return null
  if (renamingTarget.kind === 'connection' && !conn) return null

  const confirmText = () => {
    if (committedRef.current) return
    committedRef.current = true
    const md = htmlToMarkdown(editorRef.current?.innerHTML ?? '')
    if (md.trim()) {
      const fontSize = el?.type === 'text' ? el.fontSize : 14
      const { width, height } = measureTextElement(md, fontSize)
      updateElement(renamingTarget.id, { text: md, width, height } as never)
    }
    closeRename()
  }

  const confirmOther = () => {
    if (committedRef.current) return
    committedRef.current = true
    const trimmed = value.trim()
    if (el?.type === 'box') {
      updateElement(renamingTarget.id, { text: trimmed } as never)
    } else if (el) {
      updateElement(renamingTarget.id, { label: trimmed || undefined })
    } else {
      updateConnection(renamingTarget.id, { label: trimmed || undefined })
    }
    closeRename()
  }

  const sharedInputStyle = {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--accent-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    boxShadow: 'var(--shadow-input)',
  }

  if (el?.type === 'text') {
    const screenPos = worldToScreen(el.x, el.y, viewport)
    return (
      <div style={{ position: 'fixed', left: screenPos.x, top: screenPos.y, zIndex: 200 }}>
        <FormatBar editorRef={editorRef} hint="⌘↵ confirm" />
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={(e) => {
            if (e.key === 'Escape') { closeRename(); return }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirmText(); return }
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); return }
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); return }
          }}
          onBlur={confirmText}
          style={{
            ...sharedInputStyle,
            fontSize: el.fontSize,
            lineHeight: 1.5,
            padding: '8px 12px',
            width: 360,
            minHeight: 160,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowY: 'auto',
            cursor: 'text',
          }}
          data-placeholder="Edit text…"
        />
      </div>
    )
  }

  // Non-text elements: position above the element top-center
  const screenPos = el
    ? worldToScreen(el.x + el.width / 2, el.y, viewport)
    : (() => {
      const worldPos = connectionLabelWorldPos(conn!, elements, connections, connectionRouting)
      return worldPos
        ? worldToScreen(worldPos.x, worldPos.y, viewport)
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    })()
  return (
    <div style={{ position: 'fixed', left: screenPos.x, top: screenPos.y - 8, transform: 'translate(-50%, -100%)', zIndex: 200 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') confirmOther()
          if (e.key === 'Escape') closeRename()
        }}
        onBlur={confirmOther}
        placeholder={el?.type === 'icon' ? 'Label…' : conn ? 'Connection label…' : 'Name…'}
        style={{
          ...sharedInputStyle,
          fontSize: 13,
          padding: '4px 10px',
          minWidth: 140,
          textAlign: 'center',
        }}
      />
    </div>
  )
}
