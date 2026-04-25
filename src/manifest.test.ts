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
