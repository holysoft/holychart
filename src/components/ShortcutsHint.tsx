import { useAppStore, selectResolvedTheme } from '../store/useAppStore'

interface Shortcut {
  keys: string[]
  description: string
  highlight?: boolean
}

export function ShortcutsHint() {
  const { toolMode, selectedIds, selectedConnectionId, connectingFromId, isIconSearchOpen, textInputPos } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)

  // Don't show when search or text input is open
  if (isIconSearchOpen || textInputPos) return null

  let shortcuts: Shortcut[] = []
  let modeLabel = ''

  if (selectedConnectionId) {
    modeLabel = 'Connection selected'
    shortcuts = [
      { keys: ['D'], description: 'Reverse direction', highlight: true },
      { keys: ['S'], description: 'Cycle style (solid/dashed/animated)' },
      { keys: ['C'], description: 'Change color' },
      { keys: ['T'], description: 'Edit label' },
      { keys: ['⌫'], description: 'Delete' },
      { keys: ['Esc'], description: 'Deselect' },
    ]
  } else if (connectingFromId || toolMode === 'connect') {
    modeLabel = 'Connect mode'
    shortcuts = [
      { keys: ['click'], description: 'Connect to element', highlight: true },
      { keys: ['Esc'], description: 'Cancel' },
    ]
  } else if (toolMode === 'text') {
    modeLabel = 'Text mode'
    shortcuts = [
      { keys: ['click'], description: 'Place text here', highlight: true },
      { keys: ['Esc'], description: 'Cancel' },
    ]
  } else if (selectedIds.length > 0) {
    modeLabel = selectedIds.length > 1 ? `${selectedIds.length} selected` : 'Selected'
    shortcuts = [
      { keys: ['drag'], description: 'Move' },
      { keys: ['⌘C'], description: 'Copy' },
      { keys: ['⌘V'], description: 'Paste' },
      { keys: ['⌘D'], description: 'Duplicate', highlight: true },
      { keys: ['R'], description: 'Rename', highlight: true },
      { keys: ['S'], description: 'Swap icon image' },
      { keys: ['C'], description: 'Change color' },
      { keys: ['E'], description: 'Connect edge' },
      { keys: ['⌫'], description: 'Delete' },
      { keys: ['Esc'], description: 'Deselect' },
    ]
  } else {
    modeLabel = 'Canvas'
    shortcuts = [
      { keys: ['Q'], description: 'Add icon' },
      { keys: ['T'], description: 'Add text' },
      { keys: ['B'], description: 'Add box' },
      { keys: ['scroll'], description: 'Pan' },
      { keys: ['pinch'], description: 'Zoom' },
      { keys: ['⌥ + scroll'], description: 'Rotate' },
      { keys: ['O'], description: 'Reset rotation to origin' },
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
                    background: s.highlight ? 'var(--accent-bg)' : 'var(--kbd-bg)',
                    border: s.highlight ? '1px solid var(--accent-highlight-border)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: s.highlight ? 'var(--accent-light)' : 'var(--text-kbd)',
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
            <span style={{ fontSize: 11, color: s.highlight ? 'var(--text-secondary)' : 'var(--text-tertiary)', textAlign: 'right' }}>
              {s.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
