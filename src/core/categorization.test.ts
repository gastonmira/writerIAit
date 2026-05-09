// categorization.test.ts — vocabulary tests for the local regex tagger.
// The tagger is the synchronous default category set when a correction is
// accepted; the LLM tagger refines async. These tests pin down the buckets
// each common English-correction reason should land in.

import { describe, it, expect } from "vitest"
import { categorizeLocally } from "./categorization"

describe("categorizeLocally — vocabulary table", () => {
  const cases: Array<{ reason: string; expected: string }> = [
    // Direct keyword hits
    { reason: "Missing article 'the' before noun", expected: "articles" },
    { reason: "Wrong preposition: should be 'on' not 'at'", expected: "prepositions" },
    { reason: "Subject-verb agreement: 'they were' not 'they was'", expected: "subject-verb-agreement" },
    { reason: "Wrong tense — past simple needed here", expected: "tense" },
    { reason: "Pluralization: 'children' not 'childs'", expected: "pluralization" },
    { reason: "Word order is unnatural in English", expected: "word-order" },
    { reason: "Capitalization: proper noun must be capitalized", expected: "capitalization" },
    { reason: "Punctuation: missing comma in compound sentence", expected: "punctuation" },
    { reason: "Spelling: 'recieve' should be 'receive'", expected: "spelling" },
    { reason: "Better word choice for a more natural phrasing", expected: "word-choice" },
    { reason: "Use a contraction here: don't instead of do not", expected: "contractions" },
    { reason: "False friend — 'actually' doesn't mean 'currently'", expected: "false-friends" },
    // Native-language transfer falls into false-friends
    { reason: "Native-language transfer error from Spanish", expected: "false-friends" },
  ]

  for (const c of cases) {
    it(`maps "${c.reason.slice(0, 40)}…" to ${c.expected}`, () => {
      expect(categorizeLocally(c.reason)).toBe(c.expected)
    })
  }
})

describe("categorizeLocally — edge cases", () => {
  it("returns 'other' when no rule matches", () => {
    expect(categorizeLocally("This is a completely random reason text")).toBe("other")
  })

  it("returns 'other' on empty string", () => {
    expect(categorizeLocally("")).toBe("other")
  })

  it("is case-insensitive", () => {
    expect(categorizeLocally("MISSING ARTICLE")).toBe("articles")
    expect(categorizeLocally("Missing Article")).toBe("articles")
    expect(categorizeLocally("missing article")).toBe("articles")
  })

  it("matches typo-related patterns to spelling", () => {
    expect(categorizeLocally("typo in 'helo'")).toBe("spelling")
    expect(categorizeLocally("misspelled word")).toBe("spelling")
  })

  it("matches contraction tokens directly (don't / isn't / can't)", () => {
    expect(categorizeLocally("don't is preferred over do not here")).toBe("contractions")
    expect(categorizeLocally("isn't more natural")).toBe("contractions")
    expect(categorizeLocally("can't is the right form")).toBe("contractions")
  })

  it("prefers the more specific subject-verb-agreement rule before article match", () => {
    // 'subject' + 'a' could trigger both, specific must win because it's first.
    expect(categorizeLocally("subject-verb agreement: a singular noun needs a singular verb")).toBe("subject-verb-agreement")
  })

  it("does not over-match common words to prepositions (the rule requires the word 'preposition')", () => {
    // Old broad rule could match 'in' / 'on' anywhere; current rule needs the keyword.
    expect(categorizeLocally("a sentence that mentions in and on without grammar context")).toBe("other")
  })

  it("matches punctuation cues like 'comma' / 'apostrophe' / 'semicolon'", () => {
    expect(categorizeLocally("missing comma after introductory phrase")).toBe("punctuation")
    expect(categorizeLocally("apostrophe missing in possessive")).toBe("punctuation")
    expect(categorizeLocally("use a semicolon between clauses")).toBe("punctuation")
  })
})
