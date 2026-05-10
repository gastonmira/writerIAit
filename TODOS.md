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

### P1 — Refactor `overlay.ts` (1,786 lines — needs splitting)
The file has grown into a monolith. Everything lives in one file: CSS (~300 lines),
DOM rendering for 6 UI states (loading, carousel, inline diff, looks good, error, undo toast),
contenteditable replacement logic, iframe piercing, focus tracking, tone detection, and the
main trigger handler. Specific concerns:

> **2026-05-10 — Forcing function.** The `passive_local_highlighter` feature
> (#8, feat/passive-local-highlighter) was the first new feature where this
> debt forced an architectural call. We shipped the passive checker as a
> **separate content-script entry** (`src/contents/passive-highlighter.ts`)
> instead of folding it into `overlay.ts`, because the monolith was already
> too risky to extend with a 300-line live-DOM feature. The split worked out
> (free lazy-loading via dynamic import, two isolated content scripts that
> coordinate via a single DOM attribute), but it's a pattern, not a plan:
> the next feature that needs to live next to the trigger flow (e.g.
> error-highlighting-in-place) will have the same problem and won't have
> the same escape hatch. **Bumped from "P1 someday" to "P1 next refactor
> window."**


- **CSS blob** (~300 lines, `SHADOW_CSS` string at top) — extract to `overlay.css` or a
  dedicated `src/contents/overlay-styles.ts` module
- **Rendering functions** — `renderLoading`, `renderCorrections`, `renderLooksGood`,
  `renderError`, `renderInlineDiff`, `renderInlineActionBar`, `showUndoToast` are
  independent UI components; move to `src/contents/components/`
- **DOM utilities** — `setTextContent`, `replaceTextInContentEditable`,
  `createTextareaMirror`, `lockElement`/`unlockElement`, `getTextContent`,
  `isTextElement` belong in a dedicated `src/contents/dom-utils.ts`
- **State** — 12+ module-level mutable variables (`overlayHost`, `lastCheckCache`,
  `mirrorEl`, `inlineDiffEl`, etc.) with no encapsulation; a single state object or
  reducer would make the flow easier to follow and test
- **`handleTrigger`** (~100 lines) — the core orchestration function mixes cache logic,
  settings reads, LLM dispatch, and view routing; these are separate concerns

Suggested split:
```
src/contents/
  overlay.ts          # entry point: config, message listener, handleTrigger
  overlay-styles.ts   # SHADOW_CSS constant
  dom-utils.ts        # lock/unlock, getTextContent, replaceTextInContentEditable, etc.
  components/
    loading.ts
    carousel.ts
    inline-diff.ts
    undo-toast.ts
    looks-good.ts
    error.ts
```

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
