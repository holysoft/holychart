import { useAppStore, selectResolvedTheme } from '../store/useAppStore'

interface Shortcut {
  keys: string[]
  description: string
}

export function ShortcutsHint() {
  const { toolMode, selectedIds, selectedConnectionId, connectingFromId, isIconSearchOpen, textInputPos, elements, hierarchyMove } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)

  // Don't show on touch/mobile devices or when search/text input is open
  if ('ontouchstart' in window && window.innerWidth < 1024) return null
  if (isIconSearchOpen || textInputPos) return null

  let shortcuts: Shortcut[] = []
  let modeLabel = ''

  if (selectedConnectionId) {
    modeLabel = 'Connection selected'
    shortcuts = [
      { keys: ['D'], description: 'Reverse direction' },
      { keys: ['S'], description: 'Line style' },
      { keys: ['C'], description: 'Change color' },
      { keys: ['R'], description: 'Rename' },
      { keys: ['⌫'], description: 'Delete' },
      { keys: ['Esc'], description: 'Deselect' },
    ]
  } else if (connectingFromId || toolMode === 'connect') {
    modeLabel = 'Connect mode'
    shortcuts = [
      { keys: ['click'], description: 'Connect to element' },
      { keys: ['Q'], description: 'Create icon + connect' },
      { keys: ['W'], description: 'Create text + connect' },
      { keys: ['B'], description: 'Create box + connect' },
      { keys: ['S'], description: 'Line style' },
      { keys: ['Esc'], description: 'Cancel' },
    ]
  } else if (toolMode === 'text') {
    modeLabel = 'Text mode'
    shortcuts = [
      { keys: ['click'], description: 'Place text here' },
      { keys: ['Esc'], description: 'Cancel' },
    ]
  } else if (selectedIds.length > 0) {
    const primaryEl = elements.find((e) => e.id === selectedIds[0])
    const isIcon = primaryEl?.type === 'icon'
    const isBox = primaryEl?.type === 'box'
    modeLabel = selectedIds.length > 1 ? `${selectedIds.length} selected` : 'Selected'
    shortcuts = [
      { keys: ['drag'], description: 'Move' },
      { keys: ['⌘C'], description: 'Copy' },
      { keys: ['⌘V'], description: 'Paste' },
      { keys: ['⌘D'], description: 'Duplicate' },
      { keys: ['R'], description: 'Rename' },
      ...(isIcon ? [{ keys: ['S'], description: 'Swap icon image' }] : []),
      ...(isBox ? [{ keys: ['S'], description: 'Cycle box style' }] : []),
      { keys: ['C'], description: 'Change color' },
      { keys: ['E'], description: 'Connect edge' },
      { keys: ['B'], description: 'Box around selection' },
      { keys: ['H'], description: hierarchyMove ? 'Hierarchy move: on' : 'Hierarchy move: off' },
      { keys: ['⌫'], description: 'Delete' },
      { keys: ['Esc'], description: 'Deselect' },
    ]
  } else {
    modeLabel = 'Canvas'
    shortcuts = [
      { keys: ['Q'], description: 'Add icon' },
      { keys: ['W'], description: 'Add text' },
      { keys: ['B'], description: 'Add box' },
      { keys: ['L'], description: 'Line routing' },
      { keys: ['H'], description: hierarchyMove ? 'Hierarchy move: on' : 'Hierarchy move: off' },
      { keys: ['scroll'], description: 'Pan' },
      { keys: ['pinch'], description: 'Zoom' },
      { keys: ['⌥ + scroll'], description: 'Rotate' },
      { keys: ['O'], description: 'Reset rotation' },
    ]
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 54,
        right: 20,
        zIndex: 40,
        background: 'var(--surface-glass)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        backdropFilter: 'var(--backdrop-blur)',
        boxShadow: 'var(--shadow-md)',
        minWidth: 180,
      }}
    >
      {/* Mode label */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
        {modeLabel}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {shortcuts.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {s.keys.map((k, ki) => (
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
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
              {s.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
