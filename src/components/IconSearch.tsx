import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore, selectResolvedTheme } from '../store/useAppStore'
import { fuzzyMatchIcons } from '../icons/fuzzyMatch'
import { aiIconMatch } from '../icons/aiIconMatch'
import { loadIcon, getIconImage } from '../icons/iconifyClient'
import { placeIcon } from './DiagramCanvas'

interface PreviewIconProps {
  iconName: string
  label: string
  onSelect: () => void
}

function PreviewIcon({ iconName, label, onSelect }: PreviewIconProps) {
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 8px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        cursor: 'pointer',
        color: '#e2e8f0',
        transition: 'all 0.15s',
        minWidth: 72,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.2)'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      {loaded ? (
        <img
          src={`https://api.iconify.design/${iconName.replace(':', '/')}.svg?height=40&color=%23e2e8f0`}
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
            background: 'rgba(99,102,241,0.2)',
            borderRadius: 6,
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}
      <span
        style={{
          fontSize: 10,
          color: 'rgba(226,232,240,0.7)',
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
  const isDark = theme === 'dark'
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<Array<{ iconName: string; label: string }>>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ iconName: string; label: string } | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isIconSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setResults([])
      setAiResult(null)
    }
  }, [isIconSearchOpen])

  const runSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([])
        setAiResult(null)
        return
      }

      const fuzzy = fuzzyMatchIcons(q, 12)
      setResults(fuzzy.map((r) => ({ iconName: r.iconName, label: r.keyword })))

      // Debounce AI fallback
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
      if (fuzzy.length === 0 || fuzzy[0].score < 50) {
        aiTimerRef.current = setTimeout(async () => {
          setIsAiLoading(true)
          const iconName = await aiIconMatch(q)
          setIsAiLoading(false)
          if (iconName) {
            setAiResult({ iconName, label: q })
            // Also preload the icon
            loadIcon(iconName)
          }
        }, 600)
      }
    },
    []
  )

  useEffect(() => {
    runSearch(iconSearchQuery)
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [iconSearchQuery, runSearch])

  if (!isIconSearchOpen) return null

  const allResults = aiResult
    ? [aiResult, ...results.filter((r) => r.iconName !== aiResult.iconName)]
    : results

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
          background: isDark ? 'rgba(15,15,25,0.97)' : 'rgba(255,255,255,0.98)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.4)'} strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeIconSearch()
                if (e.key === 'Enter' && allResults.length > 0) {
                  placeIcon(allResults[0].iconName, allResults[0].label)
                }
              }}
              placeholder={swappingIconId ? 'Search new icon to swap…' : 'Search icons (e.g. server, database, cloud)...'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: isDark ? '#e2e8f0' : '#1e293b',
                fontSize: 16,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            />
            {isAiLoading && (
              <span style={{ fontSize: 11, color: '#6366f1', whiteSpace: 'nowrap' }}>
                AI matching...
              </span>
            )}
            <button
              onClick={closeIconSearch}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(226,232,240,0.4)',
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
          {allResults.length === 0 && !isAiLoading && iconSearchQuery.trim() && (
            <p style={{ color: isDark ? 'rgba(226,232,240,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No icons found. Try a different word.
            </p>
          )}
          {allResults.length === 0 && !iconSearchQuery.trim() && (
            <p style={{ color: isDark ? 'rgba(226,232,240,0.4)' : 'rgba(15,23,42,0.4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Type to search icons from the Material Design Icons library
            </p>
          )}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {allResults.map((r, i) => (
              <PreviewIcon
                key={`${r.iconName}-${i}`}
                iconName={r.iconName}
                label={r.label}
                onSelect={() => placeIcon(r.iconName, r.label)}
              />
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'rgba(226,232,240,0.35)',
          }}
        >
          <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>Enter</kbd> place first</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>Esc</kbd> close</span>
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
