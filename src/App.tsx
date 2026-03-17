import { useEffect } from 'react'
import { DiagramCanvas } from './components/DiagramCanvas'
import { Toolbar } from './components/Toolbar'
import { IconSearch } from './components/IconSearch'
import { ShortcutsHint } from './components/ShortcutsHint'
import { ColorPicker } from './components/ColorPicker'
import { DiagramTabs } from './components/DiagramTabs'
import { RenameInput } from './components/RenameInput'
import { useAppStore, selectResolvedTheme } from './store/useAppStore'

export default function App() {
  const resolvedTheme = useAppStore(selectResolvedTheme)
  const setSystemTheme = useAppStore((s) => s.setSystemTheme)

  // Keep systemTheme in sync with OS preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setSystemTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <DiagramCanvas />
      <Toolbar />
      <IconSearch />
      <ShortcutsHint />
      <ColorPicker />
      <RenameInput />
      <DiagramTabs />
    </div>
  )
}
