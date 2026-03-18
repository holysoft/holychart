import { useState, useRef, useEffect } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { Tooltip } from './Tooltip'

export function DiagramTabs() {
  const { diagrams, activeDiagramId, createDiagram, switchDiagram, renameDiagram, deleteDiagram } = useAppStore()
  const resolvedTheme = useAppStore(selectResolvedTheme)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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

  return (
    <>
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        gap: 2,
        background: 'var(--surface-dim)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'var(--backdrop-blur)',
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
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              cursor: isEditing ? 'default' : 'pointer',
              background: isActive
                ? 'var(--accent-bg)'
                : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'background 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg-subtle)'
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
                  color: 'var(--text)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  width: Math.max(60, editValue.length * 7.5),
                  padding: 0,
                }}
              />
            ) : (
              <span style={{ fontSize: 12, color: isActive ? 'var(--accent-text)' : 'var(--text-tab-inactive)', whiteSpace: 'nowrap' }}>
                {diagram.name}
              </span>
            )}

            {diagrams.length > 1 && !isEditing && (
              <Tooltip content="Close diagram">
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(diagram.id) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tab-inactive)', fontSize: 13, lineHeight: 1,
                  padding: '0 0 0 2px', opacity: 0,
                  transition: 'opacity 0.1s',
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
              >
                ×
              </button>
              </Tooltip>
            )}
          </div>
        )
      })}

      {/* New diagram button */}
      <Tooltip content="New diagram (⌘⇧N)">
      <button
        onClick={createDiagram}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tab-inactive)', fontSize: 18, lineHeight: 1,
          padding: '0 8px', height: 26,
          display: 'flex', alignItems: 'center',
          borderRadius: 'var(--radius-sm)',
          transition: 'color 0.12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tab-inactive)' }}
      >
        +
      </button>
      </Tooltip>
    </div>

    {confirmDeleteId && <>
      <div onClick={() => setConfirmDeleteId(null)} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 400, background: 'var(--surface-overlay)', border: '1px solid var(--border-muted)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'var(--backdrop-blur)', padding: '20px 24px', minWidth: 280,
      }}>
        <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
          Delete <strong>"{diagrams.find(d => d.id === confirmDeleteId)?.name}"</strong>?
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>This cannot be undone.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmDeleteId(null)} style={{
            background: 'none', border: '1px solid var(--border-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>Cancel</button>
          <button onClick={() => { deleteDiagram(confirmDeleteId); setConfirmDeleteId(null) }} style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)',
            color: 'var(--danger)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>Delete</button>
        </div>
      </div>
    </>}
    </>
  )
}
