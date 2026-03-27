// corrector.ts — pure correction logic
// NO chrome.* imports — this module must stay portable (v3 native app)

import type { CheckMode, Correction, RewriteIntent } from "../types"

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

export function buildSystemPrompt(
  nativeLanguage: string,
  tone: string,
  mode: CheckMode = "correct",
  rewriteIntent: RewriteIntent = "professional"
): string {
  const languagePhrase = LANGUAGE_PHRASES[nativeLanguage]

  const languageInstruction = languagePhrase
    ? `The writer is a native ${nativeLanguage} speaker. Pay special attention to ${languagePhrase}.`
    : "Pay attention to common grammar and phrasing errors."

  if (mode === "correct") return buildCorrectPrompt(languageInstruction, tone)
  if (mode === "improve") return buildImprovePrompt(languageInstruction, tone)
  return buildRewritePrompt(languageInstruction, tone, rewriteIntent)
}

function buildCorrectPrompt(languageInstruction: string, tone: string): string {
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

function buildImprovePrompt(languageInstruction: string, tone: string): string {
  return `You are a fluency editor helping non-native speakers sound more natural in English.

${languageInstruction}

The text should read as ${tone}.

Do NOT fix grammar errors that don't exist. Identify phrases that are grammatically correct but sound unnatural, overly literal, or awkward to a native speaker — and suggest more fluent, idiomatic alternatives. Preserve the original meaning exactly.

Rules for your JSON output:
- "original" should be 2–5 words of surrounding context (so it can be uniquely found in the text)
- "replacement" is the improved version of that exact phrase, keeping meaning intact
- "reason" briefly explains why the original sounds unnatural and why the replacement is more idiomatic

Return ONLY a JSON array:
[{"original": "phrase from text", "replacement": "improved phrase", "reason": "explanation"}]

If the text already reads naturally, return: []

Do not add markdown, code fences, or any text outside the JSON array.`
}

const REWRITE_INTENT_INSTRUCTIONS: Record<RewriteIntent, string> = {
  professional: "Transform the text to sound confident, formal, and polished — suitable for a work email or business report.",
  friendly: "Transform the text to sound warm, approachable, and conversational — suitable for a Slack message or informal colleague note.",
  concise: "Transform the text to be as concise as possible — cut every word that does not add meaning. Keep all key information.",
}

function buildRewritePrompt(languageInstruction: string, tone: string, rewriteIntent: RewriteIntent): string {
  const intentInstruction = REWRITE_INTENT_INSTRUCTIONS[rewriteIntent]
  return `You are a writing assistant that rewrites English text to match a specific tone.

${languageInstruction}

${intentInstruction}

Important constraints:
- Preserve the original meaning. Do not add new information or omit key facts.
- "original" must be a verbatim substring of the input (minimum 4 words) so it can be located by exact string match.
- "replacement" is the rewritten version of that exact segment.
- "reason" explains the specific change in tone or phrasing.

Return ONLY a JSON array:
[{"original": "verbatim substring", "replacement": "rewritten version", "reason": "explanation"}]

If no change is needed to achieve the target tone, return: []

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

// ─── Build Diff HTML ───────────────────────────────────────────────────────
// Produces an HTML string with <del class="writeai-del"> / <ins class="writeai-ins"> spans.
// Keeps the LEFTMOST of any overlapping corrections for display.
// Note: applyCorrections() keeps the RIGHTMOST — in the rare overlap case the
// accepted text may differ slightly from what was shown. This is an edge case.

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildDiffHtml(text: string, corrections: Correction[]): string {
  interface DisplaySpan {
    start: number
    end: number
    original: string
    replacement: string
  }

  const spans: DisplaySpan[] = []
  for (const c of corrections) {
    const start = text.indexOf(c.original)
    if (start === -1) continue
    spans.push({ start, end: start + c.original.length, original: c.original, replacement: c.replacement })
  }

  // Sort left-to-right, keep leftmost on overlap
  spans.sort((a, b) => a.start - b.start)
  const deduped: DisplaySpan[] = []
  let prevEnd = 0
  for (const span of spans) {
    if (span.start >= prevEnd) {
      deduped.push(span)
      prevEnd = span.end
    }
  }

  let html = ""
  let cursor = 0
  for (let i = 0; i < deduped.length; i++) {
    const span = deduped[i]
    html += htmlEscape(text.slice(cursor, span.start))
    html += `<del class="writeai-del" data-idx="${i}">${htmlEscape(span.original)}</del>`
    html += `<ins class="writeai-ins" data-idx="${i}">${htmlEscape(span.replacement)}</ins>`
    cursor = span.end
  }
  html += htmlEscape(text.slice(cursor))
  return html
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
