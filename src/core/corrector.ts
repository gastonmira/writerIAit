// corrector.ts — pure correction logic
// NO chrome.* imports — this module must stay portable (v3 native app)

import type { Correction } from "../types"

// ─── Tone Detection ────────────────────────────────────────────────────────

const TONE_MAP: Record<string, string> = {
  "mail.google.com": "professional email",
  "app.slack.com": "casual business",
  "github.com": "technical English"
}

export function detectTone(hostname: string): string {
  return TONE_MAP[hostname] ?? "clear and readable"
}

// ─── System Prompt ─────────────────────────────────────────────────────────

const LANGUAGE_PHRASES: Record<string, string> = {
  Spanish:
    "Spanish-to-English transfer errors (e.g., verb aspect, ser/estar confusion, prepositions, false cognates)",
  Portuguese:
    "Portuguese-to-English transfer errors (e.g., verb tense, prepositions, article usage)",
  French:
    "French-to-English transfer errors (e.g., false cognates, article usage, adjective placement)",
  German:
    "German-to-English transfer errors (e.g., word order, compound nouns, modal verbs)",
  Arabic:
    "Arabic-to-English transfer errors (e.g., article omission, verb placement, plural forms)",
  Chinese:
    "Chinese-to-English transfer errors (e.g., aspect markers, measure words, article usage)"
}

export function buildSystemPrompt(nativeLanguage: string, tone: string): string {
  const languagePhrase = LANGUAGE_PHRASES[nativeLanguage]

  const languageInstruction = languagePhrase
    ? `The writer is a native ${nativeLanguage} speaker. Pay special attention to ${languagePhrase}.`
    : "Pay attention to common grammar and phrasing errors."

  return `You are a strict English grammar checker helping non-native speakers write correctly.

${languageInstruction}

The text should read as ${tone}.

Find ALL grammar errors, including:
- Missing apostrophes in contractions (e.g. "im" → "I'm", "dont" → "don't", "its" → "it's")
- Missing or wrong pronouns (e.g. "and m wrong" → "and I'm wrong")
- Subject-verb agreement, tense, word choice, and phrasing errors

Rules for your JSON output:
- "original" should be 2–5 words of context around the error (so it can be uniquely found in the text)
- "replacement" is the corrected version of that exact phrase
- "reason" explains the error concisely

Return ONLY a JSON array:
[{"original": "phrase from text", "replacement": "corrected phrase", "reason": "explanation"}]

If truly no corrections are needed, return: []

Do not add markdown, code fences, or any text outside the JSON array.`
}

// ─── LLM Response Parsing ──────────────────────────────────────────────────

export function parseLLMResponse(raw: string): Correction[] {
  try {
    // Strip markdown code fence if present
    const stripped = raw
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim()

    const parsed = JSON.parse(stripped)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (c): c is Correction =>
        typeof c === "object" &&
        c !== null &&
        typeof c.original === "string" &&
        c.original.trim().length > 0 &&
        typeof c.replacement === "string" &&
        typeof c.reason === "string" &&
        c.reason.trim().length > 0
    )
  } catch {
    return []
  }
}

// ─── Apply Corrections ─────────────────────────────────────────────────────

interface Span {
  start: number
  end: number
  replacement: string
}

export function applyCorrections(text: string, corrections: Correction[]): string {
  const spans: Span[] = []

  for (const c of corrections) {
    const start = text.indexOf(c.original)
    if (start === -1) continue
    spans.push({ start, end: start + c.original.length, replacement: c.replacement })
  }

  // Sort rightmost first
  spans.sort((a, b) => b.start - a.start)

  // Remove overlaps — keep the rightmost of each overlapping group
  const deduped: Span[] = []
  let prevStart = Infinity
  for (const span of spans) {
    if (span.end <= prevStart) {
      deduped.push(span)
      prevStart = span.start
    }
  }

  // Apply right-to-left
  let result = text
  for (const span of deduped) {
    result = result.slice(0, span.start) + span.replacement + result.slice(span.end)
  }

  return result
}
