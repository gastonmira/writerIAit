# TODOS

## Reliability


### P1 — E2E test coverage gaps
Playwright suite covers correction flow basics but is missing:
- `e2e/onboarding.spec.ts` — full onboarding wizard flow
- Keyboard nav tests: `←`/`→`, `Enter`, `A`, `Esc`
- Undo toast tests
- `<input>` element tests
- `e2e/popup.spec.ts` — settings persistence tests

## Content Script / Overlay

### P2 — More app support
Notion, Linear, Twitter/X already work with contenteditable, but tone detection doesn't know about them. Add to `TONE_MAP` in `corrector.ts`.

## Cost & Performance

### P2 — Response cache
Hash `(provider + mode + text)` → check `chrome.storage.local` before API call. 7-day TTL, 500-entry cap. Could suppress 30–50% of calls for power users.

### P2 — Usage tracking + budget cap
Read token counts from API responses, show estimated weekly cost in popup stats, add monthly cap.

### P3 — Compact system prompts
Token-minimized prompt variant for paid providers — ~35% fewer input tokens, zero behavior change.

## Completed

- ✅ Gmail undo restores DOM correctly (innerHTML snapshot via `showUndoToast htmlSnapshot`)
- ✅ "All good" false positive after carousel accept (real-time `input` tracking + cache clearing in all dismiss paths)
- ✅ Fix React #130 error (renamed overlay.tsx → overlay.ts)
- ✅ Keyboard shortcuts in overlay (←/→, Enter, A, Esc)
- ✅ Undo toast
- ✅ Auto-detect active element
- ✅ Carousel UI
- ✅ Bottom-right positioning
- ✅ Version in popup
- ✅ Onboarding wizard
- ✅ Inline diff mode with per-correction selection
- ✅ Check modes (correct, improve, rewrite)
- ✅ Gmail contenteditable support (scroll, paragraph breaks, mirror gaps, focus)
- ✅ Extension context invalidated — clear user-facing message
- ✅ Spelling detection — prompt explicitly lists spelling errors (fixes Groq/small model gap)
- ✅ Overlay scroll positioning — `window.scrollY/X` offset for non-iframe elements
- ✅ ARIA accessibility — `role="dialog"` + `aria-label` on overlay host
- ✅ Color tokens — `--error` / `--success` in shadow DOM CSS
- ✅ Font weight — JetBrains Mono `wght@400;500`
- ✅ Cross-site E2E agent — 6 tests (GitHub, Gmail, contact form, Twitter/X, LinkedIn, Notion)
- ✅ Active/inactive icon switching — blue default, grey while LLM call runs
- ✅ Re-trigger cache — replays previous corrections on same text instead of second LLM call
- ✅ Rename extension to `writerIAit` throughout
