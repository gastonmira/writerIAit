import { describe, it, expect } from "vitest"
import {
  detectTone,
  buildSystemPrompt,
  parseLLMResponse,
  applyCorrections
} from "./corrector"

// ─── detectTone ────────────────────────────────────────────────────────────

describe("detectTone", () => {
  it("returns 'professional email' for Gmail", () => {
    expect(detectTone("mail.google.com")).toBe("professional email")
  })

  it("returns 'casual business' for Slack", () => {
    expect(detectTone("app.slack.com")).toBe("casual business")
  })

  it("returns 'technical English' for GitHub", () => {
    expect(detectTone("github.com")).toBe("technical English")
  })

  it("returns 'clear and readable' for unknown hostname", () => {
    expect(detectTone("example.com")).toBe("clear and readable")
  })

  it("returns 'clear and readable' for empty hostname", () => {
    expect(detectTone("")).toBe("clear and readable")
  })
})

// ─── buildSystemPrompt ─────────────────────────────────────────────────────

describe("buildSystemPrompt — correct mode (default)", () => {
  it("includes Spanish transfer error phrasing for Spanish", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email")
    expect(prompt).toContain("Spanish-to-English transfer errors")
  })

  it("includes Portuguese transfer error phrasing for Portuguese", () => {
    const prompt = buildSystemPrompt("Portuguese", "professional email")
    expect(prompt).toContain("Portuguese-to-English transfer errors")
  })

  it("does not include transfer error phrasing for Other", () => {
    const prompt = buildSystemPrompt("Other", "clear and readable")
    expect(prompt).not.toContain("transfer errors")
  })

  it("includes tone in prompt", () => {
    const prompt = buildSystemPrompt("Spanish", "casual business")
    expect(prompt).toContain("casual business")
  })

  it("always includes multi-word phrase requirement", () => {
    const prompt = buildSystemPrompt("Other", "clear and readable")
    expect(prompt).toContain("2–5 words")
  })

  it("always returns JSON-only instruction", () => {
    const prompt = buildSystemPrompt("Spanish", "technical English")
    expect(prompt).toContain("ONLY a JSON array")
  })

  it("backward compat: no mode arg produces same output as explicit correct mode", () => {
    expect(buildSystemPrompt("Spanish", "professional email"))
      .toBe(buildSystemPrompt("Spanish", "professional email", "correct"))
  })
})

describe("buildSystemPrompt — improve mode", () => {
  it("mentions fluency / natural phrasing", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).toMatch(/fluency|natural/i)
  })

  it("mentions idiomatic", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).toContain("idiomatic")
  })

  it("includes tone", () => {
    const prompt = buildSystemPrompt("Spanish", "casual business", "improve")
    expect(prompt).toContain("casual business")
  })

  it("includes Spanish language phrase", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).toContain("Spanish-to-English transfer errors")
  })

  it("does NOT contain grammar-errors phrasing", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).not.toContain("Find ALL grammar errors")
  })

  it("requires JSON-only output", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).toContain("ONLY a JSON array")
  })

  it("includes 2–5 word original context rule", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "improve")
    expect(prompt).toContain("2–5 words")
  })
})

describe("buildSystemPrompt — rewrite mode", () => {
  it("professional intent: mentions formal or polished", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", "professional")
    expect(prompt).toMatch(/formal|polished/i)
  })

  it("friendly intent: mentions warm or approachable or conversational", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", "friendly")
    expect(prompt).toMatch(/warm|approachable|conversational/i)
  })

  it("concise intent: mentions concise and cut", () => {
    const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", "concise")
    expect(prompt).toContain("concise")
    expect(prompt).toContain("cut")
  })

  it("all intents: contains verbatim substring constraint", () => {
    for (const intent of ["professional", "friendly", "concise"] as const) {
      const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", intent)
      expect(prompt).toContain("verbatim")
    }
  })

  it("all intents: includes Spanish language phrase", () => {
    for (const intent of ["professional", "friendly", "concise"] as const) {
      const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", intent)
      expect(prompt).toContain("Spanish-to-English transfer errors")
    }
  })

  it("all intents: requires JSON-only output", () => {
    for (const intent of ["professional", "friendly", "concise"] as const) {
      const prompt = buildSystemPrompt("Spanish", "professional email", "rewrite", intent)
      expect(prompt).toContain("ONLY a JSON array")
    }
  })

  it("defaults to professional when no rewriteIntent arg", () => {
    expect(buildSystemPrompt("Spanish", "professional email", "rewrite"))
      .toBe(buildSystemPrompt("Spanish", "professional email", "rewrite", "professional"))
  })
})

// ─── parseLLMResponse ──────────────────────────────────────────────────────

