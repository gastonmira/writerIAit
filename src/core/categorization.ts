import { type Category } from "./categories"

// Heuristic regex tagger. Runs synchronously when a correction is accepted,
// so the entry has a category before any async LLM refinement returns.
// Order matters: more specific patterns first so generic ones don't shadow.

const RULES: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /subject[\s-]*verb|agreement/i, category: "subject-verb-agreement" },
  { pattern: /false[\s-]*friend|native[\s-]*language|transfer/i, category: "false-friends" },
  { pattern: /contract(ion)?|don'?t|isn'?t|won'?t|can'?t/i, category: "contractions" },
  { pattern: /\barticle\b|missing\s+(?:a|an|the)\b|extra\s+(?:a|an|the)\b/i, category: "articles" },
  { pattern: /preposition/i, category: "prepositions" },
  { pattern: /\btense\b|past tense|present tense|future tense|perfect tense/i, category: "tense" },
  { pattern: /plural(iz)?(e|ation)?|singular/i, category: "pluralization" },
  { pattern: /word[\s-]*order/i, category: "word-order" },
  { pattern: /capital/i, category: "capitalization" },
  { pattern: /punctuat|comma|period|apostrophe|semicolon/i, category: "punctuation" },
  { pattern: /word[\s-]*choice|better word|more natural|natural phras/i, category: "word-choice" },
  { pattern: /spell|typo|misspell/i, category: "spelling" },
]

export function categorizeLocally(reason: string): Category {
  for (const r of RULES) if (r.pattern.test(reason)) return r.category
  return "other"
}
