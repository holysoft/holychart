import { useEffect, useRef } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { screenToWorld, resetRotation } from '../canvas/ViewportMatrix'
import type { BoxElement } from '../store/types'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

interface MenuItem {
  keys: string[]
  description: string
  action?: () => void
}

function buildItems(store: ReturnType<typeof useAppStore.getState>, pos: { x: number; y: number }): { modeLabel: string; items: MenuItem[] } {
  const { selectedIds, selectedConnectionId, connectingFromId, toolMode, elements, connections, viewport, defaultFontSize, hierarchyMove, toggleHierarchyMove } = store

  const close = () => store.closeContextMenu()

  if (selectedConnectionId) {
    const conn = connections.find((c) => c.id === selectedConnectionId)
    return {
      modeLabel: 'Connection selected',
      items: [
        {
          keys: ['D'], description: 'Reverse direction',          action: () => { store.reverseConnection(selectedConnectionId); close() },
        },
        {
          keys: ['S'], description: 'Cycle style',
          action: () => {
            const styles = ['solid', 'dashed', 'animated'] as const
            const next = styles[(styles.indexOf(conn?.style ?? 'solid') + 1) % styles.length]
            store.updateConnection(selectedConnectionId, { style: next }); close()
          },
        },
        {
          keys: ['C'], description: 'Change color',
          action: () => { store.openColorPicker(pos.x, pos.y); close() },
        },
        {
          keys: ['R'], description: 'Rename',
          action: () => {
            store.openRename(selectedConnectionId, 'connection')
            close()
          },
        },
        {
          keys: ['⌫'], description: 'Delete',
          action: () => { store.deleteConnection(selectedConnectionId); close() },
        },
        {
          keys: ['Esc'], description: 'Deselect',
          action: () => { store.setSelectedConnection(null); close() },
        },
      ],
    }
  }

  if (connectingFromId || toolMode === 'connect') {
    return {
      modeLabel: 'Connect mode',
      items: [
        { keys: ['click'], description: 'Connect to element' },
        { keys: ['Esc'], description: 'Cancel', action: () => { store.cancelConnecting(); close() } },
      ],
    }
  }

  if (toolMode === 'text') {
    return {
      modeLabel: 'Text mode',
      items: [
        { keys: ['click'], description: 'Place text here' },
        { keys: ['Esc'], description: 'Cancel', action: () => { store.closeTextInput(); close() } },
      ],
    }
  }

  if (selectedIds.length > 0) {
    const primaryId = selectedIds[0]
    const el = elements.find((e) => e.id === primaryId)
    const isIcon = el?.type === 'icon'
    const isBox = el?.type === 'box'
    const isSingle = selectedIds.length === 1

    return {
      modeLabel: selectedIds.length > 1 ? `${selectedIds.length} selected` : 'Selected',
      items: [
        {
          keys: ['⌘C'], description: 'Copy',
          action: () => { store.copySelected(); close() },
        },
        {
          keys: ['⌘V'], description: 'Paste',
          action: () => {
            const cv = document.querySelector('canvas')
            const r = cv?.getBoundingClientRect() ?? { left: 0, top: 0 }
            const wp = screenToWorld(pos.x - r.left, pos.y - r.top, viewport)
            store.pasteAt(wp.x, wp.y); close()
          },
        },
        {
          keys: ['⌘D'], description: 'Duplicate',          action: () => { store.copySelected(); store.paste(); close() },
        },
        ...(isSingle ? [{
          keys: ['R'], description: 'Rename',          action: () => { store.openRename(primaryId); close() },
        }] : []),
        ...(isIcon ? [{
          keys: ['S'], description: 'Swap icon image',
          action: () => { store.openIconSearch(undefined, primaryId); close() },
        }] : []),
        ...(isBox ? [{
          keys: ['S'], description: 'Cycle style',
          action: () => {
            const boxEl = el as BoxElement
            const styles = ['solid', 'dashed', 'filled'] as const
            const next = styles[(styles.indexOf(boxEl.style ?? 'solid') + 1) % styles.length]
            store.updateElement(primaryId, { style: next } as Partial<BoxElement>)
            close()
          },
        }] : []),
        {
          keys: ['C'], description: 'Change color',
          action: () => { store.openColorPicker(pos.x, pos.y); close() },
        },
        ...(isSingle ? [{
          keys: ['E'], description: 'Connect edge',
          action: () => { store.startConnecting(primaryId); close() },
        }] : []),
        {
          keys: ['H'], description: hierarchyMove ? 'Hierarchy move: on' : 'Hierarchy move: off',
          action: () => { toggleHierarchyMove(); close() },
        },
        {
          keys: ['⌫'], description: 'Delete',
          action: () => { store.deleteSelected(); close() },
        },
        {
          keys: ['Esc'], description: 'Deselect',
          action: () => { store.setSelectedIds([]); close() },
        },
      ],
    }
  }

  // Canvas — place actions at the right-click world position
  const canvas = document.querySelector('canvas')
  const rect = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 }
  const canvasX = pos.x - rect.left
  const canvasY = pos.y - rect.top
  const worldPos = screenToWorld(canvasX, canvasY, viewport)

  return {
    modeLabel: 'Canvas',
    items: [
      ...(store.clipboard.length > 0 ? [{
        keys: ['⌘V'], description: 'Paste',        action: () => { store.pasteAt(worldPos.x, worldPos.y); close() },
      }] : []),
      {
        keys: ['Q'], description: 'Add icon',
        action: () => { store.openIconSearch({ x: worldPos.x, y: worldPos.y }); close() },
      },
      {
        keys: ['W'], description: 'Add text',
        action: () => { store.openTextInput(canvasX, canvasY); close() },
      },
      {
        keys: ['B'], description: 'Add box',
        action: () => {
          const el: BoxElement = {
            id: genId(), type: 'box',
            x: worldPos.x - 120, y: worldPos.y - 80,
            width: 240, height: 160,
            text: '', fontSize: Math.max(11, defaultFontSize - 2),
          }
          store.addElement(el); store.setSelected(el.id); close()
        },
      },
      {
        keys: ['H'], description: hierarchyMove ? 'Hierarchy move: on' : 'Hierarchy move: off',
        action: () => { toggleHierarchyMove(); close() },
      },
      { keys: ['scroll'], description: 'Pan' },
      { keys: ['pinch'], description: 'Zoom' },
      { keys: ['⌥ + scroll'], description: 'Rotate' },
      {
        keys: ['O'], description: 'Reset rotation',
        action: () => {
          store.setViewport(resetRotation(viewport, canvas?.offsetWidth ?? 800, canvas?.offsetHeight ?? 600))
          close()
        },
      },
    ],
  }
}

