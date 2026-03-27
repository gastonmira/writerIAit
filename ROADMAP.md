# WriteIAit — Roadmap

## Shipped

- ✅ **Fix React #130 error** — renamed `overlay.tsx` → `overlay.ts` so Plasmo stops trying to mount it as a React component
- ✅ **Keyboard shortcuts in overlay** — `←`/`→` navigate carousel, `Enter` accept, `A` accept all, `Esc` dismiss
- ✅ **Undo toast** — brief "Undo" button appears after accepting corrections, auto-dismisses after 4s
- ✅ **Auto-detect active element** — `Cmd+Shift+K` works even when focus drifted away from the textarea
- ✅ **Carousel UI** — corrections shown one at a time (`‹ N of M ›`) instead of a scrollable list
- ✅ **Bottom-right positioning** — overlay anchors to the bottom-right of the textarea instead of covering the text
- ✅ **Version in popup** — `v0.1.0` shown next to Active status in the popup header
- ✅ **Onboarding wizard** — 3-step first-run flow (choose provider → API key → done), guides users to free providers first

## High Impact / Quick Wins

- **E2E tests for onboarding** — Playwright spec that loads the extension, clears `hasOnboarded` from storage, walks through all 3 wizard steps, verifies the normal view renders after completion, and checks the skip path. Add to `e2e/onboarding.spec.ts`.

## Product Depth

- **Check modes** — let the user choose the type of check before triggering the shortcut (or via a quick picker in the overlay):
  - ✏️ **Correct** *(default, Grammarly-style)* — fix grammar and spelling, keep the original meaning intact
  - ✨ **Improve** — keep the meaning but make it more natural, better phrasing, improved fluency
  - 🎯 **Rewrite with intent** — transform tone on demand: "more professional", "more friendly", "more concise". Each intent maps to a different system prompt instruction.
- **Error highlighting** — underline errors directly in the text field while the overlay is open, so the user sees exactly where they are
- **Learning patterns** — the stats panel already tracks corrections; surface insights like "you often miss apostrophes in contractions" in the popup

## Reliability / Polish

- **More apps** — Notion, Linear, Twitter/X (contenteditable already works, but tone detection doesn't know about them)

## Bigger Swings

- **Inline diff mode** — instead of a floating overlay, show red/green diffs inline in the text field itself
- **On-device model** — use WebLLM or a local Ollama instance so text never leaves the machine
