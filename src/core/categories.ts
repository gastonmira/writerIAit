// Closed-set vocabulary of correction categories.
// Single source of truth: the Insights dashboard, the regex tagger,
// the LLM tagger validator, and the storage schema all read from here.

export const CATEGORIES = [
  "spelling",
  "articles",
  "prepositions",
  "subject-verb-agreement",
  "tense",
  "pluralization",
  "word-order",
  "capitalization",
  "punctuation",
  "word-choice",
  "contractions",
  "false-friends",
  "other",
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  "spelling": "Spelling",
  "articles": "Articles (a / an / the)",
  "prepositions": "Prepositions",
  "subject-verb-agreement": "Subject–verb agreement",
  "tense": "Tense",
  "pluralization": "Pluralization",
  "word-order": "Word order",
  "capitalization": "Capitalization",
  "punctuation": "Punctuation",
  "word-choice": "Word choice",
  "contractions": "Contractions",
  "false-friends": "False friends",
  "other": "Other",
}

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s)
}
