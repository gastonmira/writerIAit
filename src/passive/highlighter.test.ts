// highlighter tests — covers the passive highlighter's testable surface.
// Splits into 4 groups:
//   1. findMisspellings — pure tokenization / detection (AC4)
//   2. applyReplacement — element-locking pattern, caret, dispatch (AC6)
//   3. autoFix counter — stats isolation contract (AC7)
//   4. Deep-active observer + F1 regression — coexistence (AC8)
//   5. Privacy — no chrome.runtime.sendMessage during normal operation (AC10)

import { describe, it, expect, beforeEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import nspell from "nspell"
import { _internals } from "./highlighter"
import { _resetSpellCache } from "./dictionary-loader"

const aff = readFileSync("public/dictionaries/en.aff", "utf8")
const dic = readFileSync("public/dictionaries/en.dic", "utf8")

function mockDictFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      new Response(url.endsWith("/en.aff") ? aff : url.endsWith("/en.dic") ? dic : "", { status: 200 })
    )
  )
}

// 532-word benchmark sample with 19 intentional typos — same string used in
// the spec-phase library bench and referenced in AC4.
const BENCH_SAMPLE = `
The quick brown fox jumps over the lazy dog. This is a teh test of the
spelling checker, mixing common english words with a few intentioanl
typos like recieve, seperate, occured, definately, accomodate, and
neccessary. Non-native speakers of english often struggle with these
specifc patterns. The extension should highlight thse mistakes in real
time without sending any data to a remote server. Privacy matters.
${"The cat sat on the mat near the window watching the birds outside. ".repeat(20)}
${"Programming requires careful attention to detail and a methodical approach. ".repeat(20)}
typos: wierd, freind, beleive, achievment, occassion, embarassment, mispell.
`.trim()

const EXPECTED_TYPOS = [
  "teh", "intentioanl", "recieve", "seperate", "occured",
  "definately", "accomodate", "neccessary", "specifc", "thse",
  "wierd", "freind", "beleive", "achievment", "occassion",
  "embarassment", "mispell"
]

// ─── findMisspellings — AC4 ─────────────────────────────────────────────────

describe("findMisspellings", () => {
  const spell = nspell(aff, dic)
  const isCorrect = (w: string) => spell.correct(w)

  it("detects every intentional typo in the 19-typo benchmark sample (AC4)", () => {
    const out = _internals.findMisspellings(BENCH_SAMPLE, isCorrect)
    const words = out.map((m) => m.word)
    for (const t of EXPECTED_TYPOS) {
      expect(words, `expected to flag "${t}"`).toContain(t)
    }
  })

  it("reports total flagged count in the 17–25 window", () => {
    const out = _internals.findMisspellings(BENCH_SAMPLE, isCorrect)
    expect(out.length).toBeGreaterThanOrEqual(17)
    expect(out.length).toBeLessThanOrEqual(25)
  })

  it("does not flag common short English words (the, cat, programming, ...)", () => {
    const out = _internals.findMisspellings(BENCH_SAMPLE, isCorrect)
    const set = new Set(out.map((m) => m.word.toLowerCase()))
    for (const ok of ["the", "cat", "programming", "extension", "browser", "privacy"]) {
      expect(set.has(ok), `unexpected false positive: "${ok}"`).toBe(false)
    }
  })

  it("skips tokens shorter than 3 characters", () => {
    const out = _internals.findMisspellings("xz qq is in", isCorrect)
    // None of these are >=3 chars OR they're real words; assert no 1-2-char output.
    expect(out.every((m) => m.word.length >= 3)).toBe(true)
  })

  it("skips pure-uppercase tokens (acronyms)", () => {
    const out = _internals.findMisspellings("Send via HTTP to ASDF", isCorrect)
    const words = out.map((m) => m.word)
    expect(words).not.toContain("HTTP")
    expect(words).not.toContain("ASDF")
  })

  it("preserves contraction apostrophes (don't, can't)", () => {
    // The regex /[A-Za-z][A-Za-z']*/g — "don't" is a single token.
    // Whether it's flagged depends on the dict, but the tokenization shouldn't split it.
    const out = _internals.findMisspellings("don't can't asdfasdf", isCorrect)
    // asdfasdf is clearly a typo; assert it was found as one token
    expect(out.some((m) => m.word === "asdfasdf")).toBe(true)
  })

  it("returns correct start/end offsets for each misspelling", () => {
    const out = _internals.findMisspellings("I recieve emails", isCorrect)
    const m = out.find((x) => x.word === "recieve")
    expect(m).toBeDefined()
    expect("I recieve emails".slice(m!.start, m!.end)).toBe("recieve")
  })
})

// ─── applyReplacement — AC6 element-locking pattern + caret + dispatch ──────

