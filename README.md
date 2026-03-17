# diagramr

A trackpad-first infinite canvas diagramming tool with AI-powered icon search.

![diagramr](https://img.shields.io/badge/built_with-React_+_TypeScript-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Why

Most diagramming tools treat trackpads as second-class mice. diagramr is built around trackpad gestures — including **canvas rotation** via two-finger twist, which virtually no other tool supports.

## What it does

- **Infinite canvas** — pan, pinch-to-zoom, and twist-to-rotate with trackpad gestures
- **AI icon search** — type any word, fuzzy-matches 150+ curated icons instantly; falls back to Claude Haiku for obscure concepts
- **Boxes, text, icons** — three element types with colors, labels, and resize handles
- **Connections** — draw arrows between elements with solid, dashed, or animated styles
- **Multi-select** — rubber-band selection, move groups together
- **Diagram tabs** — multiple diagrams per session, auto-saved to localStorage
- **Export / Import** — save diagrams as JSON, share and reload them
- **Dark / light / system theme**

## Install

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY for AI icon matching (optional)
npm run dev
```

Requires Node 18+. The app works fully without an API key — AI icon matching is a progressive enhancement.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `I` / `/` | Add icon |
| `T` | Add text |
| `B` | Add box |
| `R` | Rename selected |
| `E` | Draw edge from selected |
| `C` | Change color |
| `S` | Swap icon / cycle arrow style |
| `D` | Reverse arrow direction |
| `O` | Reset canvas rotation |
| `⌘C / ⌘V / ⌘D` | Copy / paste / duplicate |
| `⌫` | Delete selected |
| `⌥ + scroll` | Rotate canvas |
| `⌘⇧N` | New diagram tab |

## AI icon matching

The optional server (`server/index.ts`) proxies requests to Claude Haiku when fuzzy matching finds no confident result. Set `ANTHROPIC_API_KEY` in `.env` to enable it. Without a key the server still runs and returns `null`, falling back to fuzzy search only.

## License

MIT
