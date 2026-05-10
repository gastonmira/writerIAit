// Passive typo highlighter — runs in content script when passiveMode is ON.
// Per-field debounced spell-check. Renders a sibling decoration overlay
// adjacent to each enabled textarea / input[type=text]. Click a flagged
// token → top-3 suggestion popover. Accept → replace word, bump
// autoFixesCount (separate from `corrections`, so the Insights dashboard
// stays clean). Hides decorations while the deep-check overlay is active
// on a field (signaled via data-writeai-deep-active on the field).

import { getSpell } from "./dictionary-loader"
import { incrementAutoFix } from "../core/storage-schema"

const DEBOUNCE_MS = 300
const DEEP_ATTR = "data-writeai-deep-active"
const OVERLAY_CLASS = "writeai-passive-overlay"
const TYPO_CLASS = "writeai-passive-typo"
const POPOVER_ID = "writeai-passive-popover"
const STYLE_ID = "writeai-passive-styles"
const Z = 2147483600

type Field = HTMLTextAreaElement | HTMLInputElement

interface Misspelling {
  word: string
  start: number
  end: number
}

interface FieldState {
  field: Field
  overlay: HTMLDivElement
  debounceTimer: number | null
  observer: MutationObserver
  resizeObserver: ResizeObserver
  detachListeners: () => void
}

const states = new Map<Field, FieldState>()
let popoverEl: HTMLDivElement | null = null
let popoverForField: Field | null = null

// ─── public API ───────────────────────────────────────────────────────────

export function activate(): void {
  ensureGlobalStyles()
  document.addEventListener("focusin", onFocusIn, true)
  document.addEventListener("scroll", onAnyScroll, true)
  window.addEventListener("resize", onWindowResize)
  // Attach to anything already focused at activation time
  const active = document.activeElement
  if (isSupported(active)) attachField(active as Field)
}

export function deactivate(): void {
  document.removeEventListener("focusin", onFocusIn, true)
  document.removeEventListener("scroll", onAnyScroll, true)
  window.removeEventListener("resize", onWindowResize)
  for (const field of [...states.keys()]) detachField(field)
  closePopover()
  removeGlobalStyles()
}

// ─── event wiring ─────────────────────────────────────────────────────────

function onFocusIn(e: FocusEvent): void {
  const target = e.target as Element | null
  if (!isSupported(target)) return
  const field = target as Field
  if (states.has(field)) return
  attachField(field)
}

function onAnyScroll(): void {
  // Reposition all overlays on any scroll (page or container).
  for (const s of states.values()) positionOverlay(s)
  closePopover()
}

function onWindowResize(): void {
  for (const s of states.values()) {
    positionOverlay(s)
    renderDecorations(s)
  }
  closePopover()
}

// ─── attach / detach per field ────────────────────────────────────────────

function isSupported(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement && (el.type === "text" || el.type === "search" || el.type === "email")) return true
  return false
}

function attachField(field: Field): void {
  const overlay = document.createElement("div")
  overlay.className = OVERLAY_CLASS
  overlay.setAttribute("aria-hidden", "true")
  document.body.appendChild(overlay)

  const observer = new MutationObserver(() => {
    if (field.hasAttribute(DEEP_ATTR)) {
      overlay.style.display = "none"
    } else {
      // Deep-check just closed. The field text may have changed during the
      // overlay's lifetime (e.g. user accepted an LLM correction), so the
      // existing spans could be pointing at stale positions or at words
      // that are now correctly spelled. Re-render against the current text.
      overlay.style.display = ""
      renderDecorations(state)
    }
  })
  observer.observe(field, { attributes: true, attributeFilter: [DEEP_ATTR] })

  const resizeObserver = new ResizeObserver(() => {
    positionOverlay(state)
    renderDecorations(state)
  })
  resizeObserver.observe(field)

  const onInput = () => {
    if (state.debounceTimer) clearTimeout(state.debounceTimer)
    state.debounceTimer = window.setTimeout(() => {
      state.debounceTimer = null
      renderDecorations(state)
    }, DEBOUNCE_MS)
  }
  const onBlur = () => {
    // Keep decorations visible — user might click the popover.
  }
  field.addEventListener("input", onInput)
  field.addEventListener("blur", onBlur)

  const state: FieldState = {
    field,
    overlay,
    debounceTimer: null,
    observer,
    resizeObserver,
    detachListeners: () => {
      field.removeEventListener("input", onInput)
      field.removeEventListener("blur", onBlur)
    }
  }
  states.set(field, state)

  positionOverlay(state)
  if (!field.hasAttribute(DEEP_ATTR)) renderDecorations(state)
}

