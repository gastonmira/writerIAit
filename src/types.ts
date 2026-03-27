export type LLMProvider = "openai" | "anthropic" | "gemini" | "groq"
export type CheckMode = "correct" | "improve" | "rewrite"
export type RewriteIntent = "professional" | "friendly" | "concise"

export interface Correction {
  original: string
  replacement: string
  reason: string
}

export interface CheckTextMessage {
  type: "CHECK_TEXT"
  text: string
  nativeLanguage: string
  tone: string
  apiKey: string
  provider: LLMProvider
  mode?: CheckMode
  rewriteIntent?: RewriteIntent
}

export type CheckTextResponse =
  | { corrections: Correction[] }
  | { error: string }
