# writerIAit

A Chrome extension that corrects English grammar for non-native speakers — and explains *why* each correction was made.

Designed for non-native English-speaking professionals writing emails, Slack messages, and GitHub comments. Feels like a code review, not a spell checker.

**Live landing:** [writeraiit.pages.dev](https://writeraiit.pages.dev/)

---

## Why I built it

Most grammar tools tell you what to change. writerIAit also tells you why.

I also built it for a very practical reason: I was not going to pay for the competing tool. So I thought, "fine, I'll build my own."

The goal is not to replace your writing voice or silently rewrite everything. The goal is to help non-native English speakers improve the text they are writing right now, learn the grammar rule behind each correction, and stay in control of every change.

writerIAit is free, open source, and bring-your-own-API-key. There is no backend, no subscription, and no telemetry.

---

## Features

- **Keyboard shortcut** (`Cmd+Shift+K` / `Ctrl+Shift+K`) — trigger from any text field
- **Three check modes** — Correct (fix grammar + spelling), Improve (more natural phrasing), Rewrite (professional / friendly / concise)
- **Inline diff mode** — per-correction accept/reject with strikethrough/underline spans; or use the carousel for one-at-a-time review
- **Teaching Mode** — every correction includes a reason so you learn the rule
- **Native language support** — Spanish, Portuguese, French, German, Arabic, Chinese transfer errors detected
- **Tone detection** — adapts to Gmail (professional), Slack (casual business), GitHub (technical)
- **Gmail + contenteditable support** — works in Gmail compose, Notion, LinkedIn, and other rich text editors
- **Smart re-trigger** — pressing the shortcut again on unchanged text replays the last result instantly, no extra API call
- **Undo toast** — one-click undo after accepting corrections
- **Four LLM backends** — OpenAI, Anthropic, Gemini (free), Groq (free)
- **Privacy-first** — text is sent only to your chosen API provider; no servers in between

---

## How it works

1. Focus a text field in Chrome.
2. Press `Cmd+Shift+K` / `Ctrl+Shift+K`.
3. writerIAit locks the field while checking the text, then shows a correction overlay.
4. Review the diff and the Teaching Mode explanation for each correction.
5. Accept, reject, or undo changes.

The extension runs only when you ask it to. It does not scan pages in the background.

---

## Privacy model

writerIAit does not run a server.

- Your API key is stored locally in `chrome.storage.local`.
- Provider preferences and native language are stored in `chrome.storage.sync`.
- Your text is sent directly from Chrome to the LLM provider you choose.
- writerIAit does not store prompts, corrections, telemetry, or analytics.

See the landing privacy page: [writeraiit.pages.dev/privacy](https://writeraiit.pages.dev/privacy).

---

## Project status

This is an early open-source project, not a Chrome Web Store product yet.

It is also my first open-source project, so please be patient with rough edges. If you spot a bug, confusing behavior, or something that could be improved, feel free to open an issue or send a pull request.

Current status:

- Manual install from source is supported.
- Gemini and Groq can be used with free API keys.
- The extension works across plain text fields and rich text editors such as Gmail, LinkedIn, Notion, and GitHub.
- Issues and pull requests are welcome.

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

## Install the extension

### For users (production build)

> No Chrome Web Store listing yet — load the extension manually.

**Step 1 — Get the code**

```bash
git clone https://github.com/gastonmira/writeriait.git
cd writeriait
```

**Step 2 — Install dependencies and build**

Requires [Node.js 20+](https://nodejs.org) and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
pnpm build
```

This creates the production folder at `build/chrome-mv3-prod/`.

**Step 3 — Load the extension in Chrome**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder `build/chrome-mv3-prod/` inside the cloned repo

The writerIAit icon appears in your toolbar.

**Step 4 — First-time setup**

1. Click the writerIAit icon in the toolbar
2. Select your **LLM provider** (Gemini and Groq are free)
3. Paste your **API key**
4. Choose your **native language**

You're ready — focus any text field and press `Cmd+Shift+K` / `Ctrl+Shift+K`.

> **Which folder to load?**
> | Folder | Use when |
> |---|---|
> | `build/chrome-mv3-prod/` | Daily use — optimized build |
> | `build/chrome-mv3-dev/` | Developing — hot reload via `pnpm dev` |

---

## Getting Started (development)

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
  background/index.ts     # Service worker: LLM API calls, command relay, icon switching
  contents/overlay.ts     # Content script: shadow DOM overlay
  popup/index.tsx         # Settings panel (360px)
  types.ts                # Shared types
e2e/
  correction-flow.spec.ts  # Playwright E2E tests (7 tests)
  cross-site-agent.spec.ts # Cross-site tests: GitHub, Gmail, Twitter/X, LinkedIn, Notion (6 tests)
assets/
  icon*.png               # Default (idle) toolbar icons — picked up by Plasmo manifest
public/
  icon*-active.png        # Active icons (blue, shown during API call) — copied to build root
  icon*.png               # Inactive icons (grey) — used for explicit reset via chrome.action.setIcon
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

# Cross-site E2E tests (GitHub, Gmail, Twitter/X, LinkedIn, Notion)
pnpm test:e2e:cross
```

---

## Architecture Notes

- **No span offsets** — corrections use `indexOf` on the original text; the LLM is prompted to return phrase-level originals (2–5 words) for unique matching
- **Element safety** — the target text field is locked (`readOnly = true`) during the LLM call and always restored in `try/finally`
- **Shadow DOM** — the overlay is injected into a shadow root to prevent style conflicts with host pages (Gmail, Slack, GitHub)
- **Dark mode** — handled via CSS `@media (prefers-color-scheme: dark)` inside the shadow DOM, not JS
- **Re-trigger cache** — a per-element in-memory cache replays the last correction result when the shortcut is pressed again on unchanged text, preventing a second LLM call that could return empty on free-tier models
- **Icon state** — toolbar icon switches to grey while the API call runs (`chrome.action.setIcon`), returns to blue when done; managed in `background/index.ts` around `handleCheckText`

---

## Built with AI

This project uses [gstack](https://github.com/garrytan/gstack) — an open-source AI builder framework — to accelerate development, reviews, and shipping.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md).

---

## License

MIT
