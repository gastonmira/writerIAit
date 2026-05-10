// Performance budgets — AC2 (cold-start) and AC3 (per-keystroke warm).
// CI thresholds are GENEROUS (~5× the spec budget) to keep tests stable
// across machines while still catching catastrophic regressions.

import { describe, it, expect, beforeEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import nspell from "nspell"
import { _internals } from "./highlighter"
import { getSpell, _resetSpellCache } from "./dictionary-loader"

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

const WARM_SAMPLE = `
The quick brown fox jumps over the lazy dog. ${"The cat sat on the mat near the window watching the birds outside. ".repeat(20)}
${"Programming requires careful attention to detail and a methodical approach. ".repeat(20)}
typos: recieve seperate occured definately accomodate neccessary wierd freind beleive.
`.trim()

describe("perf — AC2 cold-start budget", () => {
  beforeEach(() => {
    _resetSpellCache()
    mockDictFetch()
  })

  // Spec budget: 150 ms p95.
  // Node-bench measured ~53 ms cold-start parse on the maintainer's machine.
  // CI guardrail: 500 ms — would only fire on catastrophic regression (5×).
  it("getSpell() completes within the 500 ms CI guardrail", async () => {
    const t0 = performance.now()
    await getSpell()
    const elapsed = performance.now() - t0
    expect(elapsed, `cold-start took ${elapsed.toFixed(1)}ms`).toBeLessThan(500)
  })
})

describe("perf — AC3 per-keystroke warm budget", () => {
  beforeEach(() => {
    _resetSpellCache()
  })

  // Spec budget: 5 ms warm for a 1000-word textarea.
  // Node-bench: 0.10 ms median for 532 words.
  // CI guardrail: 50 ms median — 500× the bench, 10× the spec. Catches a true
  // perf cliff (e.g. someone moves spell-check to a sync fetch) without
  // flaking on cold-CPU runners.
  it("findMisspellings on a 500+ word sample stays under 50 ms (median of 5 runs)", () => {
    const spell = nspell(aff, dic)
    const isCorrect = (w: string) => spell.correct(w)

    // Warm the JIT.
    _internals.findMisspellings(WARM_SAMPLE, isCorrect)

    const runs: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      _internals.findMisspellings(WARM_SAMPLE, isCorrect)
      runs.push(performance.now() - t0)
    }
    runs.sort((a, b) => a - b)
    const median = runs[2]
    expect(median, `warm-check median ${median.toFixed(2)}ms over runs ${runs.map((r) => r.toFixed(2)).join(", ")}`).toBeLessThan(50)
  })
})
