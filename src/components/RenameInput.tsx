import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { worldToScreen } from '../canvas/ViewportMatrix'
import { measureTextElement } from '../canvas/textMetrics'
import { FormatBar } from './FormatBar'

function wrapSelection(ta: HTMLTextAreaElement, marker: string, value: string, setValue: (v: string) => void) {
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? 0
  const newVal = value.slice(0, start) + marker + value.slice(start, end) + marker + value.slice(end)
  setValue(newVal)
  requestAnimationFrame(() => {
    ta.selectionStart = start + marker.length
    ta.selectionEnd = end + marker.length
  })
}

export function RenameInput() {
  const { renamingId, closeRename, elements, updateElement, viewport } = useAppStore()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const committedRef = useRef(false)

  const el = renamingId ? elements.find((e) => e.id === renamingId) : null

  useEffect(() => {
    if (!el) return
    committedRef.current = false
    const current =
      el.type === 'text' ? el.text
      : el.type === 'box' ? el.text
      : (el.label ?? '')
    setValue(current)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
  }, [renamingId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!el || !renamingId) return null

  const confirm = () => {
    if (committedRef.current) return
    committedRef.current = true
    const trimmed = value.trim()
    if (el.type === 'text') {
      if (trimmed) {
        const { width, height } = measureTextElement(trimmed, el.fontSize)
        updateElement(renamingId, { text: trimmed, width, height } as never)
      }
    } else if (el.type === 'box') {
      updateElement(renamingId, { text: trimmed } as never)
    } else {
      updateElement(renamingId, { label: trimmed || undefined })
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

  if (el.type === 'text') {
    // Anchor to element's top-left so resize grows downward naturally
    const screenPos = worldToScreen(el.x, el.y, viewport)
    const taRef = inputRef as React.RefObject<HTMLTextAreaElement>
    return (
      <div style={{ position: 'fixed', left: screenPos.x, top: screenPos.y, zIndex: 200 }}>
        <FormatBar value={value} setValue={setValue} taRef={taRef} hint="⌘↵ confirm" />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') { closeRename(); return }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm(); return }
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); wrapSelection(e.currentTarget, '**', value, setValue); return }
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); wrapSelection(e.currentTarget, '*', value, setValue); return }
          }}
          onBlur={confirm}
          placeholder={'Edit text…'}
          style={{
            ...sharedInputStyle,
            fontSize: el.fontSize,
            lineHeight: 1.5,
            padding: '8px 12px',
            width: 360,
            minHeight: 160,
            resize: 'both',
            display: 'block',
          }}
        />
      </div>
    )
  }

  // Non-text elements: position above the element top-center
  const screenPos = worldToScreen(el.x + el.width / 2, el.y, viewport)
  return (
    <div style={{ position: 'fixed', left: screenPos.x, top: screenPos.y - 8, transform: 'translate(-50%, -100%)', zIndex: 200 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') confirm()
          if (e.key === 'Escape') closeRename()
        }}
        onBlur={confirm}
        placeholder={el.type === 'icon' ? 'Label…' : 'Name…'}
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
