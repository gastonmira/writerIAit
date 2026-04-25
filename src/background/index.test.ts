// background/index.test.ts — tests for the pure error-mapping helper.
//
// handleCheckText itself is glued to chrome.* APIs and the network, but the
// error-to-response mapping is extracted as a pure function so we can lock its
// behaviour down — especially the 429 rate-limit branch the user-facing
// overlay depends on.

import { describe, it, expect } from "vitest"
import { mapErrorToResponse } from "./index"

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
