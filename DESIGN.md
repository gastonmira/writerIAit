# Design System — writerIAit

## Product Context
- **What this is:** A Chrome extension that corrects English grammar for non-native speakers and explains *why* each correction was made, teaching as it goes.
- **Who it's for:** v1 — Spanish/Portuguese-speaking professionals (PMs, engineers, analysts) writing work emails, Slack messages, and GitHub comments. Developer audience with own API key.
- **Space/industry:** Writing tools / productivity / language learning
- **Project type:** Browser extension (two surfaces: correction overlay + settings popup)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal — typography does all the work. No gradients, icons, or decorative elements.
- **Mood:** Calm, functional, non-intrusive. The correction diff is the star — the chrome around it disappears. Built for professionals who don't want to be distracted from their writing. When it activates it feels like a code review, not a grammar checker.

## Typography
- **UI / Labels / Body:** Inter — excellent readability at 11–14px, widely available, neutral without being generic. Used for all popup text, button labels, overlay headers, and Teaching Mode reason text.
- **Diff spans (del/ins) only:** JetBrains Mono — creates a distinct visual register: monospace = "computer correction", Inter = "human explanation". The typographic contrast signals "this is a machine suggestion" vs "this is an explanation" for any user, regardless of technical background. This is the key design risk that gives WriteAI its identity.
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap`
- **Scale:**
  ```
  10px  — section labels (uppercase, tracked)
  11px  — Teaching Mode reason text (italic, muted), hints, stat labels
  12px  — popup secondary text, error messages
  13px  — UI labels, buttons, inputs, correction diff spans
  14px  — body text, textarea content
  ```

## Color
- **Approach:** Restrained — one accent + neutrals + semantic diff colors only.

### Light Mode
```css
--bg:           #ffffff   /* primary background: overlay panel, popup body */
--surface:      #f8fafc   /* secondary background: section fills, card backgrounds */
--border:       #e2e8f0
--text-primary: #0f172a
--text-secondary: #475569
--muted:        #94a3b8   /* reason text, labels, placeholders */
--accent:       #2563eb   /* primary buttons, focus rings, badges */
--accent-hover: #1d4ed8
--error:        #dc2626
--success:      #16a34a
--del-bg:       #fee2e2
--del-text:     #991b1b
--ins-bg:       #dcfce7
--ins-text:     #166534
--radius-sm:    4px        /* buttons, inputs, badges */
--radius-md:    8px        /* cards, panels */
--radius-lg:    12px       /* overlay panel (shadow DOM only) */
```

### Dark Mode (CSS media query inside shadow DOM)
```css
@media (prefers-color-scheme: dark) {
  --bg:           #1e293b   /* Slate 900 */
  --surface:      #0f172a   /* Slate 950 */
  --border:       #334155
  --text-primary: #f1f5f9
  --text-secondary: #94a3b8
  --muted:        #64748b
  --accent:       #3b82f6
  --accent-hover: #60a5fa
  --success:      #4ade80
  --error:        #f87171
  --del-bg:       #450a0a
  --del-text:     #fca5a5
  --ins-bg:       #052e16
  --ins-text:     #86efac
}
```

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — tight enough to show multiple corrections without scrolling, spacious enough for the reason text to breathe.
- **Scale:** `4 8 12 16 20 24 32 48 64`

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 4px | icon gaps, micro padding |
| `--space-2` | 8px | inline gaps |
| `--space-3` | 12px | correction row vertical padding |
| `--space-4` | 16px | section padding, popup section padding |
| `--space-6` | 24px | between major blocks |

## Layout
- **Approach:** Grid-disciplined
- **Correction overlay:** Floats adjacent to the textarea (below, `rect.bottom + 8px`). Width: `min(480px, 100vw - 32px)`. CSS triangle attachment cue at top-left. Never inside the email/document body.
- **Popup panel:** Fixed 360px width. Three sections stacked vertically: Preferences → This Week (stats) → Utility.
- **Max content width:** 480px (overlay), 360px (popup)
- **Border radius:**
  ```
  4px  — inputs, buttons, diff badges
  8px  — overlay panel, popup panel, stat cards
  50%  — status dot, spinner
  ```

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension.
- **Overlay entrance:** `opacity: 0 → 1`, duration `150ms`, easing `ease-out`
- **Loading spinner:** CSS rotating border — `border-top-color: var(--accent)`, `animation: spin 0.8s linear infinite`. No JS, shadow DOM safe.
- **Button hover:** `background` color transition `150ms`
- **No decorative animation.** No bouncing, no slide-in panels, no scroll-driven effects.

## Component Specs

### Correction Row (Teaching Mode — always visible)
Two-line display per correction:
```
Line 1: [del span in JetBrains Mono]  →  [ins span in JetBrains Mono]
Line 2: reason text — Inter 11px italic, color: var(--muted)
```
- `del` span: strikethrough + red bg/text (colorblind-safe: strikethrough, not color alone)
- `ins` span: underline + green bg/text (colorblind-safe: underline, not color alone)

### Overlay States
| State | What user sees |
|-------|---------------|
| Loading | Spinner + "Checking English…" + Cancel button |
| Corrections found | List of correction rows + "Accept All" + "Dismiss" |
| Looks good | "✓ Looks good!" + "No corrections needed for this text." |
| Error — no API key | "API key not set. Open settings →" |
| Error — network | "No internet connection." |

### Shadow
```css
box-shadow: 0 4px 16px rgba(0,0,0,0.12);  /* light */
box-shadow: 0 4px 16px rgba(0,0,0,0.4);   /* dark */
```

### Popup Layout (3 sections)
1. **Status** — logo + "Active/Inactive" indicator with colored dot
2. **Preferences** — native language selector, Teaching Mode toggle (tone detection is automatic, not user-facing in v1)
3. **This week** — 2-column stat grid (corrections accepted + top fix category)
4. **Utility** — shortcut badge, API key configure link

## Accessibility
- All diff spans use both color AND typographic decoration (strikethrough for del, underline for ins) — colorblind-safe
- Minimum touch target: 44×44px for all interactive elements
- Focus rings: `outline: 2px solid var(--accent); outline-offset: 2px`
- ARIA roles on overlay: `role="dialog"`, `aria-label="WriteAI corrections"`
- Keyboard: `Escape` closes overlay; `Tab` navigates buttons; `Enter` accepts

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Inter + JetBrains Mono typography split | Mono = machine suggestion, Inter = human explanation — works for all users, not just developers |
| 2026-03-24 | Teaching Mode always visible (not toggleable) | The reason text IS the product differentiator; hiding it removes the core value |
| 2026-03-24 | Overlay adjacent to textarea, not inside it | Prevents visual conflict with email body content; works across all hostnames |
| 2026-03-24 | Blue accent (#2563eb) | Trust signal for productivity/professional tools; matches Chrome UI conventions |
| 2026-03-24 | Dark mode via CSS media query in shadow DOM | Zero JS, works automatically, respects OS preference |
| 2026-03-24 | "Looks good!" not "No corrections found" | Warm, positive framing; the product celebrates clean writing, not absence of errors |
| 2026-03-24 | CSS rotating border spinner (no JS) | Shadow DOM safe; no dependencies; identical to Chrome's own loading patterns |
| 2026-03-24 | Colorblind-safe diff decoration | Strikethrough + underline, not color alone — passes WCAG 1.4.1 |
| 2026-03-24 | Initial design system created | Created by /design-consultation based on prior /plan-design-review session tokens |
