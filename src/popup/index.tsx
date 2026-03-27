// popup/index.tsx — Settings panel, 360px fixed width
// React component, CSS custom properties for all design tokens

import { useEffect, useState } from "react"
import type { LLMProvider } from "../types"

// ─── Design tokens ─────────────────────────────────────────────────────────

const ROOT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #ffffff;
    --surface: #f8fafc;
    --border: #e2e8f0;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --muted: #94a3b8;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --success: #16a34a;
    --radius-sm: 4px;
    --radius-md: 8px;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--bg);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1e293b;
      --surface: #0f172a;
      --border: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --success: #4ade80;
    }
  }

  body { width: 360px; min-height: 400px; background: var(--bg); }

  label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  select, input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
    appearance: none;
  }

  select:focus, input:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 0;
  }
`

// ─── Keyboard shortcut detection ───────────────────────────────────────────

function getShortcutLabel(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘⇧K" : "Ctrl+Shift+K"
}

// ─── Popup component ───────────────────────────────────────────────────────

type WeekStats = { count: number; topFix: string | null }

export default function Popup() {
  const [nativeLanguage, setNativeLanguage] = useState("Spanish")
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState<LLMProvider>("openai")
  const [stats, setStats] = useState<WeekStats>({ count: 0, topFix: null })
  const [saved, setSaved] = useState(false)

  // Load saved settings
  useEffect(() => {
    chrome.storage.sync.get(["nativeLanguage", "provider"]).then(res => {
      if (res.nativeLanguage) setNativeLanguage(res.nativeLanguage)
      if (res.provider) setProvider(res.provider as LLMProvider)
    })
    chrome.storage.local.get(["apiKey", "correctionsThisWeek", "weekStart", "reasons"]).then(res => {
      if (res.apiKey) setApiKey(res.apiKey)
      const count = res.correctionsThisWeek ?? 0
      const reasons: string[] = res.reasons ?? []
      const topFix = getTopFix(reasons)
      setStats({ count, topFix })
    })
  }, [])

  // Save language + provider to sync storage
  function handleLanguageChange(val: string) {
    setNativeLanguage(val)
    chrome.storage.sync.set({ nativeLanguage: val })
  }

  function handleProviderChange(val: LLMProvider) {
    setProvider(val)
    chrome.storage.sync.set({ provider: val })
  }

  // Save API key to local storage (not sync — don't sync keys across devices)
  function handleApiKeySave() {
    chrome.storage.local.set({ apiKey }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const shortcut = getShortcutLabel()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ROOT_STYLE }} />

      {/* Header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28,
          background: "var(--accent)",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0
        }}>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1 }}>W</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>WriteAI</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)" }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Active</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>v{chrome.runtime.getManifest().version}</span>
        </div>
      </div>

      <div className="divider" />

      {/* Preferences */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="native-language">Native language</label>
          <select
            id="native-language"
            value={nativeLanguage}
            onChange={e => handleLanguageChange(e.target.value)}
          >
            <option value="Spanish">Spanish</option>
            <option value="Portuguese">Portuguese</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Arabic">Arabic</option>
            <option value="Chinese">Chinese</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
            Teaching Mode
          </span>
          <div style={{
            padding: "2px 8px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 11,
            color: "var(--muted)"
          }}>
            Always on
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* This Week stats */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px"
          }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>
              {stats.count}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              Corrections this week
            </div>
          </div>

          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px"
          }}>
            {stats.topFix ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word" }}>
                  {stats.topFix}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  Top fix
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                No corrections yet this week.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* Utility */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label>Shortcut</label>
          <div style={{
            display: "inline-flex",
            padding: "4px 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "0.02em"
          }}>
            {shortcut}
          </div>
        </div>

        <div>
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            value={provider}
            onChange={e => handleProviderChange(e.target.value as LLMProvider)}
          >
            <option value="openai">OpenAI (gpt-4o-mini) — paid</option>
            <option value="anthropic">Anthropic (claude-haiku) — paid</option>
            <option value="gemini">Google Gemini (flash-lite) — free</option>
            <option value="groq">Groq (llama-3.1-8b) — free</option>
          </select>
        </div>

        <div>
          <label htmlFor="api-key">API key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="api-key"
              type="password"
              placeholder={getApiKeyPlaceholder(provider)}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleApiKeySave() }}
              style={{ flex: 1 }}
            />
            <button
              onClick={handleApiKeySave}
              style={{
                padding: "0 14px",
                minHeight: 36,
                background: saved ? "var(--success)" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 150ms ease"
              }}
            >
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Top fix calculation ───────────────────────────────────────────────────

function getApiKeyPlaceholder(provider: LLMProvider): string {
  if (provider === "openai") return "sk-…"
  if (provider === "anthropic") return "sk-ant-…"
  if (provider === "gemini") return "AIza…"
  return "gsk_…" // Groq
}

function getTopFix(reasons: string[]): string | null {
  if (!reasons.length) return null
  // Extract first 3 words from each reason as a category key
  const counts = new Map<string, number>()
  for (const r of reasons) {
    const key = r.split(/\s+/).slice(0, 3).join(" ")
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let top = ""
  let max = 0
  for (const [key, count] of counts) {
    if (count > max) { max = count; top = key }
  }
  return top || null
}
