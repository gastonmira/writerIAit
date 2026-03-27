// overlay.tsx — content script, shadow DOM overlay
// All styles via <style> tag — NO inline style="" (Gmail CSP blocks them)

import type { PlasmoCSConfig } from "plasmo"
import { applyCorrections, buildDiffHtml } from "../core/corrector"
import type { CheckTextMessage, CheckTextResponse, Correction, CheckMode, CorrectionView, RewriteIntent } from "../types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

// ─── CSS ──────────────────────────────────────────────────────────────────
// All tokens from DESIGN.md. Shadow DOM needs its own media query for dark mode.

const SHADOW_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

  :host {
    --bg: #ffffff;
    --surface: #f8fafc;
    --border: #e2e8f0;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --muted: #94a3b8;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --del-bg: #fee2e2;
    --del-text: #991b1b;
    --ins-bg: #dcfce7;
    --ins-text: #166534;
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --shadow: 0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-primary);
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #1e293b;
      --surface: #0f172a;
      --border: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --del-bg: #450a0a;
      --del-text: #fca5a5;
      --ins-bg: #052e16;
      --ins-text: #86efac;
      --shadow: 0 4px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .overlay {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 12px 16px;
    animation: fadeIn 150ms ease-out;
    max-height: 400px;
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .logo {
    width: 20px;
    height: 20px;
    background: var(--accent);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-letter {
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .correction-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    margin-bottom: 12px;
    animation: fadeIn 120ms ease-out;
  }

  .nav-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 14px;
    min-height: unset;
    width: 24px;
    height: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 120ms ease;
  }

  .nav-btn:hover { background: var(--surface); }
  .nav-btn:disabled { opacity: 0.3; cursor: default; }

  .counter {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    text-align: center;
  }

  .diff-line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
  }

  .del-span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    background: var(--del-bg);
    color: var(--del-text);
    text-decoration: line-through;
    border-radius: var(--radius-sm);
    padding: 2px 4px;
  }

  .arrow {
    color: var(--muted);
    font-size: 12px;
  }

  .ins-span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    background: var(--ins-bg);
    color: var(--ins-text);
    text-decoration: underline;
    border-radius: var(--radius-sm);
    padding: 2px 4px;
  }

  .reason-text {
    font-size: 11px;
    font-style: italic;
    color: var(--muted);
    margin-top: 4px;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  button {
    min-height: 32px;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 120ms ease;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .btn-primary {
    background: var(--accent);
    color: #ffffff;
    min-height: 36px;
    padding: 0 16px;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  .btn-ghost:hover {
    background: var(--surface);
  }

  .btn-close {
    background: transparent;
    color: var(--muted);
    border: none;
    padding: 0;
    min-height: unset;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .btn-close:hover {
    background: var(--surface);
    color: var(--text-primary);
  }

  .empty-state {
    text-align: center;
    padding: 8px 0 12px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .empty-icon {
    font-size: 20px;
    margin-bottom: 4px;
  }

  .error-text {
    color: var(--del-text);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .shortcut-hint {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow);
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    animation: fadeIn 150ms ease-out;
  }

  .toast-label { flex: 1; }

  .mode-badge {
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .action-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow);
    padding: 8px 12px;
    animation: fadeIn 150ms ease-out;
  }

  .action-bar-label {
    flex: 1;
    font-size: 13px;
    color: var(--text-secondary);
  }
`

// ─── Element lock ──────────────────────────────────────────────────────────
// HIGHEST-RISK INVARIANT: always unlock in every exit path

let lockedElement: HTMLElement | null = null
let originalReadOnly: boolean | null = null
let originalContentEditable: string | null = null

function lockElement(el: HTMLElement): void {
  lockedElement = el
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    originalReadOnly = el.readOnly
    el.readOnly = true
  } else {
    originalContentEditable = el.contentEditable
    el.contentEditable = "false"
  }
}

function unlockElement(): void {
  if (!lockedElement) return
  const el = lockedElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.readOnly = originalReadOnly ?? false
  } else {
    el.contentEditable = originalContentEditable ?? "true"
  }
  lockedElement = null
  originalReadOnly = null
  originalContentEditable = null
}

// ─── Text helpers ──────────────────────────────────────────────────────────

function isTextElement(el: Element | null): el is HTMLElement {
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type.toLowerCase()
    return ["text", "email", "search", "url", "tel", ""].includes(type)
  }
  if (tag === "TEXTAREA") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function getTextContent(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value
  }
  return el.innerText
}

function modeBadgeLabel(mode: CheckMode, rewriteIntent: RewriteIntent): string {
  if (mode === "correct") return "✏️ Correct"
  if (mode === "improve") return "✨ Improve"
  const intentLabel = { professional: "Professional", friendly: "Friendly", concise: "Concise" }[rewriteIntent]
  return `✍️ ${intentLabel}`
}

function setTextContent(el: HTMLElement, correctedText: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.select()
    document.execCommand("insertText", false, correctedText)
    // Fallback if execCommand doesn't work
    if (el.value !== correctedText) {
      el.value = correctedText
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
  } else {
    // contenteditable (e.g. Gmail)
    el.focus()
    document.execCommand("selectAll", false)
    document.execCommand("insertText", false, correctedText)
  }
}

// ─── Inline diff helpers ───────────────────────────────────────────────────
// buildDiffHtml is imported from core/corrector (pure, testable)

function injectDiffStyles(): void {
  if (document.getElementById("writeai-diff-styles")) return
  const styleEl = document.createElement("style")
  styleEl.id = "writeai-diff-styles"
  styleEl.textContent = `
    .writeai-del, .writeai-ins {
      font-family: 'JetBrains Mono', monospace;
      font-size: inherit;
      border-radius: 4px;
      padding: 1px 3px;
      pointer-events: auto;
      cursor: pointer;
      transition: opacity 120ms ease;
    }
    .writeai-del {
      background: #fee2e2;
      color: #991b1b;
      text-decoration: line-through;
    }
    .writeai-ins {
      background: #dcfce7;
      color: #166534;
      text-decoration: underline;
    }
    .writeai-del:hover { opacity: 0.7; }
    .writeai-ins:hover { opacity: 0.75; filter: brightness(0.92); }
    @media (prefers-color-scheme: dark) {
      .writeai-del { background: #450a0a; color: #fca5a5; }
      .writeai-ins { background: #052e16; color: #86efac; }
    }
  `
  document.head.appendChild(styleEl)
}

function removeDiffStyles(): void {
  document.getElementById("writeai-diff-styles")?.remove()
}

function createTextareaMirror(
  el: HTMLTextAreaElement | HTMLInputElement,
  corrections: Correction[]
): void {
  const rect = el.getBoundingClientRect()
  const cs = window.getComputedStyle(el)

  // Inject positioning via <style> tag — no inline style="" (Gmail CSP)
  const mirrorStyle = document.createElement("style")
  mirrorStyle.id = "writeai-mirror-style"
  mirrorStyle.textContent = `
    #writeai-mirror-el {
      position: fixed !important;
      top: ${rect.top}px !important;
      left: ${rect.left}px !important;
      width: ${rect.width}px !important;
      height: ${rect.height}px !important;
      pointer-events: none !important;
      overflow: hidden !important;
      z-index: 2147483646 !important;
      box-sizing: ${cs.boxSizing} !important;
      white-space: pre-wrap !important;
      word-break: ${cs.wordBreak} !important;
      overflow-wrap: ${cs.overflowWrap} !important;
      background: transparent !important;
      font-family: ${cs.fontFamily} !important;
      font-size: ${cs.fontSize} !important;
      line-height: ${cs.lineHeight} !important;
      padding-top: ${cs.paddingTop} !important;
      padding-right: ${cs.paddingRight} !important;
      padding-bottom: ${cs.paddingBottom} !important;
      padding-left: ${cs.paddingLeft} !important;
      border-top-width: ${cs.borderTopWidth} !important;
      border-right-width: ${cs.borderRightWidth} !important;
      border-bottom-width: ${cs.borderBottomWidth} !important;
      border-left-width: ${cs.borderLeftWidth} !important;
      border-style: solid !important;
      border-color: transparent !important;
      letter-spacing: ${cs.letterSpacing} !important;
      word-spacing: ${cs.wordSpacing} !important;
    }
  `
  document.head.appendChild(mirrorStyle)

  injectDiffStyles()

  const div = document.createElement("div")
  div.id = "writeai-mirror-el"
  div.setAttribute("aria-hidden", "true")
  div.innerHTML = buildDiffHtml(el.value, corrections)
  document.body.appendChild(div)
  mirrorEl = div

  // Hide textarea text — element is locked, user cannot type during diff display
  // Modifying el.style directly (existing page element) is not blocked by CSP
  savedElColor = el.style.color
  savedElCaretColor = el.style.caretColor
  el.style.color = "transparent"
  el.style.caretColor = "transparent"
}

function injectContentEditableDiff(el: HTMLElement, corrections: Correction[]): void {
  contentEditableSnapshot = el.innerHTML
  injectDiffStyles()
  el.innerHTML = buildDiffHtml(el.innerText, corrections)
}

function removeInlineDiff(el: HTMLElement): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    if (inlineDiffClickHandler) {
      mirrorEl?.removeEventListener("click", inlineDiffClickHandler)
    }
    mirrorEl?.remove()
    mirrorEl = null
    document.getElementById("writeai-mirror-style")?.remove()
    el.style.color = savedElColor ?? ""
    el.style.caretColor = savedElCaretColor ?? ""
    savedElColor = null
    savedElCaretColor = null
  } else {
    if (inlineDiffClickHandler) {
      el.removeEventListener("click", inlineDiffClickHandler)
    }
    if (contentEditableSnapshot !== null) {
      el.innerHTML = contentEditableSnapshot
      contentEditableSnapshot = null
    }
  }
  inlineDiffClickHandler = null
  removeDiffStyles()
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler)
    resizeHandler = null
  }
  inlineDiffEl = null
}

// ─── Overlay host ──────────────────────────────────────────────────────────

let overlayHost: HTMLElement | null = null
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null
let toastHost: HTMLElement | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let lastFocusedEl: HTMLElement | null = null

// ─── Inline diff state ─────────────────────────────────────────────────────
let mirrorEl: HTMLElement | null = null
let contentEditableSnapshot: string | null = null
let resizeHandler: (() => void) | null = null
let savedElColor: string | null = null
let savedElCaretColor: string | null = null
let inlineDiffEl: HTMLElement | null = null
let inlineDiffClickHandler: ((e: Event) => void) | null = null

function getOrCreateHost(anchorEl: HTMLElement, iframeRect: DOMRect | null = null): ShadowRoot {
  removeOverlay()

  // For tall editables (e.g. Gmail), use cursor bottom for vertical placement
  // but element left for horizontal alignment.
  const anchorDoc = anchorEl.ownerDocument ?? document
  const sel = anchorDoc.getSelection()
  const elRect = anchorEl.getBoundingClientRect()
  let anchorBottom = elRect.bottom
  if (sel && sel.rangeCount > 0) {
    const selRect = sel.getRangeAt(0).getBoundingClientRect()
    if (selRect.height > 0) anchorBottom = selRect.bottom
  }

  const host = document.createElement("div")
  host.id = "writeai-overlay-host"

  // Position via className, not style="" — Gmail CSP blocks inline styles
  // We position via a stylesheet injected at the document level
  // When the element is inside an iframe, add the iframe's offset.
  const styleEl = document.createElement("style")
  const iframeTop = iframeRect ? iframeRect.top + window.scrollY : 0
  const iframeLeft = iframeRect ? iframeRect.left + window.scrollX : 0
  const top = Math.round(anchorBottom + iframeTop + 8)
  const width = Math.min(480, window.innerWidth - 32)
  // Right-align to the textarea's right edge so the overlay doesn't cover text
  const rawLeft = Math.round(elRect.right + iframeLeft) - width
  const left = Math.max(16, Math.min(rawLeft, window.innerWidth + window.scrollX - width - 16))
  styleEl.textContent = `
    #writeai-overlay-host {
      position: absolute !important;
      top: ${top}px !important;
      left: ${left}px !important;
      width: ${width}px !important;
      z-index: 2147483647 !important;
    }
  `
  document.head.appendChild(styleEl)
  host.dataset.styleEl = "writeai-style"

  document.body.appendChild(host)
  overlayHost = host

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = SHADOW_CSS
  shadow.appendChild(style)

  return shadow
}

function removeOverlay(): void {
  if (overlayHost) {
    // Also remove the position style element
    const styleEls = document.head.querySelectorAll("style")
    styleEls.forEach(el => {
      if (el.textContent?.includes("writeai-overlay-host")) el.remove()
    })
    overlayHost.remove()
    overlayHost = null
  }
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler)
    keyboardHandler = null
  }
}

function removeToast(): void {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
  if (toastHost) {
    document.head.querySelectorAll("style").forEach(s => {
      if (s.textContent?.includes("writeai-toast-host")) s.remove()
    })
    toastHost.remove()
    toastHost = null
  }
}

function showUndoToast(
  el: HTMLElement,
  previousText: string,
  anchorEl: HTMLElement,
  iframeRect: DOMRect | null
): void {
  removeToast()

  const elRect = anchorEl.getBoundingClientRect()
  const iframeTop = iframeRect ? iframeRect.top + window.scrollY : 0
  const iframeLeft = iframeRect ? iframeRect.left + window.scrollX : 0
  const top = Math.round(elRect.bottom + iframeTop + 8)
  const width = Math.min(480, window.innerWidth - 32)
  const rawLeft = Math.round(elRect.right + iframeLeft) - width
  const left = Math.max(16, Math.min(rawLeft, window.innerWidth + window.scrollX - width - 16))

  const styleEl = document.createElement("style")
  styleEl.textContent = `
    #writeai-toast-host {
      position: absolute !important;
      top: ${top}px !important;
      left: ${left}px !important;
      width: ${width}px !important;
      z-index: 2147483647 !important;
    }
  `
  document.head.appendChild(styleEl)

  const host = document.createElement("div")
  host.id = "writeai-toast-host"
  document.body.appendChild(host)
  toastHost = host

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = SHADOW_CSS
  shadow.appendChild(style)

  const toast = document.createElement("div")
  toast.className = "toast"

  const label = document.createElement("span")
  label.className = "toast-label"
  label.textContent = "✓ Correction applied"

  const undoBtn = document.createElement("button")
  undoBtn.className = "btn-ghost"
  undoBtn.textContent = "Undo"
  undoBtn.addEventListener("click", () => {
    setTextContent(el, previousText)
    removeToast()
  })

  toast.appendChild(label)
  toast.appendChild(undoBtn)
  shadow.appendChild(toast)

  toastTimer = setTimeout(removeToast, 4000)
}

// ─── Render functions ──────────────────────────────────────────────────────

function renderLoading(root: ShadowRoot, onCancel: () => void, mode: CheckMode, rewriteIntent: RewriteIntent): void {
  const overlay = document.createElement("div")
  overlay.className = "overlay"

  const header = document.createElement("div")
  header.className = "header"
  header.innerHTML = `
    <div class="logo"><span class="logo-letter">W</span></div>
    <span class="title">Checking your English…</span>
    <div class="spinner"></div>
  `

  const badge = document.createElement("span")
  badge.className = "mode-badge"
  badge.textContent = modeBadgeLabel(mode, rewriteIntent)
  header.appendChild(badge)

  const closeBtn = document.createElement("button")
  closeBtn.className = "btn-close"
  closeBtn.title = "Cancel"
  closeBtn.textContent = "×"
  closeBtn.addEventListener("click", onCancel)
  header.appendChild(closeBtn)

  overlay.appendChild(header)
  root.appendChild(overlay)
}

function attachKeyboardShortcuts(
  onPrev: () => void,
  onNext: () => void,
  onAccept: () => void,
  onAcceptAll: () => void,
  onDismiss: () => void
): void {
  keyboardHandler = (e: KeyboardEvent) => {
    if (!overlayHost) return
    const key = e.key

    if (key === "Escape") {
      e.preventDefault()
      onDismiss()
      return
    }

    if (key === "ArrowLeft")  { e.preventDefault(); onPrev(); return }
    if (key === "ArrowRight") { e.preventDefault(); onNext(); return }
    if (key === "Enter")      { e.preventDefault(); onAccept(); return }

    // Only fire A shortcut when focus is outside a text field
    const active = document.activeElement
    const isTyping =
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.getAttribute("contenteditable") === "true" ||
        active.getAttribute("contenteditable") === "")
    if (isTyping) return

    if (key === "a" || key === "A") {
      e.preventDefault()
      onAcceptAll()
    }
  }
  document.addEventListener("keydown", keyboardHandler)
}

function renderCorrections(
  root: ShadowRoot,
  corrections: Correction[],
  onAcceptOne: (c: Correction) => void,
  onAcceptAll: () => void,
  onDismiss: () => void,
  mode: CheckMode,
  rewriteIntent: RewriteIntent
): void {
  const pending = [...corrections]
  let idx = 0

  const overlay = document.createElement("div")
  overlay.className = "overlay"

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement("div")
  header.className = "header"
  header.innerHTML = `<div class="logo"><span class="logo-letter">W</span></div>`

  const titleEl = document.createElement("span")
  titleEl.className = "title"
  titleEl.textContent = "Correction"
  header.appendChild(titleEl)

  const badge = document.createElement("span")
  badge.className = "mode-badge"
  badge.textContent = modeBadgeLabel(mode, rewriteIntent)
  header.appendChild(badge)

  const prevBtn = document.createElement("button")
  prevBtn.className = "nav-btn"
  prevBtn.title = "Previous (←)"
  prevBtn.textContent = "‹"
  header.appendChild(prevBtn)

  const counterEl = document.createElement("span")
  counterEl.className = "counter"
  header.appendChild(counterEl)

  const nextBtn = document.createElement("button")
  nextBtn.className = "nav-btn"
  nextBtn.title = "Next (→)"
  nextBtn.textContent = "›"
  header.appendChild(nextBtn)

  const hint = document.createElement("div")
  hint.className = "shortcut-hint"
  hint.textContent = "← → navigate · Enter accept · A all · Esc dismiss"
  header.appendChild(hint)

  const closeBtn = document.createElement("button")
  closeBtn.className = "btn-close"
  closeBtn.title = "Dismiss"
  closeBtn.textContent = "×"
  closeBtn.addEventListener("click", onDismiss)
  header.appendChild(closeBtn)

  // ── Card ──────────────────────────────────────────────────────────────────
  const card = document.createElement("div")
  card.className = "correction-card"

  const diffLine = document.createElement("div")
  diffLine.className = "diff-line"

  const delEl = document.createElement("span")
  delEl.className = "del-span"

  const arrowEl = document.createElement("span")
  arrowEl.className = "arrow"
  arrowEl.textContent = "→"

  const insEl = document.createElement("span")
  insEl.className = "ins-span"

  diffLine.appendChild(delEl)
  diffLine.appendChild(arrowEl)
  diffLine.appendChild(insEl)

  const reasonEl = document.createElement("div")
  reasonEl.className = "reason-text"

  card.appendChild(diffLine)
  card.appendChild(reasonEl)

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = document.createElement("div")
  actions.className = "actions"

  const dismissBtn = document.createElement("button")
  dismissBtn.className = "btn-ghost"
  dismissBtn.textContent = "Dismiss"
  dismissBtn.addEventListener("click", onDismiss)

  const acceptAllBtn = document.createElement("button")
  acceptAllBtn.className = "btn-ghost"
  acceptAllBtn.textContent = "Accept All"
  acceptAllBtn.addEventListener("click", onAcceptAll)

  // ── Named action functions (used by both buttons and keyboard handler) ─────
  function goPrev() { if (idx > 0) { idx--; updateView() } }
  function goNext() { if (idx < pending.length - 1) { idx++; updateView() } }
  function doAccept() {
    const c = pending[idx]
    onAcceptOne(c)
    pending.splice(idx, 1)
    if (pending.length === 0) { onDismiss(); return }
    idx = Math.min(idx, pending.length - 1)
    updateView()
  }

  function updateView() {
    const c = pending[idx]
    delEl.textContent = c.original
    insEl.textContent = c.replacement
    reasonEl.textContent = c.reason
    counterEl.textContent = `${idx + 1} of ${pending.length}`
    prevBtn.disabled = idx === 0
    nextBtn.disabled = idx === pending.length - 1
  }

  const acceptBtn = document.createElement("button")
  acceptBtn.className = "btn-primary"
  acceptBtn.textContent = "Accept"
  acceptBtn.addEventListener("click", doAccept)

  actions.appendChild(dismissBtn)
  actions.appendChild(acceptAllBtn)
  actions.appendChild(acceptBtn)

  prevBtn.addEventListener("click", goPrev)
  nextBtn.addEventListener("click", goNext)

  // ── Assemble ──────────────────────────────────────────────────────────────
  overlay.appendChild(header)
  overlay.appendChild(card)
  overlay.appendChild(actions)
  root.appendChild(overlay)

  updateView()
  attachKeyboardShortcuts(goPrev, goNext, doAccept, onAcceptAll, onDismiss)
  acceptBtn.focus()
}

function renderLooksGood(root: ShadowRoot, onDismiss: () => void): void {
  const overlay = document.createElement("div")
  overlay.className = "overlay"

  const header = document.createElement("div")
  header.className = "header"
  header.innerHTML = `
    <div class="logo"><span class="logo-letter">W</span></div>
    <span class="title">WriteAI</span>
  `
  const closeBtn = document.createElement("button")
  closeBtn.className = "btn-close"
  closeBtn.title = "Dismiss"
  closeBtn.textContent = "×"
  closeBtn.addEventListener("click", onDismiss)
  header.appendChild(closeBtn)

  const empty = document.createElement("div")
  empty.className = "empty-state"
  empty.innerHTML = `
    <div class="empty-icon">✓</div>
    <div><strong>Looks good!</strong></div>
    <div>No corrections needed.</div>
  `

  const actions = document.createElement("div")
  actions.className = "actions"
  const dismissBtn = document.createElement("button")
  dismissBtn.className = "btn-ghost"
  dismissBtn.textContent = "Dismiss"
  dismissBtn.addEventListener("click", onDismiss)
  actions.appendChild(dismissBtn)

  overlay.appendChild(header)
  overlay.appendChild(empty)
  overlay.appendChild(actions)
  root.appendChild(overlay)
}

function renderError(root: ShadowRoot, message: string, onDismiss: () => void): void {
  const overlay = document.createElement("div")
  overlay.className = "overlay"

  const header = document.createElement("div")
  header.className = "header"
  header.innerHTML = `
    <div class="logo"><span class="logo-letter">W</span></div>
    <span class="title">WriteAI</span>
  `
  const closeBtn = document.createElement("button")
  closeBtn.className = "btn-close"
  closeBtn.title = "Dismiss"
  closeBtn.textContent = "×"
  closeBtn.addEventListener("click", onDismiss)
  header.appendChild(closeBtn)

  const errorMsg = document.createElement("div")
  errorMsg.className = "error-text"
  errorMsg.textContent = message

  const actions = document.createElement("div")
  actions.className = "actions"
  const dismissBtn = document.createElement("button")
  dismissBtn.className = "btn-ghost"
  dismissBtn.textContent = "Dismiss"
  dismissBtn.addEventListener("click", onDismiss)
  actions.appendChild(dismissBtn)

  overlay.appendChild(header)
  overlay.appendChild(errorMsg)
  overlay.appendChild(actions)
  root.appendChild(overlay)
}

// ─── Inline diff rendering ─────────────────────────────────────────────────

function renderInlineActionBar(
  el: HTMLElement,
  nCorrections: number,
  iframeRect: DOMRect | null,
  onAcceptAll: () => void,
  onDismiss: () => void
): HTMLElement {
  const root = getOrCreateHost(el, iframeRect)

  const bar = document.createElement("div")
  bar.className = "action-bar"

  const logo = document.createElement("div")
  logo.className = "logo"
  logo.innerHTML = `<span class="logo-letter">W</span>`

  const label = document.createElement("span")
  label.className = "action-bar-label"
  label.textContent = `${nCorrections} correction${nCorrections === 1 ? "" : "s"} found`

  const dismissBtn = document.createElement("button")
  dismissBtn.className = "btn-ghost"
  dismissBtn.textContent = "Dismiss"
  dismissBtn.addEventListener("click", onDismiss)

  const acceptAllBtn = document.createElement("button")
  acceptAllBtn.className = "btn-primary"
  acceptAllBtn.textContent = "Accept All"
  acceptAllBtn.addEventListener("click", onAcceptAll)

  bar.appendChild(logo)
  bar.appendChild(label)
  bar.appendChild(dismissBtn)
  bar.appendChild(acceptAllBtn)
  root.appendChild(bar)

  // Keyboard shortcuts: Enter/A = accept all, Esc = dismiss
  attachKeyboardShortcuts(() => {}, () => {}, onAcceptAll, onAcceptAll, onDismiss)
  acceptAllBtn.focus()

  // Return label element so caller can update the count dynamically
  return label
}

function renderInlineDiff(
  el: HTMLElement,
  allCorrections: Correction[],
  baseText: string,
  iframeRect: DOMRect | null,
  onFinalAccept: (finalText: string) => void,
  onDismiss: () => void
): void {
  // Re-lock element for the duration of diff display
  // (it was unlocked after the LLM call returned)
  lockElement(el)
  inlineDiffEl = el

  // ── Internal state ─────────────────────────────────────────────────────────
  const remaining = [...allCorrections]
  const accepted: Correction[] = []
  let labelEl: HTMLElement | null = null

  function getCurrentText(): string {
    return accepted.length > 0 ? applyCorrections(baseText, accepted) : baseText
  }

  function updateLabel() {
    if (!labelEl) return
    const n = remaining.length
    labelEl.textContent = n === 0
      ? "All corrections applied!"
      : `${n} correction${n === 1 ? "" : "s"} remaining`
  }

  function rebuildDisplay() {
    const currentText = getCurrentText()
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      if (mirrorEl) mirrorEl.innerHTML = buildDiffHtml(currentText, remaining)
    } else {
      // Rebuild contenteditable inline spans
      el.innerHTML = buildDiffHtml(currentText, remaining)
    }
    updateLabel()
  }

  // ── Click handler for individual corrections ────────────────────────────────
  // Click <ins> → accept; click <del> → reject/skip
  inlineDiffClickHandler = (e: Event) => {
    const target = e.target as HTMLElement
    const idxStr = (target as HTMLElement).dataset?.idx
    if (idxStr === undefined) return
    const idx = parseInt(idxStr)
    const correction = remaining[idx]
    if (!correction) return

    e.preventDefault()
    e.stopPropagation()

    if (target.classList.contains("writeai-ins")) {
      accepted.push(correction)
      remaining.splice(idx, 1)
    } else if (target.classList.contains("writeai-del")) {
      remaining.splice(idx, 1)
    } else {
      return
    }

    rebuildDisplay()

    if (remaining.length === 0) {
      // All resolved — brief pause so user sees the final state, then finish
      setTimeout(() => onFinalAccept(getCurrentText()), 400)
    }
  }

  // ── Mount diff display ──────────────────────────────────────────────────────
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    createTextareaMirror(el, remaining)
    mirrorEl?.addEventListener("click", inlineDiffClickHandler)
  } else {
    injectContentEditableDiff(el, remaining)
    el.addEventListener("click", inlineDiffClickHandler)
  }

  // getOrCreateHost (inside renderInlineActionBar) calls removeOverlay(),
  // which removes the loading/checking overlay — this is intentional
  labelEl = renderInlineActionBar(
    el,
    remaining.length,
    iframeRect,
    () => onFinalAccept(applyCorrections(baseText, [...accepted, ...remaining])),
    onDismiss
  )

  resizeHandler = () => onDismiss()
  window.addEventListener("resize", resizeHandler, { passive: true })
}

// ─── Correction stats ──────────────────────────────────────────────────────

async function recordStats(corrections: Correction[]): Promise<void> {
  try {
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const stored = await chrome.storage.local.get(["correctionsThisWeek", "weekStart", "reasons"])
    let count: number = stored.correctionsThisWeek ?? 0
    let weekStart: number = stored.weekStart ?? now
    const reasons: string[] = stored.reasons ?? []

    if (now - weekStart > weekMs) {
      count = 0
      weekStart = now
    }

    count += corrections.length
    for (const c of corrections) reasons.push(c.reason)

    await chrome.storage.local.set({ correctionsThisWeek: count, weekStart, reasons })
  } catch {
    // Non-critical — ignore storage errors
  }
}

// ─── Iframe pierce ─────────────────────────────────────────────────────────
// Gmail compose box lives inside a same-origin iframe. document.activeElement
// in the top frame is the <iframe> element, not the contenteditable inside it.

function getActiveTextElement(): { el: HTMLElement; iframeRect: DOMRect | null } | null {
  let active = document.activeElement
  let iframeRect: DOMRect | null = null

  if (active instanceof HTMLIFrameElement) {
    try {
      iframeRect = active.getBoundingClientRect()
      active = active.contentDocument?.activeElement ?? null
    } catch {
      return null // cross-origin iframe
    }
  }

  if (isTextElement(active)) return { el: active as HTMLElement, iframeRect }

  // Fallback: use the last text field the user focused (handles focus drift)
  if (lastFocusedEl && document.contains(lastFocusedEl)) {
    return { el: lastFocusedEl, iframeRect: null }
  }

  return null
}

// ─── Main trigger handler ──────────────────────────────────────────────────

async function handleTrigger(): Promise<void> {
  const result = getActiveTextElement()
  if (!result) return
  const { el, iframeRect } = result

  const text = getTextContent(el)
  if (!text.trim()) {
    // Show error briefly — no lock needed
    const tempHost = document.createElement("div")
    tempHost.id = "writeai-overlay-host"
    const styleEl = document.createElement("style")
    const rect = el.getBoundingClientRect()
    const iframeTop = iframeRect ? iframeRect.top + window.scrollY : 0
    const iframeLeft = iframeRect ? iframeRect.left + window.scrollX : 0
    const top = Math.round(rect.bottom + iframeTop + 8)
    const left = Math.round(rect.left + iframeLeft)
    styleEl.textContent = `#writeai-overlay-host { position: absolute !important; top: ${top}px !important; left: ${left}px !important; width: 320px !important; z-index: 2147483647 !important; }`
    document.head.appendChild(styleEl)
    document.body.appendChild(tempHost)
    overlayHost = tempHost
    const shadow = tempHost.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = SHADOW_CSS
    shadow.appendChild(style)
    renderError(shadow, "No text found in this field.", () => removeOverlay())
    return
  }

  lockElement(el)
  const root = getOrCreateHost(el, iframeRect)

  try {
    const [syncSettings, localSettings] = await Promise.all([
      chrome.storage.sync.get(["nativeLanguage", "provider", "checkMode", "rewriteIntent", "correctionView"]),
      chrome.storage.local.get(["apiKey"])
    ])
    const settings = { ...syncSettings, ...localSettings }
    const apiKey: string = settings.apiKey ?? ""

    const checkMode = (syncSettings.checkMode ?? "correct") as CheckMode
    const rewriteIntent = (syncSettings.rewriteIntent ?? "professional") as RewriteIntent
    const correctionView = (syncSettings.correctionView ?? "inline") as CorrectionView

  // Show loading — cancel sends CANCEL_CHECK to background
  renderLoading(root, () => {
    unlockElement()
    removeOverlay()
    chrome.runtime.sendMessage({ type: "CANCEL_CHECK" }).catch(() => {})
  }, checkMode, rewriteIntent)

    if (!apiKey) {
      unlockElement()
      removeOverlay()
      const root2 = getOrCreateHost(el, iframeRect)
      renderError(root2, "Set your API key in the extension popup.", () => {
        unlockElement()
        removeOverlay()
      })
      return
    }

    const nativeLanguage: string = settings.nativeLanguage ?? "Other"
    const provider = (settings.provider ?? "openai") as "openai" | "anthropic"
    const tone = detectCurrentTone()

    const msg: CheckTextMessage = {
      type: "CHECK_TEXT",
      text,
      nativeLanguage,
      tone,
      apiKey,
      provider,
      mode: checkMode,
      rewriteIntent: rewriteIntent,
    }

    const response = await chrome.runtime.sendMessage(msg) as CheckTextResponse

    if ("error" in response) {
      unlockElement()
      removeOverlay()
      if (response.error === "cancelled") return

      const root2 = getOrCreateHost(el, iframeRect)
      renderError(root2, response.error, () => {
        unlockElement()
        removeOverlay()
      })
      return
    }

    const { corrections } = response
    unlockElement()
    removeOverlay()

    if (corrections.length === 0) {
      const root2 = getOrCreateHost(el, iframeRect)
      renderLooksGood(root2, () => removeOverlay())
      return
    }

    if (correctionView === "inline") {
      renderInlineDiff(
        el,
        corrections,
        text,
        iframeRect,
        (finalText) => {
          unlockElement()
          if (inlineDiffEl) removeInlineDiff(inlineDiffEl)
          removeOverlay()
          setTextContent(el, finalText)
          recordStats(corrections)
          showUndoToast(el, text, el, iframeRect)
        },
        () => {
          unlockElement()
          if (inlineDiffEl) removeInlineDiff(inlineDiffEl)
          removeOverlay()
        }
      )
    } else {
      // "explained" — original carousel with per-correction reasons
      const root2 = getOrCreateHost(el, iframeRect)
      let undoSnapshot: string | null = null

      const onDismissWithToast = () => {
        removeOverlay()
        if (undoSnapshot !== null) {
          const snap = undoSnapshot
          undoSnapshot = null
          setTimeout(() => showUndoToast(el, snap, el, iframeRect), 0)
        }
      }

      renderCorrections(
        root2,
        corrections,
        (c) => {
          undoSnapshot = getTextContent(el)
          const correctedText = applyCorrections(undoSnapshot, [c])
          setTextContent(el, correctedText)
          recordStats([c])
        },
        () => {
          undoSnapshot = null
          removeOverlay()
          const correctedText = applyCorrections(text, corrections)
          setTextContent(el, correctedText)
          recordStats(corrections)
          showUndoToast(el, text, el, iframeRect)
        },
        onDismissWithToast,
        checkMode,
        rewriteIntent
      )
    }
  } catch {
    unlockElement()
    if (inlineDiffEl) removeInlineDiff(inlineDiffEl)
    removeOverlay()
    const root2 = getOrCreateHost(el, iframeRect)
    renderError(root2, "Something went wrong. Please try again.", () => {
      removeOverlay()
    })
  }
}

// ─── Tone from hostname ────────────────────────────────────────────────────

function detectCurrentTone(): string {
  const { hostname } = window.location
  const toneMap: Record<string, string> = {
    "mail.google.com": "professional email",
    "app.slack.com": "casual business",
    "github.com": "technical English"
  }
  return toneMap[hostname] ?? "clear and readable"
}

// ─── Focus tracking (for focus-drift fallback) ─────────────────────────────

document.addEventListener("focusin", (e) => {
  if (isTextElement(e.target as Element)) {
    lastFocusedEl = e.target as HTMLElement
  }
}, true)

// ─── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TRIGGER_FIX") {
    handleTrigger().catch(err => {
      unlockElement()
      if (inlineDiffEl) removeInlineDiff(inlineDiffEl)
      removeOverlay()
      console.error("[WriteAI] handleTrigger error:", err)
    })
  }
})

// ─── Cleanup on unload ────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unlockElement()
  if (inlineDiffEl) removeInlineDiff(inlineDiffEl)
  removeOverlay()
  removeToast()
})
