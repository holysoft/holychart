import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { worldToScreen } from '../canvas/ViewportMatrix'
import { measureTextElement } from '../canvas/textMetrics'
import { FormatBar } from './FormatBar'


export function RenameInput() {
  const { renamingId, closeRename, elements, updateElement, viewport } = useAppStore()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const committedRef = useRef(false)
  const taHistoryRef = useRef<string[]>([])

  const el = renamingId ? elements.find((e) => e.id === renamingId) : null

  const taRef = inputRef as React.RefObject<HTMLTextAreaElement>

  const applyChange = useCallback((newVal: string, selStart: number, selEnd: number) => {
    taHistoryRef.current = [...taHistoryRef.current, value]
    setValue(newVal)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (ta) { ta.focus(); ta.selectionStart = selStart; ta.selectionEnd = selEnd }
    })
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!el) return
    committedRef.current = false
    taHistoryRef.current = []
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
    return (
      <div style={{ position: 'fixed', left: screenPos.x, top: screenPos.y, zIndex: 200 }}>
        <FormatBar value={value} applyChange={applyChange} taRef={taRef} hint="⌘↵ confirm" />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') { closeRename(); return }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm(); return }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
              e.preventDefault()
              if (taHistoryRef.current.length > 0) {
                setValue(taHistoryRef.current[taHistoryRef.current.length - 1])
                taHistoryRef.current = taHistoryRef.current.slice(0, -1)
              }
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
              e.preventDefault()
              const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const en = ta.selectionEnd ?? 0
              applyChange(value.slice(0, s) + '**' + value.slice(s, en) + '**' + value.slice(en), s + 2, en + 2)
              return
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
              e.preventDefault()
              const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const en = ta.selectionEnd ?? 0
              applyChange(value.slice(0, s) + '*' + value.slice(s, en) + '*' + value.slice(en), s + 1, en + 1)
              return
            }
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
