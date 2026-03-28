# WriteIAit

A Chrome extension that corrects English grammar for non-native speakers — and explains *why* each correction was made.

Designed for Spanish/Portuguese-speaking professionals writing emails, Slack messages, and GitHub comments. Feels like a code review, not a spell checker.

---

## Features

- **Keyboard shortcut** (`Cmd+Shift+K` / `Ctrl+Shift+K`) — trigger from any text field
- **Diff overlay** — shows original vs corrected text side-by-side with strikethrough/underline
- **Teaching Mode** — every correction includes a reason so you learn the rule
- **Native language support** — Spanish, Portuguese, French, German, Arabic, Chinese transfer errors detected
- **Tone detection** — adapts to Gmail (professional), Slack (casual business), GitHub (technical)
- **Undo toast** — one-click undo after accepting corrections
- **Four LLM backends** — OpenAI, Anthropic, Gemini (free), Groq (free)
- **Privacy-first** — text is sent only to your chosen API provider; no servers in between

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | [Plasmo](https://docs.plasmo.com/) (Chrome MV3) |
| Language | TypeScript + React |
| UI | Shadow DOM (no style leakage), Inter + JetBrains Mono |
| Tests | Vitest (unit) + Playwright (E2E) |
| Package manager | pnpm |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A free API key from [Google AI Studio](https://aistudio.google.com) (Gemini) or [Groq](https://console.groq.com), or a paid key from OpenAI / Anthropic

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `build/chrome-mv3-dev`

### Production build

```bash
pnpm build
```

Output is in `build/chrome-mv3-prod/`.

---

## Configuration

Open the extension popup and:

1. Select your **LLM provider** (Gemini and Groq are free)
2. Paste your **API key**
3. Choose your **native language**

API keys are stored in `chrome.storage.local` — never synced across devices.

---

## LLM Providers

| Provider | Model | Cost |
|---|---|---|
| Gemini | gemini-2.0-flash-lite | Free — [aistudio.google.com](https://aistudio.google.com) |
| Groq | llama-3.1-8b-instant | Free — [console.groq.com](https://console.groq.com) |
| OpenAI | gpt-4o-mini | Paid |
| Anthropic | claude-haiku-4-5-20251001 | Paid |

---

## Project Structure

```
src/
  core/corrector.ts       # Pure correction logic — no chrome.* imports
  background/index.ts     # Service worker: LLM API calls, command relay
  contents/overlay.ts     # Content script: shadow DOM overlay
  popup/index.tsx         # Settings panel (360px)
  types.ts                # Shared types
e2e/
  correction-flow.spec.ts # Playwright E2E tests
_locales/
  en/messages.json        # English strings
  es/messages.json        # Spanish strings
  pt/messages.json        # Portuguese strings
```

---

## Testing

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests (requires pnpm build first)
pnpm build
pnpm test:e2e
```

---

## Architecture Notes

- **No span offsets** — corrections use `indexOf` on the original text; the LLM is prompted to return phrase-level originals (2–5 words) for unique matching
- **Element safety** — the target text field is locked (`readOnly = true`) during the LLM call and always restored in `try/finally`
- **Shadow DOM** — the overlay is injected into a shadow root to prevent style conflicts with host pages (Gmail, Slack, GitHub)
- **Dark mode** — handled via CSS `@media (prefers-color-scheme: dark)` inside the shadow DOM, not JS

---

## Built with AI

This project uses [gstack](https://github.com/garrytan/gstack) — an open-source AI builder framework — to accelerate development, reviews, and shipping.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md).

---

## License

MIT
