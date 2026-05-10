// Plasmo content-script entry for the passive local highlighter.
// Tiny — does nothing unless passiveMode is ON in chrome.storage.sync.
// Dynamic-imports the heavy module only when needed (free lazy bundle).

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

let activated = false
let mod: typeof import("../passive/highlighter") | null = null

async function apply(enabled: boolean): Promise<void> {
  if (enabled && !activated) {
    mod = await import("../passive/highlighter")
    mod.activate()
    activated = true
  } else if (!enabled && activated) {
    mod?.deactivate()
    activated = false
  }
}

chrome.storage.sync.get(["passiveMode"]).then((s) => {
  apply(!!s.passiveMode).catch(() => {})
}).catch(() => {})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return
  if (!("passiveMode" in changes)) return
  apply(!!changes.passiveMode.newValue).catch(() => {})
})
