// manifest.test.ts — guardrails for the extension's declared permissions.
//
// Chrome Web Store rejected v0.3.1 with "Purple Potassium" because the manifest
// declared the `scripting` permission while no code path used it. These tests
// prevent the regression and lock in the minimum permission set we actually need.

import { describe, it, expect } from "vitest"
import pkg from "../package.json"

describe("extension manifest permissions", () => {
  const permissions: string[] = pkg.manifest.permissions

  it("does NOT declare the scripting permission (CWS Purple Potassium)", () => {
    expect(permissions).not.toContain("scripting")
  })

  it("declares storage (used for settings, API key, stats)", () => {
    expect(permissions).toContain("storage")
  })

  it("declares activeTab (used to relay the keyboard command to the content script)", () => {
    expect(permissions).toContain("activeTab")
  })

  it("declares no permissions beyond the minimum required set", () => {
    const allowed = new Set(["storage", "activeTab"])
    for (const p of permissions) {
      expect(allowed.has(p)).toBe(true)
    }
  })
})

// ─── Passive highlighter manifest contract (AC12 + WAR) ────────────────────

describe("extension manifest — passive highlighter contract", () => {
  const manifest = pkg.manifest as Record<string, unknown>

  it("does NOT declare content_security_policy (AC12)", () => {
    // Passive mode uses nspell — pure JS, no WASM. Adding a CSP key would
    // either be a no-op or invite future regressions. The spec is explicit:
    // built manifest must contain no content_security_policy key.
    expect(manifest.content_security_policy).toBeUndefined()
  })

  it("declares web_accessible_resources for the bundled dictionaries", () => {
    const war = manifest.web_accessible_resources as Array<{
      resources: string[]
      matches: string[]
    }>
    expect(Array.isArray(war)).toBe(true)
    const dictEntry = war.find((e) => e.resources?.includes("dictionaries/*"))
    expect(dictEntry).toBeDefined()
    expect(dictEntry?.matches).toContain("<all_urls>")
  })
})
