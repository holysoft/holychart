import { create } from 'zustand'
import type { ViewportState, DiagramElement, ElementId, ToolMode, Theme, ConnectionElement, Diagram } from './types'

// ── System theme ──────────────────────────────────────────────────────────────

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// ── Diagram helpers ───────────────────────────────────────────────────────────

const BLANK_VIEWPORT: ViewportState = { panX: 0, panY: 0, zoom: 1, rotation: 0 }

function makeDiagram(overrides?: Partial<Diagram>): Diagram {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: 'Untitled',
    elements: [],
    connections: [],
    viewport: { ...BLANK_VIEWPORT },
    ...overrides,
  }
}

function snapshotActive(s: AppState): Diagram {
  return {
    id: s.activeDiagramId,
    name: s.diagrams.find((d) => d.id === s.activeDiagramId)?.name ?? 'Untitled',
    elements: s.elements,
    connections: s.connections,
    viewport: s.viewport,
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'diagramr:v1'

function loadFromStorage(): { diagrams: Diagram[]; activeDiagramId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToStorage(diagrams: Diagram[], activeDiagramId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ diagrams, activeDiagramId }))
  } catch { /* quota exceeded */ }
}

// ── Shared ephemeral reset (applied when switching diagrams) ──────────────────

const EPHEMERAL_RESET = {
  selectedIds: [] as string[],
  selectedConnectionId: null,
  connectingFromId: null,
  connectionPreviewPos: null,
  toolMode: 'select' as ToolMode,
  isIconSearchOpen: false,
  textInputPos: null,
  isColorPickerOpen: false,
  renamingId: null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AppState {
  // Multi-diagram
  diagrams: Diagram[]
  activeDiagramId: string
  // Working canvas state
  viewport: ViewportState
  elements: DiagramElement[]
  connections: ConnectionElement[]
  selectedIds: string[]
  selectedConnectionId: ElementId | null
  toolMode: ToolMode
  rotationEnabled: boolean
  defaultFontSize: number
  // Theme
  theme: Theme
  systemTheme: 'dark' | 'light'
  // UI overlays
  isIconSearchOpen: boolean
  iconSearchQuery: string
  pendingPlacementPos: { x: number; y: number } | null
  swappingIconId: string | null
  textInputPos: { screenX: number; screenY: number } | null
  clipboard: DiagramElement | null
  isColorPickerOpen: boolean
  colorPickerPos: { x: number; y: number }
  renamingId: string | null
  connectingFromId: ElementId | null
  connectionPreviewPos: { x: number; y: number } | null

  // Diagram tabs
  createDiagram: () => void
  switchDiagram: (id: string) => void
  renameDiagram: (id: string, name: string) => void
  deleteDiagram: (id: string) => void
  importDiagram: (diagram: Diagram) => void
  // Canvas
  setViewport: (vp: ViewportState) => void
  updateViewport: (partial: Partial<ViewportState>) => void
  addElement: (el: DiagramElement) => void
  updateElement: (id: ElementId, partial: Partial<DiagramElement>) => void
  deleteElement: (id: ElementId) => void
  setSelected: (id: ElementId | null) => void
  setSelectedIds: (ids: string[]) => void
  deleteSelected: () => void
  setSelectedConnection: (id: ElementId | null) => void
  updateConnection: (id: ElementId, partial: Partial<Pick<ConnectionElement, 'label' | 'color' | 'style'>>) => void
  setToolMode: (mode: ToolMode) => void
  toggleRotation: () => void
  setDefaultFontSize: (size: number) => void
  // Theme
  toggleTheme: () => void
  setSystemTheme: (t: 'dark' | 'light') => void
  // Overlays
  openIconSearch: (pos?: { x: number; y: number }, swapId?: string) => void
  closeIconSearch: () => void
  setIconSearchQuery: (q: string) => void
  openTextInput: (screenX: number, screenY: number) => void
  closeTextInput: () => void
  copySelected: () => void
  paste: () => void
  openColorPicker: (x: number, y: number) => void
  closeColorPicker: () => void
  openRename: (id: string) => void
  closeRename: () => void
  // Connections
  addConnection: (c: ConnectionElement) => void
  deleteConnection: (id: ElementId) => void
  reverseConnection: (id: ElementId) => void
  startConnecting: (fromId: ElementId) => void
  finishConnecting: (toId: ElementId) => void
  cancelConnecting: () => void
  setConnectionPreviewPos: (pos: { x: number; y: number } | null) => void
}

export const selectResolvedTheme = (s: AppState): 'dark' | 'light' =>
  s.theme === 'system' ? s.systemTheme : (s.theme as 'dark' | 'light')

export const selectPrimaryId = (s: AppState): string | null => s.selectedIds[0] ?? null

// Hydrate from localStorage if available
const saved = loadFromStorage()
const firstDiagram = makeDiagram({ name: 'Diagram 1' })
const _diagrams: Diagram[] = saved?.diagrams ?? [firstDiagram]
const _activeId: string = saved?.activeDiagramId ?? firstDiagram.id
const _active: Diagram = _diagrams.find((d) => d.id === _activeId) ?? _diagrams[0]

export const useAppStore = create<AppState>((set, get) => ({
  diagrams: _diagrams,
  activeDiagramId: _active.id,
  viewport: _active.viewport,
  elements: _active.elements,
  connections: _active.connections,
  selectedIds: [],
  selectedConnectionId: null,
  toolMode: 'select',
  rotationEnabled: true,
  defaultFontSize: 16,
  theme: 'system',
  systemTheme: getSystemTheme(),
  isIconSearchOpen: false,
  iconSearchQuery: '',
  pendingPlacementPos: null,
  swappingIconId: null,
  textInputPos: null,
  clipboard: null,
  isColorPickerOpen: false,
  colorPickerPos: { x: 0, y: 0 },
  renamingId: null,
  connectingFromId: null,
  connectionPreviewPos: null,

  // ── Diagram tabs ────────────────────────────────────────────────────────────

  createDiagram: () =>
    set((s) => {
      const updated = s.diagrams.map((d) =>
        d.id === s.activeDiagramId ? snapshotActive(s) : d
      )
      const next = makeDiagram({ name: `Diagram ${updated.length + 1}` })
      return { diagrams: [...updated, next], activeDiagramId: next.id, elements: next.elements, connections: next.connections, viewport: next.viewport, ...EPHEMERAL_RESET }
    }),

  switchDiagram: (id) =>
    set((s) => {
      if (id === s.activeDiagramId) return {}
      const updated = s.diagrams.map((d) =>
        d.id === s.activeDiagramId ? snapshotActive(s) : d
      )
      const target = updated.find((d) => d.id === id)
      if (!target) return {}
      return { diagrams: updated, activeDiagramId: id, elements: target.elements, connections: target.connections, viewport: target.viewport, ...EPHEMERAL_RESET }
    }),

  renameDiagram: (id, name) =>
    set((s) => ({ diagrams: s.diagrams.map((d) => d.id === id ? { ...d, name } : d) })),

  deleteDiagram: (id) =>
    set((s) => {
      if (s.diagrams.length <= 1) return {}
      const remaining = s.diagrams.filter((d) => d.id !== id)
      if (id !== s.activeDiagramId) return { diagrams: remaining }
      const idx = s.diagrams.findIndex((d) => d.id === id)
      const fallback = remaining[Math.max(0, idx - 1)]
      return { diagrams: remaining, activeDiagramId: fallback.id, elements: fallback.elements, connections: fallback.connections, viewport: fallback.viewport, ...EPHEMERAL_RESET }
    }),
  importDiagram: (diagram) =>
    set((s) => {
      // Save current diagram first, then add imported one and switch to it
      const updated = s.diagrams.map((d) =>
        d.id === s.activeDiagramId ? snapshotActive(s) : d
      )
      const fresh = { ...diagram, id: Math.random().toString(36).slice(2, 10) }
      return { diagrams: [...updated, fresh], activeDiagramId: fresh.id, elements: fresh.elements, connections: fresh.connections, viewport: fresh.viewport, ...EPHEMERAL_RESET }
    }),

  // ── Canvas ──────────────────────────────────────────────────────────────────

  setViewport: (viewport) => set({ viewport }),
  updateViewport: (partial) => set((s) => ({ viewport: { ...s.viewport, ...partial } })),
  addElement: (el) => set((s) => ({ elements: [...s.elements, el] })),
  updateElement: (id, partial) =>
    set((s) => ({ elements: s.elements.map((e) => e.id === id ? ({ ...e, ...partial } as DiagramElement) : e) })),
  deleteElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      connections: s.connections.filter((c) => c.fromId !== id && c.toId !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    })),
  setSelected: (id) => set({ selectedIds: id ? [id] : [], selectedConnectionId: null }),
  setSelectedIds: (selectedIds) => set({ selectedIds, selectedConnectionId: null }),
  deleteSelected: () =>
    set((s) => {
      const ids = new Set(s.selectedIds)
      return {
        elements: s.elements.filter((e) => !ids.has(e.id)),
        connections: s.connections.filter((c) => !ids.has(c.fromId) && !ids.has(c.toId)),
        selectedIds: [],
      }
    }),
  setSelectedConnection: (selectedConnectionId) => set({ selectedConnectionId, selectedIds: [] }),
  updateConnection: (id, partial) =>
    set((s) => ({ connections: s.connections.map((c) => c.id === id ? { ...c, ...partial } : c) })),
  setToolMode: (toolMode) => set({ toolMode }),

  toggleRotation: () => set((s) => ({ rotationEnabled: !s.rotationEnabled })),
  setDefaultFontSize: (size) => set({ defaultFontSize: Math.max(8, Math.min(96, size)) }),

  // ── Theme ───────────────────────────────────────────────────────────────────

  toggleTheme: () =>
    set((s) => {
      const order: Theme[] = ['system', 'dark', 'light']
      return { theme: order[(order.indexOf(s.theme) + 1) % order.length] }
    }),
  setSystemTheme: (systemTheme) => set({ systemTheme }),

  // ── Overlays ────────────────────────────────────────────────────────────────

  openIconSearch: (pos, swapId) =>
    set({ isIconSearchOpen: true, iconSearchQuery: '', pendingPlacementPos: pos ?? null, swappingIconId: swapId ?? null }),
  closeIconSearch: () =>
    set({ isIconSearchOpen: false, iconSearchQuery: '', pendingPlacementPos: null, swappingIconId: null }),
  setIconSearchQuery: (iconSearchQuery) => set({ iconSearchQuery }),
  openTextInput: (screenX, screenY) =>
    set({ textInputPos: { screenX, screenY }, toolMode: 'text' }),
  closeTextInput: () => set({ textInputPos: null, toolMode: 'select' }),
  copySelected: () =>
    set((s) => {
      const el = s.elements.find((e) => e.id === s.selectedIds[0])
      return el ? { clipboard: el } : {}
    }),
  paste: () =>
    set((s) => {
      if (!s.clipboard) return {}
      const newEl: DiagramElement = { ...s.clipboard, id: Math.random().toString(36).slice(2, 10), x: s.clipboard.x + 20, y: s.clipboard.y + 20 }
      return { elements: [...s.elements, newEl], selectedIds: [newEl.id] }
    }),
  openColorPicker: (x, y) => set({ isColorPickerOpen: true, colorPickerPos: { x, y } }),
  closeColorPicker: () => set({ isColorPickerOpen: false }),
  openRename: (id) => set({ renamingId: id }),
  closeRename: () => set({ renamingId: null }),

  // ── Connections ─────────────────────────────────────────────────────────────

  addConnection: (c) => set((s) => ({ connections: [...s.connections, c] })),
  deleteConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  reverseConnection: (id) =>
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === id ? { ...c, fromId: c.toId, toId: c.fromId } : c
      ),
    })),
  startConnecting: (fromId) =>
    set({ connectingFromId: fromId, toolMode: 'connect', connectionPreviewPos: null }),
  finishConnecting: (toId) => {
    const { connectingFromId, connections } = get()
    if (!connectingFromId || toId === connectingFromId) {
      set({ connectingFromId: null, connectionPreviewPos: null, toolMode: 'select' })
      return
    }
    const exists = connections.some((c) => c.fromId === connectingFromId && c.toId === toId)
    if (!exists) {
      const newConn: ConnectionElement = { id: Math.random().toString(36).slice(2, 10), type: 'connection', fromId: connectingFromId, toId }
      set((s) => ({ connections: [...s.connections, newConn] }))
    }
    set({ connectingFromId: null, connectionPreviewPos: null, toolMode: 'select' })
  },
  cancelConnecting: () =>
    set({ connectingFromId: null, connectionPreviewPos: null, toolMode: 'select', selectedConnectionId: null }),
  setConnectionPreviewPos: (connectionPreviewPos) => set({ connectionPreviewPos }),
}))

// ── Auto-save (module-level, debounced) ───────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null

useAppStore.subscribe((state) => {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    const snapshot = snapshotActive(state)
    const diagrams = state.diagrams.map((d) =>
      d.id === state.activeDiagramId ? snapshot : d
    )
    saveToStorage(diagrams, state.activeDiagramId)
  }, 500)
})
