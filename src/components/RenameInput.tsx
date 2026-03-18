import { useState, useEffect, useRef } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { worldToScreen } from '../canvas/ViewportMatrix'
import { measureTextElement } from '../canvas/textMetrics'

export function RenameInput() {
  const { renamingId, closeRename, elements, updateElement, viewport } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)
  const inputRef = useRef<HTMLInputElement>(null)
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

  const confirm = () => {
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
          background: 'var(--surface-overlay)',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
          padding: '4px 10px',
          outline: 'none',
          minWidth: 140,
          boxShadow: 'var(--shadow-input)',
          textAlign: 'center',
        }}
      />
    </div>
  )
}
