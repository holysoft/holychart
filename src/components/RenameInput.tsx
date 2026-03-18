import { useState, useEffect, useRef } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { worldToScreen } from '../canvas/ViewportMatrix'
import { measureTextElement } from '../canvas/textMetrics'

export function RenameInput() {
  const { renamingId, closeRename, elements, updateElement, viewport } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')

  const el = renamingId ? elements.find((e) => e.id === renamingId) : null

  useEffect(() => {
    if (!el) return
    // Seed with current label/text
    const current =
      el.type === 'text' ? el.text
      : el.type === 'box' ? el.text
      : (el.label ?? '')
    setValue(current)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
  }, [renamingId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!el || !renamingId) return null

  const committedRef = useRef(false)

  useEffect(() => { committedRef.current = false }, [renamingId])

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

  // Position the input at the top-center of the element in screen space
  const screenPos = worldToScreen(el.x + el.width / 2, el.y, viewport)

  const sharedInputStyle = {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--accent-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    boxShadow: 'var(--shadow-input)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y - 8,
        transform: 'translate(-50%, -100%)',
        zIndex: 200,
      }}
    >
      {el.type === 'text' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') closeRename()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm() }
          }}
          onBlur={confirm}
          placeholder={'Edit text…\n(⌘↵ to confirm)'}
          style={{
            ...sharedInputStyle,
            fontSize: el.fontSize,
            lineHeight: 1.5,
            padding: '8px 12px',
            width: 280,
            minHeight: 80,
            resize: 'both',
            display: 'block',
          }}
        />
      ) : (
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
      )}
    </div>
  )
}