function detachField(field: Field): void {
  const state = states.get(field)
  if (!state) return
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.observer.disconnect()
  state.resizeObserver.disconnect()
  state.detachListeners()
  state.overlay.remove()
  states.delete(field)
  if (popoverForField === field) closePopover()
}

// ─── decoration rendering ─────────────────────────────────────────────────

async function renderDecorations(state: FieldState): Promise<void> {
  const { field, overlay } = state
  if (field.hasAttribute(DEEP_ATTR)) {
    overlay.replaceChildren()
    return
  }
  const text = field.value
  if (!text.trim()) {
    overlay.replaceChildren()
    return
  }
  const spell = await getSpell()
  const misspellings = findMisspellings(text, (w) => spell.correct(w))
  positionOverlay(state)
  paintMisspellings(state, misspellings)
}

function findMisspellings(text: string, isCorrect: (w: string) => boolean): Misspelling[] {
  const out: Misspelling[] = []
  // Tokenize on word boundaries; keep contraction apostrophes.
  const re = /[A-Za-z][A-Za-z']*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const word = m[0]
    // Skip pure-uppercase tokens (likely acronyms) and very short words.
    if (word.length < 3) continue
    if (word === word.toUpperCase()) continue
    if (isCorrect(word)) continue
    if (isCorrect(word.toLowerCase())) continue
    out.push({ word, start: m.index, end: m.index + word.length })
  }
  return out
}

function paintMisspellings(state: FieldState, misspellings: Misspelling[]): void {
  const { field, overlay } = state
  overlay.replaceChildren()
  if (misspellings.length === 0) return

  const cs = window.getComputedStyle(field)
  const isTextarea = field instanceof HTMLTextAreaElement

  // Render an underline span at each misspelling's bounding rect, computed
  // through a hidden mirror element matching the field's typography metrics.
  const mirror = buildMirror(field, cs)
  document.body.appendChild(mirror)
  try {
    const fieldRect = field.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const padTop = parseFloat(cs.paddingTop) || 0
    const padLeft = parseFloat(cs.paddingLeft) || 0

    for (const mis of misspellings) {
      const rects = measureWordRects(mirror, field, mis.start, mis.end, isTextarea)
      for (const r of rects) {
        const dec = document.createElement("span")
        dec.className = TYPO_CLASS
        dec.dataset.word = mis.word
        dec.dataset.start = String(mis.start)
        dec.dataset.end = String(mis.end)
        dec.style.left = `${fieldRect.left + scrollX + padLeft + r.x - field.scrollLeft}px`
        dec.style.top = `${fieldRect.top + scrollY + padTop + r.y - field.scrollTop}px`
        dec.style.width = `${r.width}px`
        dec.style.height = `${r.height}px`
        dec.addEventListener("mousedown", (e) => {
          e.preventDefault() // do not steal focus from the field
        })
        dec.addEventListener("click", (e) => {
          e.preventDefault()
          e.stopPropagation()
          openPopover(state, dec, mis)
        })
        overlay.appendChild(dec)
      }
    }
  } finally {
    mirror.remove()
  }
}

function positionOverlay(state: FieldState): void {
  // Overlay covers the entire viewport; individual spans are positioned
  // absolutely in page coordinates. This is simpler than per-field clipping
  // and avoids re-clipping on every scroll.
  const { overlay } = state
  overlay.style.position = "absolute"
  overlay.style.top = "0"
  overlay.style.left = "0"
  overlay.style.width = "0"
  overlay.style.height = "0"
  overlay.style.zIndex = String(Z)
  overlay.style.pointerEvents = "none"
}

// ─── mirror element for x/y measurement ───────────────────────────────────
//
// Same trick the existing inline-diff uses in overlay.ts. We build a div
// that styles like the field, copy the text into it (chunked around the
// target word), and read the bounding rect of the wrapping span.

