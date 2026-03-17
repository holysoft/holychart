import { useState, useRef, useEffect } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'

export function DiagramTabs() {
  const { diagrams, activeDiagramId, createDiagram, switchDiagram, renameDiagram, deleteDiagram } = useAppStore()
  const resolvedTheme = useAppStore(selectResolvedTheme)
  const isDark = resolvedTheme === 'dark'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.select()
  }, [editingId])

  const startEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditValue(name)
  }

  const commitEdit = () => {
    if (editingId) {
      renameDiagram(editingId, editValue.trim() || 'Untitled')
      setEditingId(null)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textMuted = isDark ? 'rgba(226,232,240,0.45)' : 'rgba(15,23,42,0.45)'
  const textActive = isDark ? '#e2e8f0' : '#1e293b'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        gap: 2,
        background: isDark ? 'rgba(12,12,20,0.92)' : 'rgba(248,250,252,0.94)',
        borderTop: `1px solid ${border}`,
        backdropFilter: 'blur(16px)',
        zIndex: 40,
        userSelect: 'none',
      }}
    >
      {diagrams.map((diagram) => {
        const isActive = diagram.id === activeDiagramId
        const isEditing = editingId === diagram.id

        return (
          <div
            key={diagram.id}
            onClick={() => !isEditing && switchDiagram(diagram.id)}
            onDoubleClick={() => startEdit(diagram.id, diagram.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 26,
              padding: '0 8px 0 10px',
              borderRadius: '6px 6px 0 0',
              cursor: isEditing ? 'default' : 'pointer',
              background: isActive
                ? (isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)')
                : 'transparent',
              borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'background 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingId(null)
                  e.stopPropagation()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: textActive,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  width: Math.max(60, editValue.length * 7.5),
                  padding: 0,
                }}
              />
            ) : (
              <span style={{ fontSize: 12, color: isActive ? textActive : textMuted, whiteSpace: 'nowrap' }}>
                {diagram.name}
              </span>
            )}

            {diagrams.length > 1 && !isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteDiagram(diagram.id) }}
                title="Close diagram"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: textMuted, fontSize: 13, lineHeight: 1,
                  padding: '0 0 0 2px', opacity: 0,
                  transition: 'opacity 0.1s',
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      {/* New diagram button */}
      <button
        onClick={createDiagram}
        title="New diagram (⌘⇧N)"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: textMuted, fontSize: 18, lineHeight: 1,
          padding: '0 8px', height: 26,
          display: 'flex', alignItems: 'center',
          borderRadius: 4,
          transition: 'color 0.12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = textActive }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = textMuted }}
      >
        +
      </button>
    </div>
  )
}
