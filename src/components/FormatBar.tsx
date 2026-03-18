import { useState, useCallback } from 'react'

interface FormatBarProps {
  value: string
  setValue: (v: string) => void
  taRef: React.RefObject<HTMLTextAreaElement>
  hint?: string
}

function applyMarker(
  marker: string,
  taRef: React.RefObject<HTMLTextAreaElement>,
  value: string,
  setValue: (v: string) => void
) {
  const ta = taRef.current
  if (!ta) return
  const s = ta.selectionStart ?? 0
  const e = ta.selectionEnd ?? 0
  const newVal = value.slice(0, s) + marker + value.slice(s, e) + marker + value.slice(e)
  setValue(newVal)
  requestAnimationFrame(() => {
    ta.focus()
    ta.selectionStart = s + marker.length
    ta.selectionEnd = e + marker.length
  })
}

export function FormatBar({ value, setValue, taRef, hint }: FormatBarProps) {
  const [boldActive, setBoldActive] = useState(false)
  const [italicActive, setItalicActive] = useState(false)

  // Track selection changes to update active state
  const onSelect = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    const s = ta.selectionStart ?? 0
    const e = ta.selectionEnd ?? 0
    const sel = value.slice(s, e)
    // Simple check: selected text or surrounding chars include markers
    const before2 = value.slice(Math.max(0, s - 2), s)
    const after2 = value.slice(e, e + 2)
    const before1 = value.slice(Math.max(0, s - 1), s)
    const after1 = value.slice(e, e + 1)
    setBoldActive((before2 === '**' && after2 === '**') || (sel.startsWith('**') && sel.endsWith('**')))
    setItalicActive((before1 === '*' && after1 === '*' && before2 !== '**') || (sel.startsWith('*') && sel.endsWith('*')))
  }, [value, taRef])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent-bg)' : 'none',
    border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '2px 8px',
    fontSize: 13,
    lineHeight: '20px',
    fontFamily: 'var(--font-ui)',
    transition: 'all 0.1s',
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border-muted)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 4,
        backdropFilter: 'var(--backdrop-blur)',
      }}
    >
      <button
        style={{ ...btnStyle(boldActive), fontWeight: 700 }}
        onMouseDown={(e) => { e.preventDefault(); applyMarker('**', taRef, value, setValue) }}
        title="Bold (⌘B)"
      >B</button>
      <button
        style={{ ...btnStyle(italicActive), fontStyle: 'italic' }}
        onMouseDown={(e) => { e.preventDefault(); applyMarker('*', taRef, value, setValue) }}
        title="Italic (⌘I)"
      ><em>I</em></button>
      {hint && (
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', paddingLeft: 8 }}>
          {hint}
        </span>
      )}
    </div>
  )
}