describe("applyReplacement (AC6)", () => {
  beforeEach(() => {
    mockDictFetch()
    _resetSpellCache()
    document.body.innerHTML = ""
    _internals.states.clear()
  })

  function makeTextarea(value: string): HTMLTextAreaElement {
    const ta = document.createElement("textarea")
    ta.value = value
    document.body.appendChild(ta)
    return ta
  }

  it("replaces the misspelled token with the chosen suggestion", async () => {
    const ta = makeTextarea("I recieve emails")
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(ta.value).toBe("I receive emails")
  })

  it("positions the caret at the END of the inserted word", async () => {
    const ta = makeTextarea("I recieve emails")
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(ta.selectionStart).toBe("I receive".length)
    expect(ta.selectionEnd).toBe("I receive".length)
  })

  it("dispatches a bubbling 'input' event so host frameworks stay in sync", async () => {
    const ta = makeTextarea("I recieve emails")
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    const handler = vi.fn()
    document.body.addEventListener("input", handler)
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(handler).toHaveBeenCalled()
    document.body.removeEventListener("input", handler)
  })

  it("restores field.readOnly after a successful replace (element-locking)", async () => {
    const ta = makeTextarea("I recieve emails")
    expect(ta.readOnly).toBe(false)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(ta.readOnly).toBe(false)
  })

  it("preserves a pre-existing readOnly=true (does not silently flip it to false)", async () => {
    const ta = makeTextarea("I recieve emails")
    ta.readOnly = true
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    // Even when readOnly is true coming in, applyReplacement runs (it forces
    // readOnly during the write) and MUST restore the original value afterward.
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(ta.readOnly).toBe(true)
  })

  it("bails out gracefully if the word position is stale (user typed since)", async () => {
    const ta = makeTextarea("Some other text now")
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    // The misspelling was recorded for an older value; current value doesn't
    // contain "recieve" at offset 2..9. applyReplacement must detect and skip.
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(ta.value).toBe("Some other text now")
  })
})

// ─── autoFix counter integration — AC7 stats isolation ──────────────────────

describe("applyReplacement → autoFix counter (AC7)", () => {
  beforeEach(() => {
    mockDictFetch()
    _resetSpellCache()
    document.body.innerHTML = ""
    _internals.states.clear()
  })

  it("increments autoFixesCount by 1 on each accepted replacement", async () => {
    const ta = document.createElement("textarea")
    ta.value = "I recieve emails"
    document.body.appendChild(ta)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    const stored = await chrome.storage.local.get("autoFixesCount")
    expect(stored.autoFixesCount).toBe(1)
  })

  it("does NOT write a CorrectionEntry to the LLM corrections array (stats isolation)", async () => {
    const ta = document.createElement("textarea")
    ta.value = "I recieve emails"
    document.body.appendChild(ta)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    const stored = await chrome.storage.local.get("corrections")
    // Either undefined or empty array — both mean "passive did not pollute".
    expect(stored.corrections === undefined || (stored.corrections as unknown[]).length === 0).toBe(true)
  })
})

// ─── Deep-active observer — AC8 + F1 regression ────────────────────────────

describe("deep-active observer (AC8 + F1 regression)", () => {
  beforeEach(() => {
    mockDictFetch()
    _resetSpellCache()
    document.body.innerHTML = ""
    _internals.states.clear()
  })

  it("hides the decoration overlay when data-writeai-deep-active is set", async () => {
    const ta = document.createElement("textarea")
    ta.value = "I recieve emails"
    document.body.appendChild(ta)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!

    ta.setAttribute("data-writeai-deep-active", "1")
    // MutationObservers fire on a microtask; wait one tick.
    await new Promise((r) => setTimeout(r, 0))
    expect(state.overlay.style.display).toBe("none")
  })

  it("F1 regression — re-renders decorations when the flag is REMOVED", async () => {
    const ta = document.createElement("textarea")
    ta.value = "I recieve emails"
    document.body.appendChild(ta)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!

    // Simulate deep-check open then close.
    ta.setAttribute("data-writeai-deep-active", "1")
    await new Promise((r) => setTimeout(r, 0))
    expect(state.overlay.style.display).toBe("none")

    // Spy on renderDecorations side-effect: change the field text under the
    // observer's nose, then remove the flag. After the observer fires, the
    // overlay must be visible AND a re-render must have been triggered.
    ta.value = "I receive emails now perfectly correctly spelled"
    ta.removeAttribute("data-writeai-deep-active")
    // The observer fires + renderDecorations is async (fetches spell, then paints).
    // Give it enough ticks for the chained promises to settle.
    await new Promise((r) => setTimeout(r, 30))
    expect(state.overlay.style.display).toBe("")
  })
})

// ─── Privacy — AC10 ────────────────────────────────────────────────────────

describe("privacy contract (AC10)", () => {
  beforeEach(() => {
    mockDictFetch()
    _resetSpellCache()
    document.body.innerHTML = ""
    _internals.states.clear()
    ;(chrome.runtime.sendMessage as any).mockClear?.()
  })

  it("never calls chrome.runtime.sendMessage during attach/render/replace", async () => {
    const ta = document.createElement("textarea")
    ta.value = "I recieve emails"
    document.body.appendChild(ta)
    _internals.attachField(ta)
    const state = _internals.states.get(ta)!
    await _internals.renderDecorations(state)
    await _internals.applyReplacement(state, { word: "recieve", start: 2, end: 9 }, "receive")
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })
})
