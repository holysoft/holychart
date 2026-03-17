import { useRef } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { resetRotation } from '../canvas/ViewportMatrix'
import type { Diagram } from '../store/types'

export function Toolbar() {
  const { selectedIds, deleteSelected, openIconSearch, viewport, setViewport, theme, toggleTheme, toolMode, rotationEnabled, toggleRotation, defaultFontSize, setDefaultFontSize, diagrams, activeDiagramId, elements, connections, importDiagram } = useAppStore()
  const resolvedTheme = useAppStore(selectResolvedTheme)
  const isDark = resolvedTheme === 'dark'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const changeFontSize = (delta: number) => setDefaultFontSize(defaultFontSize + delta)
  const setFontSizeDirect = (val: number) => setDefaultFontSize(val)

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
    a.download = `${diagram.name.replace(/[^a-z0-9]/gi, '_')}.json`
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
          name: data.name ?? file.name.replace(/\.json$/i, ''),
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

  return (
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
        background: isDark ? 'rgba(15,15,25,0.92)' : 'rgba(255,255,255,0.92)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 12,
        padding: '6px 10px',
        backdropFilter: 'blur(16px)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.12)',
        color: isDark ? '#e2e8f0' : '#1e293b',
      }}
    >
      {/* App name */}
      <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px', paddingRight: 8, borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, marginRight: 4 }}>
        diagramr
      </span>

      {/* Add icon */}
      <ToolBtn title="Add icon (I)" onClick={() => openIconSearch()} isDark={isDark}>
        <IconSvg d="M12 5v14M5 12h14" /> Icon
      </ToolBtn>

      {/* Text tool */}
      <ToolBtn
        title="Text tool (T)"
        onClick={() => { /* T key handles it */ useAppStore.getState().openTextInput(400, 300) }}
        isDark={isDark}
        active={toolMode === 'text'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
        Text
      </ToolBtn>

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
        <button
          onClick={() => changeFontSize(-2)}
          title="Decrease font size"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(226,232,240,0.6)' : 'rgba(15,23,42,0.6)', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >−</button>
        <input
          type="number"
          value={defaultFontSize}
          min={8} max={96}
          onChange={(e) => setFontSizeDirect(parseInt(e.target.value) || defaultFontSize)}
          onKeyDown={(e) => e.stopPropagation()}
          title="Font size (applies to all text)"
          style={{
            width: 34, textAlign: 'center', background: 'transparent',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 4, color: isDark ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.8)',
            fontSize: 11, padding: '2px 0', outline: 'none',
            MozAppearance: 'textfield',
          } as React.CSSProperties}
        />
        <button
          onClick={() => changeFontSize(2)}
          title="Increase font size"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(226,232,240,0.6)' : 'rgba(15,23,42,0.6)', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >+</button>
      </div>

      {/* Delete */}
      {selectedIds.length > 0 && (
        <ToolBtn title="Delete (⌫)" onClick={() => deleteSelected()} isDark={isDark} danger>
          <IconSvg d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </ToolBtn>
      )}

      <Divider isDark={isDark} />

      {/* Rotation toggle */}
      <ToolBtn
        title={rotationEnabled ? 'Rotation enabled (click to lock)' : 'Rotation locked (click to enable)'}
        onClick={toggleRotation}
        isDark={isDark}
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
        <button
          onClick={resetView}
          title="Reset rotation to origin (O)"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, color: '#a5b4fc', padding: '3px 8px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          {rotationDeg}°
        </button>
      )}

      {/* Zoom */}
      <span style={{ color: isDark ? 'rgba(226,232,240,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 11, minWidth: 36, textAlign: 'center' }}>
        {Math.round(viewport.zoom * 100)}%
      </span>

      <Divider isDark={isDark} />

      {/* Theme toggle — cycles system → dark → light */}
      <ToolBtn
        title={`Theme: ${theme} (click to cycle)`}
        onClick={toggleTheme}
        isDark={isDark}
        active={theme !== 'system'}
      >
        {theme === 'system' ? (
          // Monitor icon = system
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        ) : isDark ? (
          // Moon = dark
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun = light
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
        <span style={{ fontSize: 10 }}>{theme}</span>
      </ToolBtn>

      {/* Export / Import */}
      <Divider isDark={isDark} />
      <ToolBtn title="Export diagram as JSON" onClick={handleExport} isDark={isDark}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </ToolBtn>
      <ToolBtn title="Import diagram from JSON" onClick={() => fileInputRef.current?.click()} isDark={isDark}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </ToolBtn>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />

      {/* Shortcut hints */}
      <Divider isDark={isDark} />
      <div style={{ fontSize: 10, color: isDark ? 'rgba(226,232,240,0.28)' : 'rgba(15,23,42,0.35)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Kbd isDark={isDark}>I</Kbd>
        <Kbd isDark={isDark}>T</Kbd>
        <span title="Hold ⌥ Option + scroll to rotate">⌥+scroll rotate</span>
      </div>
    </div>
  )
}

function Divider({ isDark }: { isDark: boolean }) {
  return <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '0 3px' }} />
}

function Kbd({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <kbd style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 10, fontFamily: 'inherit' }}>
      {children}
    </kbd>
  )
}

function IconSvg({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={d} />
    </svg>
  )
}

function ToolBtn({
  children, onClick, title, isDark, danger, active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  isDark: boolean
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        borderRadius: 6,
        color: danger ? '#f87171' : active ? '#a5b4fc' : isDark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.75)',
        padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = danger ? 'rgba(248,113,113,0.1)' : active ? 'rgba(99,102,241,0.25)' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = active ? 'rgba(99,102,241,0.2)' : 'transparent'
      }}
    >
      {children}
    </button>
  )
}
