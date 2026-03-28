import { useRef, useState, useEffect } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { resetRotation } from '../canvas/ViewportMatrix'
import { Tooltip } from './Tooltip'
import { PictureInPictureButton } from './PictureInPictureButton'
import type { Diagram } from '../store/types'

const DEFAULT_VIEWPORT = { panX: 0, panY: 0, zoom: 1, rotation: 0 }

type PendingImport =
  | { kind: 'diagram'; fileName: string; diagram: Diagram }
  | {
      kind: 'workspace'
      fileName: string
      diagrams: Diagram[]
      activeDiagramId: string
      reloadHandle?: WorkspaceFileHandle
      importedFileModifiedAt?: number
    }

type WorkspaceFileHandle = {
  name: string
  getFile: () => Promise<File>
}

type WorkspaceReloadSource = {
  fileName: string
  handle: WorkspaceFileHandle
  lastImportedModifiedAt: number
  latestKnownModifiedAt: number
}

type OpenFilePickerOptions = {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

export function Toolbar() {
  const { selectedIds, deleteSelected, openIconSearch, viewport, setViewport, theme, toggleTheme, toolMode, rotationEnabled, toggleRotation, hierarchyMove, toggleHierarchyMove, connectionRouting, setConnectionRouting, defaultFontSize, setDefaultFontSize, diagrams, activeDiagramId, elements, connections, importDiagram, loadWorkspace } = useAppStore()
  const resolvedTheme = useAppStore(selectResolvedTheme)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workspaceFileInputRef = useRef<HTMLInputElement>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const importBtnRef = useRef<HTMLButtonElement>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [workspaceReloadSource, setWorkspaceReloadSource] = useState<WorkspaceReloadSource | null>(null)
  const [isWorkspaceReloading, setIsWorkspaceReloading] = useState(false)
  const [isDropTargetActive, setIsDropTargetActive] = useState(false)
  const dragDepthRef = useRef(0)

  const aiSkillBtnRef = useRef<HTMLButtonElement>(null)
  const [aiSkillMenuOpen, setAiSkillMenuOpen] = useState(false)

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    const installed = () => setIsInstalled(true)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', installed) }
  }, [])
  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }
  const showInstallButton = !isInstalled && (installPrompt || isSafari)

  const [fontSizeInput, setFontSizeInput] = useState<string | null>(null)
  const fontSizeScrollAccum = useRef(0)
  const workspaceHasExternalChanges = !!workspaceReloadSource && workspaceReloadSource.latestKnownModifiedAt > workspaceReloadSource.lastImportedModifiedAt
  const canQuickReloadWorkspace = !!workspaceReloadSource && !isWorkspaceReloading
  const reloadButtonTitle = !workspaceReloadSource
    ? 'Reload workspace (import one first)'
    : workspaceHasExternalChanges
      ? `${workspaceReloadSource.fileName} changed on disk - reload to reimport`
      : `Reload ${workspaceReloadSource.fileName}`
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

  const loadImportFile = async (file: File, options?: { reloadHandle?: WorkspaceFileHandle }) => {
    const parsed = parseImportFile(await file.text(), file.name)
    if (parsed.kind === 'workspace' && options?.reloadHandle) {
      setPendingImport({
        ...parsed,
        reloadHandle: options.reloadHandle,
        importedFileModifiedAt: file.lastModified,
      })
      return
    }
    setPendingImport(parsed)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ''
      return
    }
    try {
      await loadImportFile(file)
    } catch {
      alert('Could not read chart file.')
    }
    e.target.value = ''
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

  const handleImportWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ''
      return
    }
    try {
      await loadImportFile(file)
    } catch {
      alert('Could not read workspace file.')
    }
    e.target.value = ''
  }

  const handleImportWorkspaceFromPicker = async () => {
    setImportMenuOpen(false)
    const showOpenFilePicker = (window as Window & {
      showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<WorkspaceFileHandle[]>
    }).showOpenFilePicker

    if (!showOpenFilePicker) {
      workspaceFileInputRef.current?.click()
      return
    }

    try {
      const [handle] = await showOpenFilePicker({
        multiple: false,
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        }],
      })
      if (!handle) return
      const file = await handle.getFile()
      await loadImportFile(file, { reloadHandle: handle })
    } catch (error) {
      if (isAbortError(error)) return
      if (error instanceof TypeError) {
        workspaceFileInputRef.current?.click()
        return
      }
      alert('Could not read workspace file.')
    }
  }

  const handleReloadWorkspace = async () => {
    if (!workspaceReloadSource) return
    setIsWorkspaceReloading(true)
    try {
      const file = await workspaceReloadSource.handle.getFile()
      await loadImportFile(file, { reloadHandle: workspaceReloadSource.handle })
    } catch {
      alert(`Could not reload ${workspaceReloadSource.fileName}.`)
    } finally {
      setIsWorkspaceReloading(false)
    }
  }

  useEffect(() => {
    const resetDropTarget = () => {
      dragDepthRef.current = 0
      setIsDropTargetActive(false)
    }

    const handleDragEnter = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      dragDepthRef.current += 1
      setIsDropTargetActive(true)
      setExportMenuOpen(false)
      setImportMenuOpen(false)
      setAiSkillMenuOpen(false)
    }

    const handleDragOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setIsDropTargetActive(false)
    }

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      resetDropTarget()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return
      if (files.length > 1) {
        alert('Drop one chart or workspace file at a time.')
        return
      }
      void loadImportFile(files[0]).catch(() => {
        alert('Could not read dropped file.')
      })
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('blur', resetDropTarget)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('blur', resetDropTarget)
    }
  }, [])

  useEffect(() => {
    if (!workspaceReloadSource) return

    const { handle } = workspaceReloadSource

    let cancelled = false
    const syncWorkspaceTimestamp = async () => {
      try {
        const file = await handle.getFile()
        if (cancelled) return
        setWorkspaceReloadSource((current) => {
          if (!current || current.handle !== handle) return current
          if (current.fileName === file.name && current.latestKnownModifiedAt === file.lastModified) return current
          return { ...current, fileName: file.name, latestKnownModifiedAt: file.lastModified }
        })
      } catch {}
    }

    void syncWorkspaceTimestamp()
    const timer = window.setInterval(() => {
      void syncWorkspaceTimestamp()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [workspaceReloadSource?.handle])

  const confirmPendingImport = () => {
    if (!pendingImport) return
    if (pendingImport.kind === 'diagram') {
      importDiagram(pendingImport.diagram)
    } else {
      loadWorkspace(pendingImport.diagrams, pendingImport.activeDiagramId)
      if (pendingImport.reloadHandle) {
        const lastImportedModifiedAt = pendingImport.importedFileModifiedAt ?? Date.now()
        setWorkspaceReloadSource({
          fileName: pendingImport.fileName,
          handle: pendingImport.reloadHandle,
          lastImportedModifiedAt,
          latestKnownModifiedAt: lastImportedModifiedAt,
        })
      } else {
        setWorkspaceReloadSource(null)
      }
    }
    setPendingImport(null)
  }

  const handleDownloadAiSkill = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}holychart-diagram-skill.md`)
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'holychart-diagram-skill.md'
    a.click()
    URL.revokeObjectURL(url)
    setAiSkillMenuOpen(false)
  }

  return (
    <>
    {isDropTargetActive && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'color-mix(in srgb, var(--bg) 68%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          padding: '24px 28px',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed var(--accent-border)',
          background: 'var(--surface-overlay)',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text)',
          textAlign: 'center',
          maxWidth: 'min(420px, calc(100vw - 32px))',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Drop to import</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Drop a chart or workspace JSON file to review it before loading.
          </div>
        </div>
      </div>
    )}
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
        maxWidth: 'calc(100vw - 24px)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      {/* App name */}
      <Tooltip content="Glory to Jesus Christ!">
      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px', paddingRight: 8, borderRight: '1px solid var(--border)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
        HolyChart <span style={{ fontSize: 18, opacity: 0.8 }}>✝</span>
      </span>
      </Tooltip>

      {/* Add icon */}
      <ToolBtn title="Add icon (Q)" onClick={() => openIconSearch()}>
        <IconSvg d="M12 5v14M5 12h14" /> Icon
      </ToolBtn>

      {/* Text tool */}
      <ToolBtn
        title="Text tool (W)"
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

      {/* Line routing toggle */}
      <ToolBtn
        title={`Line routing: ${connectionRouting} (L to cycle)`}
        onClick={() => {
          const modes = ['straight', 'curve'] as const
          setConnectionRouting(modes[(modes.indexOf(connectionRouting) + 1) % modes.length])
        }}
      >
        {connectionRouting === 'straight' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="15,8 19,12 15,16" fill="none" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5,7 C11,7 13,17 19,17" fill="none" />
            <polyline points="15,13 19,17 15,21" fill="none" />
          </svg>
        )}
        <span style={{ fontSize: 10, minWidth: 40, textAlign: 'left' }}>{connectionRouting}</span>
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

      {/* Export / Import */}
      <Divider />
      <input ref={fileInputRef} type="file" accept=".holychart.json,.json" onChange={handleImport} style={{ display: 'none' }} />
      <input ref={workspaceFileInputRef} type="file" accept=".holychart.workplace.json,.holychart.workspace.json,.json" onChange={handleImportWorkspace} style={{ display: 'none' }} />
      <Tooltip content="Export">
      <button
        ref={exportBtnRef}
        onClick={() => { setExportMenuOpen(o => !o); setImportMenuOpen(false); setAiSkillMenuOpen(false) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: exportMenuOpen ? 'var(--accent-bg-subtle)' : 'transparent',
          border: exportMenuOpen ? '1px solid var(--accent-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: exportMenuOpen ? 'var(--accent-light)' : 'var(--text-kbd)',
          padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      </Tooltip>
      <Tooltip content="Import">
      <button
        ref={importBtnRef}
        onClick={() => { setImportMenuOpen(o => !o); setExportMenuOpen(false); setAiSkillMenuOpen(false) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: importMenuOpen ? 'var(--accent-bg-subtle)' : 'transparent',
          border: importMenuOpen ? '1px solid var(--accent-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: importMenuOpen ? 'var(--accent-light)' : 'var(--text-kbd)',
          padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
      </Tooltip>
      <Tooltip content={reloadButtonTitle}>
      <button
        onClick={() => { void handleReloadWorkspace() }}
        disabled={!canQuickReloadWorkspace}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: workspaceHasExternalChanges
            ? 'color-mix(in srgb, #f59e0b 16%, transparent)'
            : workspaceReloadSource
              ? 'var(--accent-bg-subtle)'
              : 'transparent',
          border: workspaceHasExternalChanges
            ? '1px solid color-mix(in srgb, #f59e0b 56%, var(--border))'
            : workspaceReloadSource
              ? '1px solid var(--accent-border)'
              : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: workspaceHasExternalChanges
            ? 'color-mix(in srgb, #fbbf24 72%, var(--text))'
            : workspaceReloadSource
              ? 'var(--accent-light)'
              : 'var(--text-kbd)',
          opacity: canQuickReloadWorkspace ? 1 : 0.45,
          padding: '3px 8px',
          cursor: canQuickReloadWorkspace ? 'pointer' : 'not-allowed',
          fontSize: 12,
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!canQuickReloadWorkspace) return
          e.currentTarget.style.background = workspaceHasExternalChanges
            ? 'color-mix(in srgb, #f59e0b 22%, transparent)'
            : 'var(--accent-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = workspaceHasExternalChanges
            ? 'color-mix(in srgb, #f59e0b 16%, transparent)'
            : workspaceReloadSource
              ? 'var(--accent-bg-subtle)'
              : 'transparent'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        {workspaceHasExternalChanges && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
          }}>
            Updated
          </span>
        )}
      </button>
      </Tooltip>

      <PictureInPictureButton />

      {/* AI Skill */}
      <Tooltip content="AI diagram skill">
      <button
        ref={aiSkillBtnRef}
        onClick={() => { setAiSkillMenuOpen(o => !o); setExportMenuOpen(false); setImportMenuOpen(false) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: aiSkillMenuOpen ? 'var(--accent-bg-subtle)' : 'transparent',
          border: aiSkillMenuOpen ? '1px solid var(--accent-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: aiSkillMenuOpen ? 'var(--accent-light)' : 'var(--text-kbd)',
          padding: '3px 8px', cursor: 'pointer', fontSize: 12, transition: 'all 0.12s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="9" cy="16" r="1" fill="currentColor" />
          <circle cx="15" cy="16" r="1" fill="currentColor" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <path d="M12 3v0" />
          <line x1="4" y1="3" x2="4" y2="7" />
          <line x1="20" y1="3" x2="20" y2="7" />
        </svg>
      </button>
      </Tooltip>

      {showInstallButton && (
        <>
          <Divider />
          <ToolBtn
            title={isSafari && !installPrompt
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Tap <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then &ldquo;Add to Dock&rdquo;</span>
              : 'Install app'}
            onClick={installPrompt ? handleInstall : () => {}}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
              <path d="M4 19h16"/>
            </svg>
            Install
          </ToolBtn>
        </>
      )}

    </div>

    {(exportMenuOpen || importMenuOpen) && (() => {
      const isExport = exportMenuOpen
      const btnRef = isExport ? exportBtnRef : importBtnRef
      const r = btnRef.current?.getBoundingClientRect()
      const items = isExport
        ? [
            { label: 'Export tab', sub: 'Current diagram as .holychart.json', action: () => { handleExport(); setExportMenuOpen(false) } },
            { label: 'Export workspace', sub: 'All tabs as .holychart.workplace.json', action: () => { handleExportWorkspace(); setExportMenuOpen(false) } },
          ]
        : [
            { label: 'Import tab', sub: 'Add a .holychart.json as a new tab', action: () => { fileInputRef.current?.click(); setImportMenuOpen(false) } },
            { label: 'Import workspace', sub: 'Replace all tabs and remember it for reload', action: () => { void handleImportWorkspaceFromPicker() } },
          ]
      return (
        <>
          <div onClick={() => { setExportMenuOpen(false); setImportMenuOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'fixed', left: r ? r.left : 0, top: r ? r.bottom + 6 : 0,
            zIndex: 150, background: 'var(--surface-overlay)', border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'var(--backdrop-blur)', padding: '6px 0', minWidth: 210,
          }}>
            {items.map((item, i) => (
              <button key={i} onClick={item.action} style={{
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
            ))}
          </div>
        </>
      )
    })()}

    {aiSkillMenuOpen && (() => {
      const r = aiSkillBtnRef.current?.getBoundingClientRect()
      return (
        <>
          <div onClick={() => setAiSkillMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{
            position: 'fixed', left: r ? Math.min(r.left, window.innerWidth - 310) : 0, top: r ? r.bottom + 6 : 0,
            zIndex: 150, background: 'var(--surface-overlay)', border: '1px solid var(--border-muted)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'var(--backdrop-blur)', padding: '14px 16px', width: 290,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="9" cy="16" r="1" fill="var(--accent)" />
                <circle cx="15" cy="16" r="1" fill="var(--accent)" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                <path d="M12 3v0" />
                <line x1="4" y1="3" x2="4" y2="7" />
                <line x1="20" y1="3" x2="20" y2="7" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>AI Diagram Skill</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
              Teach any AI assistant how to create HolyChart diagrams. This skill file contains the full schema reference, icon library, layout guidelines, and examples.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 14 }}>
              Drop it into your AI tool's context (Claude Projects, custom GPTs, Cursor rules, etc.) and it will generate <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, padding: '1px 4px', background: 'var(--hover-bg)', borderRadius: 'var(--radius-sm)' }}>.holychart.json</span> files you can import directly.
            </p>
            <button
              onClick={handleDownloadAiSkill}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--accent-light)',
                padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Skill File
            </button>
          </div>
        </>
      )
    })()}

    {pendingImport && (
      <>
        <div onClick={() => setPendingImport(null)} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 400, background: 'var(--surface-overlay)', border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'var(--backdrop-blur)', padding: '20px 24px', minWidth: 300,
        }}>
          <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
            {pendingImport.kind === 'workspace' ? 'Replace entire workspace?' : 'Import chart as a new tab?'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {pendingImport.kind === 'workspace'
              ? `This will replace all ${diagrams.length} current tab${diagrams.length !== 1 ? 's' : ''} with ${pendingImport.diagrams.length} tab${pendingImport.diagrams.length !== 1 ? 's' : ''} from ${pendingImport.fileName}.`
              : `This will import \"${pendingImport.diagram.name}\" from ${pendingImport.fileName} as a new tab and switch to it.`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            {pendingImport.kind === 'workspace'
              ? 'This cannot be undone.'
              : `The imported chart contains ${pendingImport.diagram.elements.length} element${pendingImport.diagram.elements.length !== 1 ? 's' : ''} and ${pendingImport.diagram.connections.length} connection${pendingImport.diagram.connections.length !== 1 ? 's' : ''}.`}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPendingImport(null)} style={{
              background: 'none', border: '1px solid var(--border-muted)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>Cancel</button>
            <button onClick={confirmPendingImport} style={{
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)',
              color: 'var(--accent-light)', padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>{pendingImport.kind === 'workspace' ? 'Replace' : 'Import'}</button>
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

function hasFiles(dataTransfer: DataTransfer | null) {
  return Array.from(dataTransfer?.types ?? []).includes('Files')
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function parseImportFile(text: string, fileName: string): PendingImport {
  const data = JSON.parse(text) as unknown

  if (looksLikeWorkspace(data)) {
    const diagrams = data.diagrams.map((diagram) => normalizeDiagram(diagram, getBaseName(fileName)))
    if (diagrams.length === 0) throw new Error('No diagrams found')
    const activeDiagramId = typeof data.activeDiagramId === 'string' && diagrams.some((diagram) => diagram.id === data.activeDiagramId)
      ? data.activeDiagramId
      : diagrams[0].id
    return { kind: 'workspace', fileName, diagrams, activeDiagramId }
  }

  if (looksLikeDiagram(data)) {
    return { kind: 'diagram', fileName, diagram: normalizeDiagram(data, getBaseName(fileName)) }
  }

  throw new Error('Unsupported file')
}

function looksLikeWorkspace(data: unknown): data is { diagrams: Partial<Diagram>[]; activeDiagramId?: string } {
  return !!data && typeof data === 'object' && Array.isArray((data as { diagrams?: unknown }).diagrams)
}

function looksLikeDiagram(data: unknown): data is Partial<Diagram> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return 'elements' in data || 'connections' in data || 'viewport' in data || 'name' in data
}

function normalizeDiagram(diagram: Partial<Diagram>, fallbackName: string): Diagram {
  return {
    id: diagram.id ?? Math.random().toString(36).slice(2, 10),
    name: diagram.name ?? (fallbackName || 'Untitled'),
    elements: diagram.elements ?? [],
    connections: diagram.connections ?? [],
    viewport: diagram.viewport ?? DEFAULT_VIEWPORT,
  }
}

function getBaseName(fileName: string) {
  return fileName
    .replace(/\.holychart\.workplace\.json$/i, '')
    .replace(/\.holychart\.workspace\.json$/i, '')
    .replace(/\.holychart\.json$/i, '')
    .replace(/\.json$/i, '')
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
  title: React.ReactNode
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
