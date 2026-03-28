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
- ✅ **Check modes** — Correct (grammar + spelling), Improve (natural phrasing), Rewrite (professional / friendly / concise)
- ✅ **Inline diff mode** — red/green diffs shown in text field; click to accept/skip individually; toggle between Inline and Explained modes in popup settings
- ✅ **Gmail + contenteditable support** — scroll, paragraph breaks, mirror gaps, focus all fixed
- ✅ **Extension context invalidated** — clear user-facing message instead of crash; prompts "please reload the page"
- ✅ **Spelling detection** — correction prompt explicitly catches spelling errors; small models (Groq/llama) no longer miss "helo", "agan"
- ✅ **Overlay scroll positioning** — overlay anchors correctly when user has scrolled the page
- ✅ **Cross-site E2E agent** — 6 Playwright tests covering GitHub PR, Gmail compose, Twitter/X, LinkedIn, Notion (mocked API, dark + light themes)

## High Impact / Quick Wins

- **E2E test coverage** — expand Playwright suite to cover remaining untested flows. Existing: 7 correction-flow tests + 6 cross-site-agent tests. Still missing:

  **`e2e/onboarding.spec.ts`**
  - First run: wizard opens on Step 1 (no `hasOnboarded` in storage)
  - Pick provider → Step 2 shows correct key link
  - Empty key → validation error, no advance
  - Complete wizard → normal settings view renders
  - Skip → normal settings view immediately
  - Reopen popup after finish → normal view (wizard never shown again)

  **`e2e/correction-flow.spec.ts`** (additions to existing file)
  - Keyboard nav: `←`/`→` cycles through carousel corrections
  - `Enter` accepts current correction, advances or closes
  - `A` accepts all corrections at once
  - `Esc` dismisses overlay without changes
  - Undo toast appears after Accept All, clicking it restores original text
  - Works on `<input type="text">` (not just textarea)

  **`e2e/popup.spec.ts`**
  - Changing native language saves to sync storage
  - Changing provider saves to sync storage
  - Saving API key shows "Saved!" confirmation
  - Stats panel shows correct correction count after a correction is made

## Product Depth

- **Error highlighting** — underline errors directly in the text field while the overlay is open, so the user sees exactly where they are
- **Learning patterns** — the stats panel already tracks corrections; surface insights like "you often miss apostrophes in contractions" in the popup

## Reliability / Polish

- **More apps** — tone detection (`TONE_MAP` in `corrector.ts`) doesn't know about Notion, Linear, Twitter/X yet. Contenteditable already works — just needs hostname entries added.

## Cost Efficiency

- **Response cache** — before each API call, hash `(provider + mode + text)` and check `chrome.storage.local`; return stored corrections instantly on a hit, skipping the network call entirely. 7-day TTL, lazy eviction, capped at 500 entries. Targets the common "re-check same draft" pattern — could suppress 30–50% of calls for power users.
- **Usage tracking + budget cap** — read real token counts from API responses (`usage.*_tokens` on OpenAI/Anthropic/Groq), show estimated weekly cost in the popup stats panel (`~$0.014 this week`), and let users set a monthly cap that blocks calls with a clear message when reached (with a soft warning at 80%).
- **Compact system prompts** — token-minimized prompt variant for paid providers that removes inline examples and redundant closing warnings, which the model doesn't need at `temperature: 0`. ~35% fewer input tokens per call, zero behavior change.

## Bigger Swings

- **On-device model** — use WebLLM or a local Ollama instance so text never leaves the machine