describe("parseLLMResponse", () => {
  it("parses a valid JSON array of corrections", () => {
    const raw = JSON.stringify([
      { original: "we have presented", replacement: "we presented", reason: "Simple past preferred" }
    ])
    const result = parseLLMResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].original).toBe("we have presented")
    expect(result[0].replacement).toBe("we presented")
    expect(result[0].reason).toBe("Simple past preferred")
  })

  it("parses JSON wrapped in a markdown code fence", () => {
    const raw = "```json\n[{\"original\": \"since 3 years\", \"replacement\": \"for 3 years\", \"reason\": \"Duration uses for\"}]\n```"
    const result = parseLLMResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].original).toBe("since 3 years")
  })

  it("parses JSON wrapped in a plain code fence", () => {
    const raw = "```\n[{\"original\": \"since 3 years\", \"replacement\": \"for 3 years\", \"reason\": \"Duration\"}]\n```"
    const result = parseLLMResponse(raw)
    expect(result).toHaveLength(1)
  })

  it("returns empty array for malformed JSON without throwing", () => {
    expect(() => parseLLMResponse("not json at all")).not.toThrow()
    expect(parseLLMResponse("not json at all")).toEqual([])
  })

  it("returns empty array for empty LLM response", () => {
    expect(parseLLMResponse("")).toEqual([])
  })

  it("returns empty array when LLM returns []", () => {
    expect(parseLLMResponse("[]")).toEqual([])
  })

  it("discards elements missing the reason field", () => {
    const raw = JSON.stringify([
      { original: "good phrase here", replacement: "better phrase", reason: "ok" },
      { original: "bad element here", replacement: "fixed" } // missing reason
    ])
    const result = parseLLMResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].original).toBe("good phrase here")
  })

  it("discards elements where original is empty string", () => {
    const raw = JSON.stringify([
      { original: "", replacement: "something", reason: "reason" }
    ])
    expect(parseLLMResponse(raw)).toEqual([])
  })

  it("returns empty array if LLM returns an object instead of array", () => {
    const raw = JSON.stringify({ original: "phrase", replacement: "fix", reason: "ok" })
    expect(parseLLMResponse(raw)).toEqual([])
  })
})

// ─── applyCorrections ──────────────────────────────────────────────────────

describe("applyCorrections", () => {
  it("applies a single correction", () => {
    const text = "I am writing since 3 years in this company."
    const corrections = [
      { original: "since 3 years", replacement: "for 3 years", reason: "Duration" }
    ]
    expect(applyCorrections(text, corrections)).toBe(
      "I am writing for 3 years in this company."
    )
  })

  it("returns original text unchanged if original not found", () => {
    const text = "This sentence is fine."
    const corrections = [
      { original: "phrase not present here", replacement: "fixed", reason: "r" }
    ]
    expect(applyCorrections(text, corrections)).toBe("This sentence is fine.")
  })

  it("applies two non-overlapping corrections right-to-left", () => {
    const text = "we have presented the results since 3 years ago."
    const corrections = [
      { original: "we have presented", replacement: "we presented", reason: "r1" },
      { original: "since 3 years ago", replacement: "for 3 years", reason: "r2" }
    ]
    const result = applyCorrections(text, corrections)
    expect(result).toBe("we presented the results for 3 years.")
  })

  it("applies corrections in reverse order so offsets stay valid", () => {
    // Both corrections applied; the rightmost must be applied first
    const text = "the quick brown fox jumps over the lazy dog"
    const corrections = [
      { original: "quick brown fox", replacement: "slow red cat", reason: "r1" },
      { original: "lazy dog", replacement: "tired bird", reason: "r2" }
    ]
    const result = applyCorrections(text, corrections)
    expect(result).toBe("the slow red cat jumps over the tired bird")
  })

  it("keeps only the rightmost correction when two corrections overlap", () => {
    const text = "we have presented the numbers make the same pattern"
    // Overlapping: first correction covers chars 3-19, second covers chars 11-27
    const corrections = [
      { original: "have presented the", replacement: "presented the", reason: "r1" },
      { original: "presented the numbers", replacement: "presented these numbers", reason: "r2" }
    ]
    const result = applyCorrections(text, corrections)
    // Only the rightmost (further right start) should be applied
    expect(result).toContain("presented these numbers")
    // "have" is still present — the left correction was NOT applied
    expect(result).toBe("we have presented these numbers make the same pattern")
  })

  it("handles empty corrections array", () => {
    const text = "Hello world this is a test."
    expect(applyCorrections(text, [])).toBe("Hello world this is a test.")
  })

  it("uses first occurrence when original appears multiple times", () => {
    const text = "the cat sat on the mat near the cat"
    const corrections = [
      { original: "the cat", replacement: "a cat", reason: "r" }
    ]
    const result = applyCorrections(text, corrections)
    // First occurrence (pos 0) replaced, second (pos 28) untouched
    expect(result.startsWith("a cat sat")).toBe(true)
  })
})
