export type LLMProvider = "openai" | "anthropic" | "gemini" | "groq"

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
}

export type CheckTextResponse =
  | { corrections: Correction[] }
  | { error: string }
