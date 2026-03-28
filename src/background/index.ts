// background/index.ts — MV3 service worker
// Handles: keyboard command relay, LLM fetch (OpenAI + Anthropic), cancellation

import { buildSystemPrompt, parseLLMResponse } from "../core/corrector"
import type { CheckTextMessage, CheckTextResponse, LLMProvider } from "../types"

// ─── AbortController registry ─────────────────────────────────────────────

const abortControllers = new Map<number, AbortController>()

// ─── Icon helpers ──────────────────────────────────────────────────────────

const ICON_ACTIVE = { "16": "icon16-active.png", "32": "icon32-active.png", "48": "icon48-active.png", "128": "icon128-active.png" }
const ICON_INACTIVE = { "16": "icon16.png", "32": "icon32.png", "48": "icon48.png", "128": "icon128.png" }

function setTabIcon(tabId: number, active: boolean) {
  if (tabId < 0) return
  chrome.action.setIcon({ tabId, path: active ? ICON_ACTIVE : ICON_INACTIVE }).catch(() => {})
}

// ─── Command relay ─────────────────────────────────────────────────────────
// MV3: commands fire in service worker, must relay to content script

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fix-english") return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  // Silent on chrome:// / edge:// pages where scripting is blocked
  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_FIX" }).catch(() => {})
})

// ─── Message listener ──────────────────────────────────────────────────────
// IMPORTANT: must return true synchronously to keep the async channel open.
// An async function does NOT satisfy this — use the callback + Promise pattern.

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message.type === "CANCEL_CHECK") {
      const tabId = sender.tab?.id
      if (tabId !== undefined) {
        abortControllers.get(tabId)?.abort()
        abortControllers.delete(tabId)
      }
      sendResponse({})
      return false
    }

    if (message.type === "CHECK_TEXT") {
      const tabId = sender.tab?.id ?? -1
      handleCheckText(message as CheckTextMessage, tabId)
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Unexpected error." }))
      return true // keep channel open for async sendResponse
    }

    return false
  }
)

// ─── LLM fetch ─────────────────────────────────────────────────────────────

async function handleCheckText(
  msg: CheckTextMessage,
  tabId: number
): Promise<CheckTextResponse> {
  const { text, nativeLanguage, tone, apiKey, provider, mode = "correct", rewriteIntent = "professional" } = msg

  const controller = new AbortController()
  abortControllers.set(tabId, controller)
  setTabIcon(tabId, true)

  try {
    const systemPrompt = buildSystemPrompt(nativeLanguage, tone, mode, rewriteIntent)
    const raw = await fetchLLM(provider, apiKey, systemPrompt, text, controller.signal)
    console.log("[WriteAI] text sent:", text)
    console.log("[WriteAI] raw response:", raw)
    const corrections = parseLLMResponse(raw)
    console.log("[WriteAI] parsed corrections:", corrections)
    return { corrections }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "cancelled" }
    }
    if (err instanceof TypeError) {
      // fetch() network failure
      return { error: "No internet connection." }
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[WriteAI] API error:", msg)
    return { error: `API request failed: ${msg}` }
  } finally {
    abortControllers.delete(tabId)
    setTabIcon(tabId, false)
  }
}

// ─── Provider dispatch ─────────────────────────────────────────────────────

async function fetchLLM(
  provider: LLMProvider,
  apiKey: string,
  systemPrompt: string,
  userText: string,
  signal: AbortSignal
): Promise<string> {
  if (provider === "openai") return fetchOpenAI(apiKey, systemPrompt, userText, signal)
  if (provider === "anthropic") return fetchAnthropic(apiKey, systemPrompt, userText, signal)
  if (provider === "gemini") return fetchGemini(apiKey, systemPrompt, userText, signal)
  if (provider === "groq") return fetchGroq(apiKey, systemPrompt, userText, signal)
  throw new Error(`Unknown provider: ${provider}`)
}

async function fetchOpenAI(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  })

  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content as string
}

async function fetchAnthropic(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: "user", content: userText }
      ]
    })
  })

  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  return data.content[0].text as string
}

async function fetchGemini(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  signal: AbortSignal
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }]
    })
  })

  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  return data.candidates[0].content.parts[0].text as string
}

async function fetchGroq(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  })

  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content as string
}