export function ContextMenu() {
  const store = useAppStore()
  const contextMenuPos = useAppStore((s) => s.contextMenuPos)
  const closeContextMenu = useAppStore((s) => s.closeContextMenu)
  const theme = useAppStore(selectResolvedTheme)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside pointer-down
  useEffect(() => {
    if (!contextMenuPos) return
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [contextMenuPos, closeContextMenu])

  if (!contextMenuPos) return null

  const { modeLabel, items } = buildItems(useAppStore.getState(), contextMenuPos)

  // Keep menu within viewport
  const menuW = 200
  const menuH = items.length * 30 + 40
  const x = Math.min(contextMenuPos.x, window.innerWidth - menuW - 8)
  const y = Math.min(contextMenuPos.y, window.innerHeight - menuH - 8)

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 300,
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '8px 0',
        backdropFilter: 'var(--backdrop-blur)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: menuW,
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 12px 8px' }}>
        {modeLabel}
      </div>

      {items.map((item, i) => {
        const isActionable = !!item.action
        return (
          <div
            key={i}
            onClick={item.action}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '4px 12px',
              cursor: isActionable ? 'pointer' : 'default',
              opacity: isActionable ? 1 : 0.45,
              borderRadius: 0,
              transition: 'background 0.08s',
            }}
            onMouseEnter={(e) => { if (isActionable) (e.currentTarget as HTMLDivElement).style.background = 'var(--hover-bg-subtle)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {item.keys.map((k, ki) => (
                <kbd
                  key={ki}
                  style={{
                    background: 'var(--kbd-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-kbd)',
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    padding: '1px 6px',
                    display: 'inline-block',
                    lineHeight: '18px',
                  }}
                >
                  {k}
                </kbd>
              ))}
            </div>
            <span style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'right',
            }}>
              {item.description}
            </span>
          </div>
        )
      })}
    </div>
  )
}
