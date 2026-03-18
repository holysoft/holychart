import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { fuzzyMatchIcons } from '../icons/fuzzyMatch'
import { loadIcon, getIconImage } from '../icons/iconifyClient'
import { placeIcon } from './DiagramCanvas'

interface PreviewIconProps {
  iconName: string
  label: string
  onSelect: () => void
  isRandom?: boolean
}

function PreviewIcon({ iconName, label, onSelect, isRandom }: PreviewIconProps) {
  const theme = useAppStore(selectResolvedTheme)
  const [loaded, setLoaded] = useState(() => !!getIconImage(iconName, theme))

  useEffect(() => {
    if (!loaded) {
      loadIcon(iconName, theme, () => setLoaded(true))
    }
  }, [iconName, loaded, theme])

  // Display name: strip 'mdi:' prefix
  const displayName = label || iconName.replace(/^mdi:/, '').replace(/-/g, ' ')

  return (
    <button
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 8px',
        background: 'var(--hover-bg-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'all 0.15s',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-bg-subtle)'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg-subtle)'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
      }}
    >
      {isRandom && (
        <div
          title="Random suggestion"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--text-muted)">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </div>
      )}
      {loaded ? (
        <img
          src={`https://api.iconify.design/${iconName.replace(':', '/')}.svg?height=40&color=${encodeURIComponent(getComputedStyle(document.documentElement).getPropertyValue('--text').trim())}`}
          width={40}
          height={40}
          alt={displayName}
          style={{ display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            background: 'var(--accent-bg-subtle)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          maxWidth: 64,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </span>
    </button>
  )
}

export function IconSearch() {
  const { isIconSearchOpen, iconSearchQuery, closeIconSearch, setIconSearchQuery, swappingIconId } = useAppStore()
  const theme = useAppStore(selectResolvedTheme)
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<Array<{ iconName: string; label: string; isRandom?: boolean }>>([])

  useEffect(() => {
    if (isIconSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      runSearch(iconSearchQuery)
    }
  }, [isIconSearchOpen])

  const runSearch = useCallback(
    (q: string) => {
      const fuzzy = fuzzyMatchIcons(q, 15)
      setResults(fuzzy.map((r) => ({ iconName: r.iconName, label: r.keyword, isRandom: r.isRandom })))
    },
    []
  )

  useEffect(() => {
    runSearch(iconSearchQuery)
  }, [iconSearchQuery, runSearch])

  if (!isIconSearchOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeIconSearch}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          backdropFilter: 'var(--backdrop-blur)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-icon)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeIconSearch()
                if (e.key === 'Enter' && results.length > 0) {
                  placeIcon(results[0].iconName, results[0].label)
                }
              }}
              placeholder={swappingIconId ? 'Search new icon to swap…' : 'Search icons (e.g. server, database, cloud)...'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 16,
                fontFamily: 'var(--font-ui)',
              }}
            />
            <button
              onClick={closeIconSearch}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ padding: 12, minHeight: 80, maxHeight: 320, overflowY: 'auto' }}>
          {results.some((r) => r.isRandom) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}>
                <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              {!iconSearchQuery.trim() ? 'Random suggestions — type to search' : results.filter((r) => !r.isRandom).length > 0 ? 'Showing best matches + random suggestions' : 'No matches — showing random suggestions'}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}
          >
            {results.map((r, i) => (
              <PreviewIcon
                key={`${r.iconName}-${i}`}
                iconName={r.iconName}
                label={r.label}
                onSelect={() => placeIcon(r.iconName, r.label)}
                isRandom={r.isRandom}
              />
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span><kbd style={{ background: 'var(--kbd-bg)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>Enter</kbd> place first</span>
          <span><kbd style={{ background: 'var(--kbd-bg)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>Esc</kbd> close</span>
          <span>Click icon to place</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  )
}
