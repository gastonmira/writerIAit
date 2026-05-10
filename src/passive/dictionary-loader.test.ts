// dictionary-loader tests — memoization, fetch wiring, _reset hook.
// The loader is the only piece of passive that touches I/O (chrome.runtime.getURL
// + fetch), so its tests focus on the contract: one fetch per cache lifetime,
// returns a usable nspell instance, _resetSpellCache forces a fresh load.

import { describe, it, expect, beforeEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import { getSpell, _resetSpellCache } from "./dictionary-loader"

const aff = readFileSync("public/dictionaries/en.aff", "utf8")
const dic = readFileSync("public/dictionaries/en.dic", "utf8")

function mockFetch() {
  const fetchSpy = vi.fn(async (url: string) => {
    const body = url.endsWith("/en.aff") ? aff : url.endsWith("/en.dic") ? dic : ""
    return new Response(body, { status: 200 })
  })
  vi.stubGlobal("fetch", fetchSpy)
  return fetchSpy
}

describe("dictionary-loader", () => {
  beforeEach(() => {
    _resetSpellCache()
    vi.unstubAllGlobals()
  })

  it("fetches en.aff and en.dic via chrome.runtime.getURL on first call", async () => {
    const fetchSpy = mockFetch()
    await getSpell()
    const urls = fetchSpy.mock.calls.map((c) => c[0])
    expect(urls).toContain("chrome-extension://test/dictionaries/en.aff")
    expect(urls).toContain("chrome-extension://test/dictionaries/en.dic")
  })

  it("memoizes — second call does not refetch", async () => {
    const fetchSpy = mockFetch()
    await getSpell()
    await getSpell()
    await getSpell()
    // exactly 2 fetches (aff + dic), independent of how many getSpell() calls
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("returns a usable nspell instance — .correct() and .suggest() work", async () => {
    mockFetch()
    const spell = await getSpell()
    expect(spell.correct("hello")).toBe(true)
    expect(spell.correct("recieve")).toBe(false)
    const suggestions = spell.suggest("recieve")
    expect(suggestions).toContain("receive")
  })

  it("_resetSpellCache forces a fresh load on next call", async () => {
    const fetchSpy = mockFetch()
    await getSpell()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    _resetSpellCache()
    await getSpell()
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })
})
