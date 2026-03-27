# WriteAI — Roadmap

## Shipped

- ✅ **Fix React #130 error** — renamed `overlay.tsx` → `overlay.ts` so Plasmo stops trying to mount it as a React component
- ✅ **Keyboard shortcuts in overlay** — `←`/`→` navigate carousel, `Enter` accept, `A` accept all, `Esc` dismiss
- ✅ **Undo toast** — brief "Undo" button appears after accepting corrections, auto-dismisses after 4s
- ✅ **Auto-detect active element** — `Cmd+Shift+K` works even when focus drifted away from the textarea
- ✅ **Carousel UI** — corrections shown one at a time (`‹ N of M ›`) instead of a scrollable list
- ✅ **Bottom-right positioning** — overlay anchors to the bottom-right of the textarea instead of covering the text
- ✅ **Version in popup** — `v0.1.0` shown next to Active status in the popup header

## High Impact / Quick Wins

- **Auto-detect active element** — trigger on `Cmd+Shift+K` even when focus is slightly off (e.g. user clicked away)
- **Onboarding** — first-run popup that walks through API key setup instead of showing an error overlay cold

## Product Depth

- **Error highlighting** — underline errors directly in the text field while the overlay is open, so the user sees exactly where they are
- **Learning patterns** — the stats panel already tracks corrections; surface insights like "you often miss apostrophes in contractions" in the popup
- **Custom tone override** — let the user manually set tone per-session instead of relying on hostname detection

## Reliability / Polish

- **More apps** — Notion, Linear, Twitter/X (contenteditable already works, but tone detection doesn't know about them)

## Bigger Swings

- **Inline diff mode** — instead of a floating overlay, show red/green diffs inline in the text field itself
- **On-device model** — use WebLLM or a local Ollama instance so text never leaves the machine