function buildMirror(field: Field, cs: CSSStyleDeclaration): HTMLDivElement {
  const m = document.createElement("div")
  // Copy critical typography + layout metrics. Position offscreen.
  const props = [
    "boxSizing", "width", "height",
    "fontFamily", "fontSize", "fontWeight", "fontStyle",
    "lineHeight", "letterSpacing", "textTransform",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "whiteSpace", "wordSpacing", "tabSize"
  ] as const
  for (const p of props) (m.style as any)[p] = cs.getPropertyValue(toCssProp(p))
  m.style.position = "absolute"
  m.style.visibility = "hidden"
  m.style.pointerEvents = "none"
  m.style.top = "-9999px"
  m.style.left = "-9999px"
  m.style.overflow = "hidden"
  if (field instanceof HTMLTextAreaElement) {
    m.style.whiteSpace = "pre-wrap"
    m.style.wordWrap = "break-word"
    m.style.overflowWrap = "break-word"
  } else {
    m.style.whiteSpace = "pre"
  }
  return m
}

function toCssProp(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

interface WordRect { x: number; y: number; width: number; height: number }

function measureWordRects(
  mirror: HTMLDivElement,
  field: Field,
  start: number,
  end: number,
  _isTextarea: boolean
): WordRect[] {
  const text = field.value
  const before = document.createTextNode(text.slice(0, start))
  const wordSpan = document.createElement("span")
  wordSpan.textContent = text.slice(start, end)
  const after = document.createTextNode(text.slice(end))
  mirror.replaceChildren(before, wordSpan, after)
  // Set width to the field's content-box so wrapping matches.
  mirror.style.width = `${field.clientWidth}px`
  const mirrorRect = mirror.getBoundingClientRect()
  const rects = wordSpan.getClientRects()
  const out: WordRect[] = []
  for (const r of rects) {
    out.push({
      x: r.left - mirrorRect.left,
      y: r.top - mirrorRect.top,
      width: r.width,
      height: r.height
    })
  }
  return out
}

// ─── suggestion popover ───────────────────────────────────────────────────

async function openPopover(state: FieldState, anchor: HTMLElement, mis: Misspelling): Promise<void> {
  closePopover()
  const spell = await getSpell()
  const suggestions = spell.suggest(mis.word).slice(0, 3)

  const pop = document.createElement("div")
  pop.id = POPOVER_ID
  pop.setAttribute("role", "menu")
  const anchorRect = anchor.getBoundingClientRect()
  pop.style.position = "absolute"
  pop.style.top = `${anchorRect.bottom + window.scrollY + 6}px`
  pop.style.left = `${anchorRect.left + window.scrollX}px`
  pop.style.zIndex = String(Z + 1)

  const head = document.createElement("div")
  head.className = "writeai-passive-popover-head"
  head.textContent = `Spelling · ${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"}`
  pop.appendChild(head)

  if (suggestions.length === 0) {
    const empty = document.createElement("div")
    empty.className = "writeai-passive-popover-row muted"
    empty.textContent = "No suggestions"
    pop.appendChild(empty)
  } else {
    for (const s of suggestions) {
      const row = document.createElement("button")
      row.type = "button"
      row.className = "writeai-passive-popover-row"
      row.textContent = s
      row.addEventListener("mousedown", (e) => e.preventDefault())
      row.addEventListener("click", () => {
        applyReplacement(state, mis, s).catch(() => {})
      })
      pop.appendChild(row)
    }
  }

  const sep = document.createElement("hr")
  pop.appendChild(sep)
  const allow = document.createElement("button")
  allow.type = "button"
  allow.className = "writeai-passive-popover-row muted"
  allow.textContent = "+ Add to allowlist (coming soon)"
  allow.disabled = true
  pop.appendChild(allow)

  document.body.appendChild(pop)
  popoverEl = pop
  popoverForField = state.field

  // Click-outside to close
  setTimeout(() => {
    document.addEventListener("mousedown", onDocMouseDownToClose, true)
    document.addEventListener("keydown", onDocKeyToClose, true)
  }, 0)
}

function onDocMouseDownToClose(e: MouseEvent): void {
  if (!popoverEl) return
  if (popoverEl.contains(e.target as Node)) return
  closePopover()
}

function onDocKeyToClose(e: KeyboardEvent): void {
  if (e.key === "Escape") closePopover()
}

function closePopover(): void {
  if (popoverEl) {
    popoverEl.remove()
    popoverEl = null
  }
  popoverForField = null
  document.removeEventListener("mousedown", onDocMouseDownToClose, true)
  document.removeEventListener("keydown", onDocKeyToClose, true)
}

// ─── replace flow ─────────────────────────────────────────────────────────

async function applyReplacement(state: FieldState, mis: Misspelling, replacement: string): Promise<void> {
  const { field } = state
  // Re-resolve current positions in case the user typed since the popover opened.
  const currentText = field.value
  const slice = currentText.slice(mis.start, mis.end)
  if (slice !== mis.word) {
    // The word moved or changed — bail out gracefully.
    closePopover()
    renderDecorations(state)
    return
  }

  // Element-locking pattern — restore in try/finally.
  const wasReadOnly = field.readOnly
  try {
    field.readOnly = true
    const before = currentText.slice(0, mis.start)
    const after = currentText.slice(mis.end)
    const next = before + replacement + after
    const caret = before.length + replacement.length
    field.value = next
    // Move the caret to the end of the inserted word and fire input so any
    // host page that listens to changes (frameworks, autosave) stays in sync.
    field.selectionStart = field.selectionEnd = caret
    field.dispatchEvent(new Event("input", { bubbles: true }))
  } finally {
    field.readOnly = wasReadOnly
  }

  await incrementAutoFix()
  closePopover()
  renderDecorations(state)
}

// ─── global styles ────────────────────────────────────────────────────────

function ensureGlobalStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${OVERLAY_CLASS} { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: ${Z}; }
    .${TYPO_CLASS} {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      border-bottom: 2px dotted #dc2626;
      box-sizing: border-box;
      background: transparent;
    }
    @media (prefers-color-scheme: dark) {
      .${TYPO_CLASS} { border-bottom-color: #f87171; }
    }
    #${POPOVER_ID} {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      min-width: 220px;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.10);
      font: 13px/1.5 'Inter', system-ui, -apple-system, sans-serif;
    }
    #${POPOVER_ID} .writeai-passive-popover-head {
      font-size: 11px; color: #94a3b8; text-transform: uppercase;
      letter-spacing: 0.06em; font-weight: 600; padding: 4px 8px 6px;
    }
    #${POPOVER_ID} .writeai-passive-popover-row {
      display: block; width: 100%; text-align: left;
      padding: 6px 10px; border-radius: 6px; cursor: pointer;
      background: transparent; border: 0; color: inherit;
      font: inherit; font-weight: 500;
    }
    #${POPOVER_ID} .writeai-passive-popover-row:hover:not(:disabled),
    #${POPOVER_ID} .writeai-passive-popover-row:focus-visible {
      background: #eef2ff; color: #2563eb; outline: none;
    }
    #${POPOVER_ID} .writeai-passive-popover-row.muted { color: #94a3b8; font-weight: 400; }
    #${POPOVER_ID} .writeai-passive-popover-row:disabled { cursor: default; }
    #${POPOVER_ID} hr { border: 0; border-top: 1px solid #e2e8f0; margin: 4px 0; }
    @media (prefers-color-scheme: dark) {
      #${POPOVER_ID} {
        background: #1e293b; color: #f1f5f9; border-color: #334155;
        box-shadow: 0 4px 12px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.3);
      }
      #${POPOVER_ID} .writeai-passive-popover-head { color: #64748b; }
      #${POPOVER_ID} .writeai-passive-popover-row:hover:not(:disabled),
      #${POPOVER_ID} .writeai-passive-popover-row:focus-visible {
        background: #1e1b4b; color: #93c5fd;
      }
      #${POPOVER_ID} .writeai-passive-popover-row.muted { color: #64748b; }
      #${POPOVER_ID} hr { border-top-color: #334155; }
    }
  `
  document.head.appendChild(style)
}

function removeGlobalStyles(): void {
  const el = document.getElementById(STYLE_ID)
  if (el) el.remove()
}

// ─── test-only exports ────────────────────────────────────────────────────

export const _internals = {
  findMisspellings,
  states,
  isSupported,
  attachField,
  detachField,
  applyReplacement,
  renderDecorations
}
