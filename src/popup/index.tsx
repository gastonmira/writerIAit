// popup/index.tsx — Settings panel, 360px fixed width
// React component, CSS custom properties for all design tokens

import { useEffect, useState } from "react"
import Insights from "./insights"
import { migrateLegacyReasons } from "../core/storage-schema"
import type { CheckMode, CorrectionView, LLMProvider, RewriteIntent } from "../types"

type PopupTab = "settings" | "insights"

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
    --error: #dc2626;
    --ins-bg: #dcfce7;
    --ins-text: #166534;
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
      --error: #f87171;
      --ins-bg: #052e16;
      --ins-text: #86efac;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }

  body {
    width: 360px;
    background: var(--bg);
  }

  #popup-root {
    display: flex;
    flex-direction: column;
    height: 580px;
    overflow: hidden;
  }

  #popup-scroll {
    overflow-y: auto;
    flex: 1;
  }

  label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input {
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

  select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
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

  .mode-strip {
    display: flex;
    gap: 4px;
  }
  .mode-btn {
    flex: 1;
    padding: 6px 4px;
    font-size: 12px;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .mode-btn.selected {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* ─── Onboarding ──────────────────────────────────────────────────────── */

  .onboarding-wrap {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .onboarding-progress {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
  }

  .progress-dot.active {
    background: var(--accent);
  }

  .onboarding-headline {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .onboarding-sub {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: -8px;
  }

  .provider-card {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .provider-card:hover {
    border-color: var(--accent);
    background: var(--surface);
  }

  .provider-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .provider-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .provider-model {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 1px;
  }

  .badge-free {
    padding: 2px 6px;
    background: var(--ins-bg);
    color: var(--ins-text);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .badge-paid {
    padding: 2px 6px;
    background: var(--surface);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 11px;
    flex-shrink: 0;
  }

  .skip-link {
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    text-align: right;
    align-self: flex-end;
    font-family: inherit;
  }

  .skip-link:hover { color: var(--text-secondary); }

  .provider-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 11px;
    color: var(--text-secondary);
  }

  .key-link {
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
    margin-top: -8px;
  }

  .key-link:hover { text-decoration: underline; }

  .key-error {
    font-size: 12px;
    color: var(--error);
    margin-top: 4px;
  }

  .btn-primary {
    padding: 0 14px;
    min-height: 36px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms ease;
    width: 100%;
  }

  .btn-primary:hover { background: var(--accent-hover); }

  .back-link {
    font-size: 12px;
    color: var(--muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .back-link:hover { color: var(--text-secondary); }

  .done-check {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--ins-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: var(--ins-text);
  }

  .shortcut-callout {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-callout-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .shortcut-badge {
    display: inline-flex;
    padding: 4px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  .shortcut-callout-helper {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .teaching-note {
    font-size: 12px;
    font-style: italic;
    color: var(--muted);
  }

  /* ─── Tab nav ─────────────────────────────────────────────────────────── */

  .tab-nav {
    display: flex;
    border-bottom: 1px solid var(--border);
  }

  .tab-btn {
    flex: 1;
    padding: 10px 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .tab-btn:hover {
    color: var(--text-primary);
  }

  .tab-btn.selected {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
`

// ─── Provider metadata ──────────────────────────────────────────────────────

const PROVIDER_META: Array<{
  id: LLMProvider
  name: string
  model: string
  free: boolean
  keyUrl: string
}> = [
  { id: "gemini",    name: "Google Gemini", model: "gemini-2.0-flash-lite", free: true,  keyUrl: "https://aistudio.google.com/apikey" },
  { id: "groq",      name: "Groq",          model: "llama-3.1-8b-instant",  free: true,  keyUrl: "https://console.groq.com/keys" },
  { id: "openai",    name: "OpenAI",        model: "gpt-4o-mini",           free: false, keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic",     model: "claude-haiku",          free: false, keyUrl: "https://console.anthropic.com/settings/keys" },
]

// ─── Keyboard shortcut detection ───────────────────────────────────────────

function getShortcutLabel(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘⇧K" : "Ctrl+Shift+K"
}

// ─── Popup component ───────────────────────────────────────────────────────

export default function Popup() {
  const [nativeLanguage, setNativeLanguage] = useState("Spanish")
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState<LLMProvider>("gemini")
  const [checkMode, setCheckMode] = useState<CheckMode>("correct")
  const [rewriteIntent, setRewriteIntent] = useState<RewriteIntent>("professional")
  const [correctionView, setCorrectionView] = useState<CorrectionView>("inline")
  const [showFloatingButton, setShowFloatingButton] = useState(true)
  const [passiveMode, setPassiveMode] = useState(false)
  const [saved, setSaved] = useState(false)

  // Onboarding state
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null)
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1)
  const [keyError, setKeyError] = useState("")

  // Tab nav (Settings | Insights)
  const [popupTab, setPopupTab] = useState<PopupTab>("settings")

  // Load saved settings + check onboarding flag
  useEffect(() => {
    // Idempotent — runs once per popup mount; overlay does the same on its side.
    migrateLegacyReasons().catch(() => {})

    chrome.storage.sync.get(["nativeLanguage", "provider", "checkMode", "rewriteIntent", "correctionView", "showFloatingButton", "passiveMode", "popupTab"]).then(res => {
      if (res.nativeLanguage) setNativeLanguage(res.nativeLanguage)
      if (res.provider) setProvider(res.provider as LLMProvider)
      if (res.checkMode) setCheckMode(res.checkMode as CheckMode)
      if (res.rewriteIntent) setRewriteIntent(res.rewriteIntent as RewriteIntent)
      if (res.correctionView) setCorrectionView(res.correctionView as CorrectionView)
      if (typeof res.showFloatingButton === "boolean") setShowFloatingButton(res.showFloatingButton)
      if (typeof res.passiveMode === "boolean") setPassiveMode(res.passiveMode)
      if (res.popupTab === "insights" || res.popupTab === "settings") setPopupTab(res.popupTab)
    })
    chrome.storage.local.get(["apiKey", "hasOnboarded"]).then(res => {
      if (res.apiKey) setApiKey(res.apiKey)
      setHasOnboarded(!!res.hasOnboarded)
      if (!res.hasOnboarded) setOnboardingStep(1)
    })
  }, [])

  function handleTabChange(tab: PopupTab) {
    setPopupTab(tab)
    chrome.storage.sync.set({ popupTab: tab })
  }

  // ── Settings handlers ──────────────────────────────────────────────────

  function handleModeChange(val: CheckMode) {
    setCheckMode(val)
    chrome.storage.sync.set({ checkMode: val })
  }
  function handleCorrectionViewChange(val: CorrectionView) {
    setCorrectionView(val)
    chrome.storage.sync.set({ correctionView: val })
  }
  function handleFloatingButtonChange(val: boolean) {
    setShowFloatingButton(val)
    chrome.storage.sync.set({ showFloatingButton: val })
  }
  function handlePassiveModeChange(val: boolean) {
    setPassiveMode(val)
    chrome.storage.sync.set({ passiveMode: val })
  }
  function handleRewriteIntentChange(val: RewriteIntent) {
    setRewriteIntent(val)
    chrome.storage.sync.set({ rewriteIntent: val })
  }

  function handleLanguageChange(val: string) {
    setNativeLanguage(val)
    chrome.storage.sync.set({ nativeLanguage: val })
  }

  function handleProviderChange(val: LLMProvider) {
    setProvider(val)
    chrome.storage.sync.set({ provider: val })
  }

  function handleApiKeySave() {
    chrome.storage.local.set({ apiKey }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  // ── Onboarding handlers ────────────────────────────────────────────────

  function handleProviderSelect(p: LLMProvider) {
    handleProviderChange(p)
    setOnboardingStep(2)
  }

  function handleApiKeyNext() {
    if (!apiKey.trim()) {
      setKeyError("Please paste your API key before continuing.")
      return
    }
    setKeyError("")
    chrome.storage.local.set({ apiKey })
    setOnboardingStep(3)
  }

  function handleFinish() {
    chrome.storage.local.set({ hasOnboarded: true })
    chrome.storage.sync.set({ checkMode: "correct", rewriteIntent: "professional" })
    setHasOnboarded(true)
  }

  function handleSkip() {
    chrome.storage.local.set({ hasOnboarded: true })
    setHasOnboarded(true)
  }

  const shortcut = getShortcutLabel()
  const providerMeta = PROVIDER_META.find(p => p.id === provider) ?? PROVIDER_META[0]

  // ── Render ─────────────────────────────────────────────────────────────

  // While loading — avoid flash
  if (hasOnboarded === null) {
    return <style dangerouslySetInnerHTML={{ __html: ROOT_STYLE }} />
  }

  // ── Shared header ──────────────────────────────────────────────────────

  const Header = (
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
      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>writerIAit</span>
      {hasOnboarded && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)" }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Active</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>v{chrome.runtime.getManifest().version}</span>
        </div>
      )}
    </div>
  )

  // ── Onboarding wizard ──────────────────────────────────────────────────

  if (!hasOnboarded) {
    return (
      <div id="popup-root">
        <style dangerouslySetInnerHTML={{ __html: ROOT_STYLE }} />
        {Header}
        <div className="divider" />

        <div className="onboarding-wrap" style={{ overflowY: "auto", flex: 1 }}>
          {/* Progress dots */}
          <div className="onboarding-progress">
            {[1, 2, 3].map(n => (
              <div key={n} className={`progress-dot${onboardingStep >= n ? " active" : ""}`} />
            ))}
          </div>

          {/* Step 1 — Choose provider */}
          {onboardingStep === 1 && (
            <>
              <div className="onboarding-headline">Choose your AI provider</div>
              <div className="onboarding-sub">Gemini and Groq are free — no credit card needed.</div>

              <div>
                <label htmlFor="native-language-ob">Your native language (optional)</label>
                <select
                  id="native-language-ob"
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

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PROVIDER_META.map(p => (
                  <button key={p.id} className="provider-card" onClick={() => handleProviderSelect(p.id)}>
                    <div>
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-model">{p.model}</div>
                    </div>
                    {p.free
                      ? <span className="badge-free">Free</span>
                      : <span className="badge-paid">Paid</span>
                    }
                  </button>
                ))}
              </div>

              <button className="skip-link" onClick={handleSkip}>
                Already set up? Skip →
              </button>
            </>
          )}

          {/* Step 2 — Add API key */}
          {onboardingStep === 2 && (
            <>
              <div className="onboarding-headline">Add your API key</div>
              <div className="onboarding-sub">Keys are stored locally and never leave your device.</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="provider-chip">{providerMeta.name}</span>
                <a
                  className="key-link"
                  href={providerMeta.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get your {providerMeta.name} key →
                </a>
              </div>

              <div>
                <label htmlFor="api-key-ob">API key</label>
                <input
                  id="api-key-ob"
                  type="password"
                  placeholder={getApiKeyPlaceholder(provider)}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setKeyError("") }}
                  onKeyDown={e => { if (e.key === "Enter") handleApiKeyNext() }}
                  autoFocus
                />
                {keyError && <div className="key-error">{keyError}</div>}
              </div>

              <button className="btn-primary" onClick={handleApiKeyNext}>
                Save &amp; Continue →
              </button>
              <button className="back-link" onClick={() => setOnboardingStep(1)}>
                ← Back
              </button>
            </>
          )}

          {/* Step 3 — Done */}
          {onboardingStep === 3 && (
            <>
              <div className="done-check">✓</div>
              <div className="onboarding-headline">You're all set.</div>
              <div className="onboarding-sub">writerIAit is active on all pages.</div>

              <div className="shortcut-callout">
                <div className="shortcut-callout-label">Keyboard shortcut</div>
                <span className="shortcut-badge">{shortcut}</span>
                <div className="shortcut-callout-helper">
                  Focus any text field and press this shortcut to check your English.
                </div>
              </div>

              {!passiveMode && (
                <div className="shortcut-callout" style={{ borderColor: "var(--accent)" }}>
                  <div className="shortcut-callout-label">Optional</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                    Highlight typos as you type
                  </div>
                  <div className="shortcut-callout-helper">
                    100% local · no LLM call · no token cost.
                  </div>
                  <button
                    className="btn-primary"
                    style={{ marginTop: 4 }}
                    onClick={() => handlePassiveModeChange(true)}
                  >
                    Enable passive mode
                  </button>
                </div>
              )}

              <div className="teaching-note">
                Teaching Mode is always on — every correction includes an explanation of why.
              </div>

              <button className="btn-primary" onClick={handleFinish}>
                Start Writing →
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Normal settings view ───────────────────────────────────────────────

  return (
    <div id="popup-root">
      <style dangerouslySetInnerHTML={{ __html: ROOT_STYLE }} />

      {Header}

      <div className="tab-nav">
        <button
          className={`tab-btn${popupTab === "settings" ? " selected" : ""}`}
          onClick={() => handleTabChange("settings")}
        >
          Settings
        </button>
        <button
          className={`tab-btn${popupTab === "insights" ? " selected" : ""}`}
          onClick={() => handleTabChange("insights")}
        >
          Insights
        </button>
      </div>

      <div id="popup-scroll">

      {popupTab === "insights" ? <Insights /> : (
      <>

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

        <div>
          <label>Check Mode</label>
          <div className="mode-strip">
            {([ ["correct", "Correct"], ["improve", "Improve"], ["rewrite", "Rewrite"] ] as const).map(([m, label]) => (
              <button
                key={m}
                className={`mode-btn${checkMode === m ? " selected" : ""}`}
                onClick={() => handleModeChange(m)}
              >
                {label}
              </button>
            ))}
          </div>
          {checkMode === "rewrite" && (
            <select
              id="rewrite-intent"
              aria-label="rewrite-intent"
              value={rewriteIntent}
              onChange={e => handleRewriteIntentChange(e.target.value as RewriteIntent)}
              style={{ marginTop: 6 }}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          )}
        </div>

        <div>
          <label>Correction View</label>
          <div className="mode-strip">
            {([
              ["inline",    "Inline"],
              ["explained", "Explained"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                className={`mode-btn${correctionView === v ? " selected" : ""}`}
                onClick={() => handleCorrectionViewChange(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
            {correctionView === "inline"
              ? "Diffs shown directly in the text field. Click to accept or skip each one."
              : "One correction at a time with explanation. Navigate with arrow keys."}
          </div>
        </div>

        <div>
          <label>Floating button</label>
          <div className="mode-strip">
            {([ [true, "On"], [false, "Off"] ] as const).map(([v, label]) => (
              <button
                key={String(v)}
                className={`mode-btn${showFloatingButton === v ? " selected" : ""}`}
                onClick={() => handleFloatingButtonChange(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
            Shows a small W button next to the focused text field. The keyboard shortcut still works either way.
          </div>
        </div>

        <div>
          <label>Highlight typos as I type</label>
          <div className="mode-strip">
            {([ [true, "On"], [false, "Off"] ] as const).map(([v, label]) => (
              <button
                key={String(v)}
                className={`mode-btn${passiveMode === v ? " selected" : ""}`}
                onClick={() => handlePassiveModeChange(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
            Underlines misspelled words in any text field as you type. 100% local — no LLM call, no token cost.
          </div>
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

      {/* Utility */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label>Shortcut</label>
          <div style={{
            display: "inline-flex",
            padding: "4px 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
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
      )}

      </div>{/* end #popup-scroll */}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getApiKeyPlaceholder(provider: LLMProvider): string {
  if (provider === "openai") return "sk-…"
  if (provider === "anthropic") return "sk-ant-…"
  if (provider === "gemini") return "AIza…"
  return "gsk_…" // Groq
}

