# Changelog

All notable changes to WriteAI are documented here.

## [0.2.0.0] - 2026-03-28 — Spelling + Scroll + Design Polish

### Fixed
- **Spelling detection** — correction prompt now explicitly lists spelling errors; small models (Groq/llama) no longer return "looks good" on "helo thanks agan"
- **Overlay scroll positioning** — overlay no longer floats near top of page when user has scrolled down; `window.scrollY`/`window.scrollX` offset applied correctly for both `getOrCreateHost` and `showUndoToast`
- **Undo toast scroll position** — same scroll offset fix applied to undo toast placement

### Design
- **ARIA accessibility** — overlay host now has `role="dialog"` and `aria-label="WriteAI corrections"` (screen reader support)
- **Color tokens** — added `--error` (#dc2626 / #f87171 dark) and `--success` (#16a34a / #4ade80 dark) to shadow DOM CSS
- **Font weight** — JetBrains Mono loads `wght@400;500` per design spec (was 400-only)

### Infrastructure
- **Cross-site E2E agent** — 6 Playwright tests covering GitHub PR, Gmail compose, contact form, Twitter/X, LinkedIn, Notion (all mocked, load-extension, dark + light themes)

---

## [0.1.0.0] - 2026-03-28 — Alpha Release

### Added
- **Grammar correction** — keyboard shortcut (`Cmd+Shift+K` / `Ctrl+Shift+K`) triggers correction from any text field
- **Teaching Mode** — every correction shows the reason, so users learn the rule (not just get the fix)
- **Inline diff mode** — shows original vs corrected text with per-correction accept/reject controls
- **Explained (carousel) mode** — card-by-card walkthrough of each correction with full reasoning
- **Improve mode** — suggests more natural, idiomatic phrasing for grammatically correct but awkward text
- **Rewrite mode** — rewrites text to a target tone: professional, friendly, or concise
- **Native language support** — Spanish, Portuguese, French, German, Arabic, Chinese transfer error detection
- **Tone detection** — adapts to Gmail (professional), Slack (casual business), GitHub (technical)
- **Undo toast** — one-click undo after accepting corrections
- **Four LLM backends** — OpenAI (gpt-4o-mini), Anthropic (claude-haiku-4-5-20251001), Gemini (gemini-2.0-flash-lite, free), Groq (llama-3.1-8b-instant, free)
- **Gmail compose support** — works in contenteditable fields without breaking scroll or DOM structure
- **Privacy-first** — text goes only to the user's chosen API provider; no intermediate servers
- **Shadow DOM overlay** — style-isolated UI that works on Gmail, Slack, GitHub, and most text fields
- **Dark mode** — CSS `@media (prefers-color-scheme: dark)` support inside shadow DOM

### Fixed
- Gmail contenteditable: paragraph breaks preserved in inline diff mode
- Gmail contenteditable: scroll no longer breaks after accepting corrections (Range API replacement)
- Gmail contenteditable: focus restored to compose after overlay dismissal
- Extension context invalidated: clear user-facing message instead of generic error
- Mirror overlay: visual gaps between paragraphs removed via scoped font/padding reset

### Infrastructure
- Vitest unit test suite (85 tests)
- Playwright E2E test suite
- Design system (DESIGN.md) with Inter/JetBrains Mono typography, token-based spacing and color
- Built with [gstack](https://github.com/garrytan/gstack) AI builder framework
