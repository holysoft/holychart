import { useRef, useState } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { resetRotation } from '../canvas/ViewportMatrix'
import { Tooltip } from './Tooltip'
import type { Diagram } from '../store/types'

export function Toolbar() {
  const { selectedIds, deleteSelected, openIconSearch, viewport, setViewport, theme, toggleTheme, toolMode, rotationEnabled, toggleRotation, hierarchyMove, toggleHierarchyMove, defaultFontSize, setDefaultFontSize, diagrams, activeDiagramId, elements, connections, importDiagram, loadWorkspace } = useAppStore()
  const resolvedTheme = useAppStore(selectResolvedTheme)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workspaceFileInputRef = useRef<HTMLInputElement>(null)
  const fileMenuBtnRef = useRef<HTMLButtonElement>(null)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [pendingWorkspace, setPendingWorkspace] = useState<{ diagrams: Diagram[]; activeDiagramId: string } | null>(null)

  const [fontSizeInput, setFontSizeInput] = useState<string | null>(null)
  const fontSizeScrollAccum = useRef(0)
  const commitFontSize = (raw: string) => {
    const val = parseInt(raw)
    if (!isNaN(val) && val >= 8 && val <= 96) setDefaultFontSize(val)
    setFontSizeInput(null)
  }
  const changeFontSize = (delta: number) => setDefaultFontSize(defaultFontSize + delta)

  const resetView = () => {
    const canvas = document.querySelector('canvas')
    setViewport(resetRotation(viewport, canvas?.offsetWidth ?? 800, canvas?.offsetHeight ?? 600))
  }
  const rotationDeg = Math.round((viewport.rotation * 180) / Math.PI)

  const handleExport = () => {
    const activeDiagram = diagrams.find((d) => d.id === activeDiagramId)
    const diagram: Diagram = {
      id: activeDiagramId,
      name: activeDiagram?.name ?? 'Diagram',
      elements,
      connections,
      viewport,
    }
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${diagram.name.replace(/[^a-z0-9]/gi, '_')}.holychart.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string) as Partial<Diagram>
        importDiagram({
          id: '',
          name: data.name ?? file.name.replace(/\.holychart\.json$/i, '').replace(/\.json$/i, ''),
          elements: data.elements ?? [],
          connections: data.connections ?? [],
          viewport: data.viewport ?? { panX: 0, panY: 0, zoom: 1, rotation: 0 },
        })
      } catch {
        alert('Could not read diagram file.')
      }
      // Reset so the same file can be re-imported
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const handleExportWorkspace = () => {
    // Snapshot the active diagram before exporting
    const activeDiagram: Diagram = { id: activeDiagramId, name: diagrams.find(d => d.id === activeDiagramId)?.name ?? 'Untitled', elements, connections, viewport }
    const allDiagrams = diagrams.map(d => d.id === activeDiagramId ? activeDiagram : d)
    const workspace = { version: 1, diagrams: allDiagrams, activeDiagramId }
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workspace.holychart.workplace.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string)
        const importedDiagrams: Diagram[] = (data.diagrams ?? []).map((d: Partial<Diagram>) => ({
          id: d.id ?? Math.random().toString(36).slice(2, 10),
          name: d.name ?? 'Untitled',
          elements: d.elements ?? [],
          connections: d.connections ?? [],
          viewport: d.viewport ?? { panX: 0, panY: 0, zoom: 1, rotation: 0 },
        }))
        if (importedDiagrams.length === 0) throw new Error('No diagrams found')
        setPendingWorkspace({ diagrams: importedDiagrams, activeDiagramId: data.activeDiagramId ?? importedDiagrams[0].id })
      } catch {
        alert('Could not read workspace file.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <>
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '6px 10px',
        backdropFilter: 'var(--backdrop-blur)',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--text)',
      }}
    >
      {/* App name */}
      <Tooltip content="Glory to Jesus Christ!">
      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px', paddingRight: 8, borderRight: '1px solid var(--border)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
        HolyChart <span style={{ fontSize: 18, opacity: 0.8 }}>✝</span>
      </span>
      </Tooltip>

      {/* Add icon */}
      <ToolBtn title="Add icon (I)" onClick={() => openIconSearch()}>
        <IconSvg d="M12 5v14M5 12h14" /> Icon
      </ToolBtn>

      {/* Text tool */}
      <ToolBtn
        title="Text tool (T)"
        onClick={() => { /* T key handles it */ useAppStore.getState().openTextInput(400, 300) }}
        active={toolMode === 'text'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
        Text
      </ToolBtn>

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
        <Tooltip content="Decrease font size">
        <button
          onClick={() => changeFontSize(-2)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >−</button>
        </Tooltip>
        <Tooltip content="Font size (applies to all text)">
        <input
          type="number"
          value={fontSizeInput ?? defaultFontSize}
          min={8} max={96}
          onChange={(e) => setFontSizeInput(e.target.value)}
          onBlur={(e) => commitFontSize(e.target.value)}
          onWheel={(e) => {
            e.preventDefault()
            fontSizeScrollAccum.current += e.deltaY
            const threshold = 20
            if (Math.abs(fontSizeScrollAccum.current) >= threshold) {
              changeFontSize(fontSizeScrollAccum.current < 0 ? 1 : -1)
              fontSizeScrollAccum.current = 0
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') { commitFontSize((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') { setFontSizeInput(null); (e.target as HTMLInputElement).blur() }
          }}
          style={{
            width: 34, textAlign: 'center', background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
            fontSize: 11, padding: '2px 0', outline: 'none',
            MozAppearance: 'textfield',
          } as React.CSSProperties}
        />
        </Tooltip>
        <Tooltip content="Increase font size">
        <button
          onClick={() => changeFontSize(2)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >+</button>
        </Tooltip>
      </div>

      {/* Delete */}
      {selectedIds.length > 0 && (
        <ToolBtn title="Delete (⌫)" onClick={() => deleteSelected()} danger>
          <IconSvg d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </ToolBtn>
      )}

      <Divider />

      {/* Hierarchy move toggle */}
      <ToolBtn
        title={hierarchyMove ? 'Hierarchy move on — box moves carry contents (H to disable)' : 'Hierarchy move off — box moves only move self (H to enable)'}
        onClick={toggleHierarchyMove}
        active={hierarchyMove}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <rect x="6" y="7" width="5" height="4" rx="1" />
          <rect x="13" y="7" width="5" height="4" rx="1" />
          <rect x="9" y="14" width="6" height="4" rx="1" />
        </svg>
      </ToolBtn>

      {/* Rotation toggle */}
      <ToolBtn
        title={rotationEnabled ? 'Rotation enabled (click to lock)' : 'Rotation locked (click to enable)'}
        onClick={toggleRotation}
        active={rotationEnabled}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {rotationEnabled ? (
            <><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></>
          ) : (
            <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
          )}
        </svg>
      </ToolBtn>

      {/* Rotation reset badge — only shows when canvas is rotated */}
      {rotationDeg !== 0 && (
        <Tooltip content="Reset rotation (O)">
        <button
          onClick={resetView}
          style={{ background: 'var(--accent-bg-subtle)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)', color: 'var(--accent-light)', padding: '3px 8px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          {rotationDeg}°
        </button>
        </Tooltip>
      )}

      {/* Zoom */}
      <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 36, textAlign: 'center' }}>
        {Math.round(viewport.zoom * 100)}%
      </span>

      <Divider />

      {/* Theme toggle — cycles system → dark → light → nord */}
      <ToolBtn
        title={`Theme: ${theme} (click to cycle)`}
        onClick={toggleTheme}
        active={theme !== 'system'}
      >
        <ThemeIcon theme={theme} resolvedTheme={resolvedTheme} />
        <span style={{ fontSize: 10, minWidth: 36, textAlign: 'left' }}>{theme}</span>
      </ToolBtn>

      {/* File menu */}
      <Divider />
      <input ref={fileInputRef} type="file" accept=".holychart.json,.json" onChange={handleImport} style={{ display: 'none' }} />
      <input ref={workspaceFileInputRef} type="file" accept=".holychart.workplace.json,.json" onChange={handleImportWorkspace} style={{ display: 'none' }} />
      <Tooltip content="Import / Export">
      <button
        ref={fileMenuBtnRef}
        onClick={() => setFileMenuOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: fileMenuOpen ? 'var(--accent-bg-subtle)' : 'transparent',
          border: fileMenuOpen ? '1px solid var(--accent-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: fileMenuOpen ? 'var(--accent-light)' : 'var(--text-kbd)',
          padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      </button>
      </Tooltip>

    </div>

    {fileMenuOpen && (() => {
      const btn = fileMenuBtnRef.current
      const r = btn?.getBoundingClientRect()
      return (
        <>
          <div onClick={() => setFileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'fixed',
            left: r ? r.left : 0,
            top: r ? r.bottom + 6 : 0,
            zIndex: 150,
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'var(--backdrop-blur)',
            padding: '6px 0',
            minWidth: 200,
          }}>
            {([
              { label: 'Export tab', sub: 'Current diagram as .holychart.json', action: () => { handleExport(); setFileMenuOpen(false) } },
              { label: 'Import tab', sub: 'Add a .holychart.json as a new tab', action: () => { fileInputRef.current?.click(); setFileMenuOpen(false) } },
              null,
              { label: 'Export workspace', sub: 'All tabs as .holychart.workplace.json', action: () => { handleExportWorkspace(); setFileMenuOpen(false) } },
              { label: 'Import workspace', sub: 'Replace all tabs from a workspace file', action: () => { workspaceFileInputRef.current?.click(); setFileMenuOpen(false) } },
            ] as const).map((item, i) =>
              item === null
                ? <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                : <button key={i} onClick={item.action} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 14px', fontFamily: 'var(--font-ui)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg-subtle)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 1 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
                </button>
            )}
          </div>
        </>
      )
    })()}

    {pendingWorkspace && (
      <>
        <div onClick={() => setPendingWorkspace(null)} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 400, background: 'var(--surface-overlay)', border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'var(--backdrop-blur)', padding: '20px 24px', minWidth: 300,
        }}>
          <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
            Replace entire workspace?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            This will replace all {diagrams.length} current tab{diagrams.length !== 1 ? 's' : ''} with {pendingWorkspace.diagrams.length} tab{pendingWorkspace.diagrams.length !== 1 ? 's' : ''} from the file.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPendingWorkspace(null)} style={{
              background: 'none', border: '1px solid var(--border-muted)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>Cancel</button>
            <button onClick={() => { loadWorkspace(pendingWorkspace.diagrams, pendingWorkspace.activeDiagramId); setPendingWorkspace(null) }} style={{
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)',
              color: 'var(--accent-light)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>Replace</button>
          </div>
        </div>
      </>
    )}
    </>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 3px' }} />
}

function IconSvg({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={d} />
    </svg>
  )
}

function ToolBtn({
  children, onClick, title, danger, active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
  active?: boolean
}) {
  return (
    <Tooltip content={title}>
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: active ? 'var(--accent-bg-subtle)' : 'transparent',
        border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
        borderRadius: 'var(--radius-md)',
        color: danger ? 'var(--danger)' : active ? 'var(--accent-light)' : 'var(--text-kbd)',
        padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = danger ? 'var(--danger-bg)' : active ? 'var(--accent-bg)' : 'var(--hover-bg)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = active ? 'var(--accent-bg-subtle)' : 'transparent'
      }}
    >
      {children}
    </button>
    </Tooltip>
  )
}

function ThemeIcon({ theme, resolvedTheme }: { theme: string; resolvedTheme: string }) {
  if (theme === 'system') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    )
  }
  if (resolvedTheme === 'dark') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  }
  if (resolvedTheme === 'light') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    )
  }
  if (resolvedTheme === 'nord') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  // Fallback for any future theme — palette icon
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="8" r="1.5" fill="currentColor" /><circle cx="16" cy="12" r="1.5" fill="currentColor" /><circle cx="8" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
