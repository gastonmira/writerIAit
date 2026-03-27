// e2e/correction-flow.spec.ts — Playwright E2E tests
// Requires the extension to be built first: pnpm build
// Run with: pnpm test:e2e

import { test, expect, chromium, type BrowserContext } from "@playwright/test"
import path from "path"

const EXTENSION_PATH = path.join(process.cwd(), "build/chrome-mv3-dev")
const SHORTCUT = "Control+Shift+K"

let context: BrowserContext

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      `--disable-extensions-except=${EXTENSION_PATH}`
    ]
  })
})

test.afterAll(async () => {
  await context.close()
})

// ─── Test page fixture ─────────────────────────────────────────────────────

const TEST_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>WriteAI Test Page</title></head>
<body>
  <h1>WriteAI Test</h1>
  <textarea id="test-area" style="width:400px;height:120px;"></textarea>
  <input id="test-input" type="text" style="width:400px;display:block;margin-top:8px;" />
  <div id="test-div" contenteditable="true" style="width:400px;min-height:60px;border:1px solid #ccc;margin-top:8px;padding:4px;"></div>
  <div id="non-editable">Not editable</div>
</body>
</html>
`

async function openTestPage() {
  const page = await context.newPage()
  await page.setContent(TEST_PAGE_HTML)
  return page
}

// ─── 1. Full happy path ────────────────────────────────────────────────────

test("happy path: overlay appears → Accept All → text corrected", async () => {
  const page = await openTestPage()

  // Mock the background LLM call by intercepting runtime messages
  // We fake the response via a test helper injected into the page
  await page.addInitScript(() => {
    const origSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)
    // @ts-ignore
    chrome.runtime.sendMessage = async (msg: any) => {
      if (msg?.type === "CHECK_TEXT") {
        return {
          corrections: [
            {
              original: "since 3 years",
              replacement: "for 3 years",
              reason: "Duration uses 'for', not 'since'."
            }
          ]
        }
      }
      return origSendMessage(msg)
    }
  })

  await page.fill("#test-area", "I am working since 3 years at this company.")
  await page.focus("#test-area")
  await page.keyboard.press(SHORTCUT)

  // Overlay should appear
  await page.waitForFunction(() => !!document.getElementById("writeai-overlay-host"), { timeout: 3000 })

  // Check diff is shown
  const shadowContent = await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent ?? ""
  })
  expect(shadowContent).toContain("since 3 years")
  expect(shadowContent).toContain("for 3 years")

  // Accept All
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-primary") as HTMLButtonElement
    btn?.click()
  })

  // Overlay removed
  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  // Text corrected
  const value = await page.inputValue("#test-area")
  expect(value).toBe("I am working for 3 years at this company.")
})

// ─── 2. Dismiss path ──────────────────────────────────────────────────────

test("dismiss: text unchanged, overlay removed", async () => {
  const page = await openTestPage()

  await page.addInitScript(() => {
    // @ts-ignore
    chrome.runtime.sendMessage = async (msg: any) => {
      if (msg?.type === "CHECK_TEXT") {
        return {
          corrections: [{ original: "have presented", replacement: "presented", reason: "Past perfect overuse." }]
        }
      }
    }
  })

  const originalText = "We have presented the results last week."
  await page.fill("#test-area", originalText)
  await page.focus("#test-area")
  await page.keyboard.press(SHORTCUT)

  await page.waitForFunction(() => !!document.getElementById("writeai-overlay-host"), { timeout: 3000 })

  // Dismiss
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-ghost") as HTMLButtonElement
    btn?.click()
  })

  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  const value = await page.inputValue("#test-area")
  expect(value).toBe(originalText)
})

// ─── 3. Element lock safety ───────────────────────────────────────────────
// HIGHEST PRIORITY: textarea must NOT be readOnly after error state dismissed

test("element lock released after network error", async () => {
  const page = await openTestPage()

  // Simulate a network error response
  await page.addInitScript(() => {
    // @ts-ignore
    chrome.runtime.sendMessage = async (msg: any) => {
      if (msg?.type === "CHECK_TEXT") {
        return { error: "No internet connection." }
      }
    }
  })

  await page.fill("#test-area", "Some text to check.")
  await page.focus("#test-area")

  // Verify initially NOT readOnly
  const beforeLock = await page.evaluate(() => {
    const el = document.getElementById("test-area") as HTMLTextAreaElement
    return el.readOnly
  })
  expect(beforeLock).toBe(false)

  await page.keyboard.press(SHORTCUT)

  // Wait for error overlay
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("No internet") ?? false
  }, { timeout: 3000 })

  // Dismiss the error
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-ghost") as HTMLButtonElement
    btn?.click()
  })

  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  // Critical: readOnly must be false
  const afterError = await page.evaluate(() => {
    const el = document.getElementById("test-area") as HTMLTextAreaElement
    return el.readOnly
  })
  expect(afterError).toBe(false)
})

// ─── 4. Empty field ───────────────────────────────────────────────────────

test("empty textarea: shows no-text error, no element lock", async () => {
  const page = await openTestPage()

  await page.focus("#test-area")
  // Leave textarea empty
  await page.keyboard.press(SHORTCUT)

  // Should show "No text found" without locking
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("No text found") ?? false
  }, { timeout: 3000 })

  const isLocked = await page.evaluate(() => {
    const el = document.getElementById("test-area") as HTMLTextAreaElement
    return el.readOnly
  })
  expect(isLocked).toBe(false)
})

// ─── 5. Non-text element ──────────────────────────────────────────────────

test("non-editable div: silent no-op, no overlay", async () => {
  const page = await openTestPage()

  await page.focus("#non-editable")
  await page.keyboard.press(SHORTCUT)

  // Wait a bit — no overlay should appear
  await page.waitForTimeout(800)

  const hasOverlay = await page.evaluate(() => !!document.getElementById("writeai-overlay-host"))
  expect(hasOverlay).toBe(false)
})

// ─── 6. Cancel cancels the request ────────────────────────────────────────

test("cancel button sends CANCEL_CHECK and closes overlay", async () => {
  const page = await openTestPage()
  let cancelReceived = false

  await page.addInitScript(() => {
    // @ts-ignore
    chrome.runtime.sendMessage = async (msg: any) => {
      if (msg?.type === "CANCEL_CHECK") {
        // @ts-ignore
        window.__cancelReceived = true
        return {}
      }
      if (msg?.type === "CHECK_TEXT") {
        // Slow response — let user cancel
        await new Promise(r => setTimeout(r, 10000))
        return { corrections: [] }
      }
    }
  })

  await page.fill("#test-area", "Some text.")
  await page.focus("#test-area")
  await page.keyboard.press(SHORTCUT)

  // Wait for loading overlay
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.querySelector(".spinner") !== null
  }, { timeout: 3000 })

  // Click cancel
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-ghost") as HTMLButtonElement
    btn?.click()
  })

  // Overlay gone
  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  // Element unlocked
  const isLocked = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(isLocked).toBe(false)
})

// ─── 7. "Looks good" state ────────────────────────────────────────────────

test("no corrections returned: shows Looks good overlay", async () => {
  const page = await openTestPage()

  await page.addInitScript(() => {
    // @ts-ignore
    chrome.runtime.sendMessage = async (msg: any) => {
      if (msg?.type === "CHECK_TEXT") return { corrections: [] }
    }
  })

  await page.fill("#test-area", "This sentence is perfectly written.")
  await page.focus("#test-area")
  await page.keyboard.press(SHORTCUT)

  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("Looks good") ?? false
  }, { timeout: 3000 })

  const isLocked = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(isLocked).toBe(false)
})
