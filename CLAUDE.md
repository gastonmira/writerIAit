# WriteAI — Claude Code Instructions

## Project
Chrome extension (Plasmo + TypeScript + React) for grammar correction for non-native English speakers.

## Architecture
- `src/core/corrector.ts` — pure correction logic, NO chrome.* imports (v3 portability)
- `src/background/index.ts` — service worker, handles LLM API calls
- `src/contents/overlay.ts` — content script, injects shadow DOM overlay
- `src/popup/index.tsx` — extension popup (360px settings panel)

## LLM Providers
Supported: `"openai"` | `"anthropic"` | `"gemini"` | `"groq"`
- OpenAI: gpt-4o-mini (paid)
- Anthropic: claude-haiku-4-5-20251001 (paid)
- Gemini: gemini-2.0-flash-lite (free — aistudio.google.com)
- Groq: llama-3.1-8b-instant (free — console.groq.com)

Provider + nativeLanguage saved to `chrome.storage.sync`. API key saved to `chrome.storage.local` (never sync keys across devices).

## LLM Contract
Response: `{original: string, replacement: string, reason: string}[]`
No span offsets. Extension locates `original` using `indexOf`. System prompt requires phrase-level originals (multi-word) for unique matching.

## Element Safety
Text field is locked (`readOnly = true` / `contentEditable = "false"`) during LLM call.
Always restore in `try/finally`. This is the highest-risk bug — never break this pattern.

## Testing
- Unit: Vitest
- E2E: Playwright with `--load-extension` flag

## Git Workflow
Before making ANY code changes, create a feature branch and ask the user to confirm the name (or propose one). Never work directly on `main`. Example: `git checkout -b fix/gmail-undo`. Open a PR via `/ship` only when the user explicitly invokes it.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

Key rules:
- Inter for all UI text; JetBrains Mono for diff spans ONLY
- Overlay floats ADJACENT to textarea (below, `rect.bottom + 8px`), never inside body
- Teaching Mode reason text always visible — it's the core product differentiator
- Shadow DOM requires CSS media query for dark mode (not JS)
- Diff spans: both color AND typographic decoration (strikethrough del, underline ins)
