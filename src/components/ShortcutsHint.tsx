import { useAppStore, selectResolvedTheme } from '../store/useAppStore'

interface Shortcut {
  keys: string[]
  description: string
  highlight?: boolean
}

export function ShortcutsHint() {
  const { toolMode, selectedIds, selectedConnectionId, connectingFromId, isIconSearchOpen, textInputPos } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)
  const isDark = theme === 'dark'

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
      { keys: ['I', '/'], description: 'Add icon' },
      { keys: ['T'], description: 'Add text' },
      { keys: ['B'], description: 'Add box' },
      { keys: ['scroll'], description: 'Pan' },
      { keys: ['pinch'], description: 'Zoom' },
      { keys: ['⌥ + scroll'], description: 'Rotate' },
      { keys: ['O'], description: 'Reset rotation to origin' },
    ]
  }

  const bg = isDark ? 'rgba(15,15,25,0.82)' : 'rgba(255,255,255,0.88)'
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const labelCol = isDark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.4)'
  const textCol = isDark ? 'rgba(226,232,240,0.6)' : 'rgba(15,23,42,0.65)'
  const kbdBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const kbdCol = isDark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.75)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 54,
        right: 20,
        zIndex: 40,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '10px 12px',
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)',
        minWidth: 180,
      }}
    >
      {/* Mode label */}
      <div style={{ fontSize: 10, color: labelCol, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
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
                    background: s.highlight ? 'rgba(99,102,241,0.18)' : kbdBg,
                    border: s.highlight ? '1px solid rgba(99,102,241,0.35)' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 4,
                    color: s.highlight ? '#a5b4fc' : kbdCol,
                    fontSize: 11,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    padding: '1px 6px',
                    display: 'inline-block',
                    lineHeight: '18px',
                  }}
                >
                  {k}
                </kbd>
              ))}
            </div>
            <span style={{ fontSize: 11, color: s.highlight ? (isDark ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.8)') : textCol, textAlign: 'right' }}>
              {s.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
