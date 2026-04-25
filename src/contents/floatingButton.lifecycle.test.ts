// floatingButton.lifecycle.test.ts — DOM behavior tests for the floating button.
//
// These tests share a single import of `overlay.ts` (which registers global
// focusin/focusout/scroll listeners on import). Each test cleans up the body
// and any leftover host between runs.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Side-effect import; chrome mocks live in src/test-setup.ts.
import "./overlay"

const HOST_ID = "writeai-floating-btn-host"

function defineRect(el: HTMLElement, width = 200, height = 30, left = 100, top = 200) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width, height, top, left,
      right: left + width, bottom: top + height,
      x: left, y: top, toJSON: () => ({})
    }),
  })
}

function focusinOn(el: HTMLElement) {
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
}

function focusoutOn(el: HTMLElement) {
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
}

function getHost(): HTMLElement | null {
  return document.getElementById(HOST_ID)
}

function getButton(): HTMLButtonElement | null {
  const host = getHost()
  return host?.shadowRoot?.querySelector("button") ?? null
}

beforeEach(() => {
  document.body.innerHTML = ""
  document.head.querySelectorAll("#writeai-floating-btn-style").forEach(el => el.remove())
})

afterEach(() => {
  vi.useRealTimers()
})

describe("floating button lifecycle", () => {
  it("appears when a text field receives focus", async () => {
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    defineRect(ta)

    focusinOn(ta)

    expect(getHost()).not.toBeNull()
    const btn = getButton()
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute("aria-label")).toMatch(/writerIAit/i)
  })

  it("does not appear for non-text elements", () => {
    const div = document.createElement("div")
    document.body.appendChild(div)

    focusinOn(div)

    expect(getHost()).toBeNull()
  })

  it("does not duplicate when focus moves between two text fields", () => {
    const ta1 = document.createElement("textarea")
    const ta2 = document.createElement("textarea")
    document.body.appendChild(ta1)
    document.body.appendChild(ta2)
    defineRect(ta1)
    defineRect(ta2, 200, 30, 400, 200)

    focusinOn(ta1)
    focusinOn(ta2)

    expect(document.querySelectorAll(`#${HOST_ID}`).length).toBe(1)
  })

  it("inserts a position style with computed top/left into <head>", () => {
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    defineRect(ta, 200, 30, 100, 200)

    focusinOn(ta)

    const styleEl = document.head.querySelector("#writeai-floating-btn-style")
    expect(styleEl).not.toBeNull()
    const text = styleEl?.textContent ?? ""
    // 100 + 200 - 28 - 6 = 266; 200 + 30 - 28 - 6 = 196
    expect(text).toMatch(/left:\s*266px/)
    expect(text).toMatch(/top:\s*196px/)
  })

  it("hides after focusout once the grace period elapses", () => {
    vi.useFakeTimers()
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    defineRect(ta)

    focusinOn(ta)
    expect(getHost()).not.toBeNull()

    focusoutOn(ta)
    vi.advanceTimersByTime(100)
    expect(getHost()).not.toBeNull() // still inside grace period

    vi.advanceTimersByTime(100)
    expect(getHost()).toBeNull() // grace period expired
  })

  it("mousedown on the button cancels the pending hide timer", () => {
    vi.useFakeTimers()
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    defineRect(ta)

    focusinOn(ta)
    focusoutOn(ta)

    const btn = getButton()
    expect(btn).not.toBeNull()
    btn?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }))

    vi.advanceTimersByTime(500)
    expect(getHost()).not.toBeNull()
  })

  it("click on the button forwards a CHECK_TEXT request to the background", async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>
    sendMessageMock.mockClear()

    // Pre-load the apiKey so handleTrigger reaches sendMessage.
    await chrome.storage.local.set({ apiKey: "sk-test" })

    // jsdom's Range does not implement getBoundingClientRect — return a
    // "no selection" stub so getOrCreateHost takes its non-selection path.
    const getSelectionSpy = vi.spyOn(document, "getSelection").mockReturnValue({
      rangeCount: 0,
      getRangeAt: () => { throw new Error("no range") },
    } as unknown as Selection)

    try {
      const ta = document.createElement("textarea")
      ta.value = "Helo wrold"
      document.body.appendChild(ta)
      defineRect(ta)
      ta.focus()
      focusinOn(ta)

      const btn = getButton()
      expect(btn).not.toBeNull()
      btn?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }))
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))

      await vi.waitFor(() => {
        const checkTextCall = sendMessageMock.mock.calls.find(
          (call) => (call[0] as { type?: string })?.type === "CHECK_TEXT"
        )
        expect(checkTextCall).toBeDefined()
        expect((checkTextCall?.[0] as { text: string }).text).toBe("Helo wrold")
      })
    } finally {
      getSelectionSpy.mockRestore()
    }
  })

  it("does not show when the field is too small (honeypot guard)", () => {
    const tiny = document.createElement("textarea")
    document.body.appendChild(tiny)
    defineRect(tiny, 10, 5)

    focusinOn(tiny)

    expect(getHost()).toBeNull()
  })
})
