// floatingButton.test.ts — pure-function tests for the floating-button helpers
// Imports overlay.ts which registers global listeners; the chrome mock in
// src/test-setup.ts covers chrome.storage / chrome.runtime so the import is
// side-effect-safe under jsdom.

import { describe, it, expect } from "vitest"
import { computeFloatingBtnPosition, evaluateFloatingBtnGuard } from "./overlay"

const VIEWPORT = { innerWidth: 1024, innerHeight: 768, scrollX: 0, scrollY: 0 }

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

describe("computeFloatingBtnPosition", () => {
  it("places the button at the bottom-right of the field, padded inward", () => {
    const pos = computeFloatingBtnPosition(rect(100, 200, 200, 30), null, VIEWPORT)
    // size=28, padding=6
    expect(pos.left).toBe(100 + 200 - 28 - 6)
    expect(pos.top).toBe(200 + 30 - 28 - 6)
  })

  it("adds the iframe offset when the field lives in an iframe", () => {
    const pos = computeFloatingBtnPosition(rect(50, 50, 200, 30), { top: 120, left: 80 }, VIEWPORT)
    expect(pos.left).toBe(80 + 50 + 200 - 28 - 6)
    expect(pos.top).toBe(120 + 50 + 30 - 28 - 6)
  })

  it("adds page scroll offsets to the absolute position", () => {
    const pos = computeFloatingBtnPosition(
      rect(100, 200, 200, 30),
      null,
      { ...VIEWPORT, scrollX: 50, scrollY: 400 }
    )
    expect(pos.left).toBe(50 + 100 + 200 - 28 - 6)
    expect(pos.top).toBe(400 + 200 + 30 - 28 - 6)
  })

  it("clamps against the right edge of the viewport with a 16px margin", () => {
    // Field that would push the button past the right edge.
    const pos = computeFloatingBtnPosition(
      rect(900, 200, 200, 30), // right = 1100, viewport width = 1024
      null,
      VIEWPORT
    )
    expect(pos.left).toBe(1024 - 28 - 16)
  })

  it("clamps against the bottom edge of the viewport with a 16px margin", () => {
    const pos = computeFloatingBtnPosition(
      rect(100, 700, 200, 100), // bottom = 800, viewport height = 768
      null,
      VIEWPORT
    )
    expect(pos.top).toBe(768 - 28 - 16)
  })

  it("clamps against the left edge if the field is partially off-screen", () => {
    const pos = computeFloatingBtnPosition(
      rect(-200, 100, 50, 30), // right = -150, far off-screen left
      null,
      VIEWPORT
    )
    expect(pos.left).toBe(16) // min margin
  })

  it("clamps against the top edge if the field is above the viewport", () => {
    const pos = computeFloatingBtnPosition(
      rect(100, -200, 200, 30), // bottom = -170
      null,
      VIEWPORT
    )
    expect(pos.top).toBe(16)
  })
})

describe("evaluateFloatingBtnGuard", () => {
  function makeTextarea(width = 200, height = 30) {
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    Object.defineProperty(ta, "getBoundingClientRect", {
      value: () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }),
    })
    return ta
  }

  const baseState = { enabled: true, overlayPresent: false, lockedElement: null }

  it("returns true for a normal-sized textarea in a clean state", () => {
    const ta = makeTextarea()
    expect(evaluateFloatingBtnGuard(ta, baseState)).toBe(true)
  })

  it("returns false when the floating button feature is disabled", () => {
    const ta = makeTextarea()
    expect(evaluateFloatingBtnGuard(ta, { ...baseState, enabled: false })).toBe(false)
  })

  it("returns false while the correction overlay is mounted", () => {
    const ta = makeTextarea()
    expect(evaluateFloatingBtnGuard(ta, { ...baseState, overlayPresent: true })).toBe(false)
  })

  it("returns false when the element is currently locked for an in-flight check", () => {
    const ta = makeTextarea()
    expect(evaluateFloatingBtnGuard(ta, { ...baseState, lockedElement: ta })).toBe(false)
  })

  it("returns false for a non-text element", () => {
    const div = document.createElement("div")
    document.body.appendChild(div)
    expect(evaluateFloatingBtnGuard(div, baseState)).toBe(false)
  })

  it("returns false for a contenteditable=false element", () => {
    const div = document.createElement("div")
    div.contentEditable = "false"
    document.body.appendChild(div)
    expect(evaluateFloatingBtnGuard(div, baseState)).toBe(false)
  })

  it("returns true for a contenteditable element", () => {
    const div = document.createElement("div")
    div.contentEditable = "true"
    document.body.appendChild(div)
    Object.defineProperty(div, "getBoundingClientRect", {
      value: () => ({ width: 200, height: 30, top: 0, left: 0, right: 200, bottom: 30, x: 0, y: 0, toJSON: () => ({}) }),
    })
    Object.defineProperty(div, "isContentEditable", { value: true })
    expect(evaluateFloatingBtnGuard(div, baseState)).toBe(true)
  })

  it("returns false for a tiny field (likely a hidden honeypot)", () => {
    const ta = makeTextarea(20, 10)
    expect(evaluateFloatingBtnGuard(ta, baseState)).toBe(false)
  })

  it("returns false for a null element", () => {
    expect(evaluateFloatingBtnGuard(null, baseState)).toBe(false)
  })

  it("returns false for an INPUT of type=password (not a text input)", () => {
    const input = document.createElement("input")
    input.type = "password"
    document.body.appendChild(input)
    Object.defineProperty(input, "getBoundingClientRect", {
      value: () => ({ width: 200, height: 30, top: 0, left: 0, right: 200, bottom: 30, x: 0, y: 0, toJSON: () => ({}) }),
    })
    expect(evaluateFloatingBtnGuard(input, baseState)).toBe(false)
  })
})
