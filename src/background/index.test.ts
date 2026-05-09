// background/index.test.ts — tests for the pure error-mapping helper.
//
// handleCheckText itself is glued to chrome.* APIs and the network, but the
// error-to-response mapping is extracted as a pure function so we can lock its
// behaviour down — especially the 429 rate-limit branch the user-facing
// overlay depends on.

import { describe, it, expect } from "vitest"
import { mapErrorToResponse, parseTagResponse } from "./index"

describe("mapErrorToResponse", () => {
  it("maps an AbortError to the cancelled sentinel", () => {
    const err = new Error("aborted")
    err.name = "AbortError"
    expect(mapErrorToResponse(err)).toEqual({ error: "cancelled" })
  })

  it("maps a RATE_LIMIT error to a user-facing rate-limit message", () => {
    const out = mapErrorToResponse(new Error("RATE_LIMIT"))
    expect(out).toEqual({
      error: "Rate limit reached. Wait a minute, or switch provider from the popup.",
    })
  })

  it("treats RATE_LIMIT as a higher-priority signal than other Error states", () => {
    const err = new Error("RATE_LIMIT")
    // Ensure it's not accidentally caught by the AbortError branch.
    err.name = "Error"
    const out = mapErrorToResponse(err)
    expect((out as { error: string }).error).toContain("Rate limit reached")
  })

  it("maps a TypeError (fetch network failure) to the offline message", () => {
    expect(mapErrorToResponse(new TypeError("Failed to fetch"))).toEqual({
      error: "No internet connection.",
    })
  })

  it("falls back to the generic API failure message for other Errors", () => {
    const out = mapErrorToResponse(new Error("OpenAI 500"))
    expect(out).toEqual({ error: "API request failed: OpenAI 500" })
  })

  it("falls back to the generic message for non-Error throwables", () => {
    expect(mapErrorToResponse("boom")).toEqual({ error: "API request failed: boom" })
    expect(mapErrorToResponse(42)).toEqual({ error: "API request failed: 42" })
    expect(mapErrorToResponse(undefined)).toEqual({ error: "API request failed: undefined" })
  })

  it("does not leak the RATE_LIMIT internal sentinel into the user-visible message", () => {
    const out = mapErrorToResponse(new Error("RATE_LIMIT"))
    expect((out as { error: string }).error).not.toContain("RATE_LIMIT")
  })
})

// ─── parseTagResponse ─────────────────────────────────────────────────────
// Pure helper from the async category-refinement path: normalizes the LLM's
// reply and returns a Category, or null when the response is unusable.
// The async tagger's contract: regex category persists when this returns null.

describe("parseTagResponse", () => {
  it("returns the matching Category for an exact lowercase label", () => {
    expect(parseTagResponse("articles")).toBe("articles")
    expect(parseTagResponse("subject-verb-agreement")).toBe("subject-verb-agreement")
    expect(parseTagResponse("false-friends")).toBe("false-friends")
  })

  it("normalizes case and surrounding whitespace", () => {
    expect(parseTagResponse("ARTICLES")).toBe("articles")
    expect(parseTagResponse("  Spelling  ")).toBe("spelling")
    expect(parseTagResponse("\nTense\n")).toBe("tense")
  })

  it("strips quotes and trailing punctuation common in LLM replies", () => {
    expect(parseTagResponse('"articles"')).toBe("articles")
    expect(parseTagResponse("`prepositions`")).toBe("prepositions")
    expect(parseTagResponse("'tense'")).toBe("tense")
    expect(parseTagResponse("articles.")).toBe("articles")
  })

  it("returns null for labels outside the closed Category set", () => {
    expect(parseTagResponse("grammar")).toBeNull()
    expect(parseTagResponse("style")).toBeNull()
    expect(parseTagResponse("articleS-with-typo")).toBeNull()
  })

  it("returns null for empty / whitespace-only / explanation-style replies", () => {
    expect(parseTagResponse("")).toBeNull()
    expect(parseTagResponse("   ")).toBeNull()
    expect(parseTagResponse("This reason is about articles in English")).toBeNull()
  })

  it("returns null when the LLM returns a category-like string with extra words", () => {
    // Defends against prompt-injection attempts that try to mix labels.
    expect(parseTagResponse("articles or prepositions")).toBeNull()
    expect(parseTagResponse("category: spelling")).toBeNull()
  })
})
