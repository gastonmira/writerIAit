// e2e/correction-flow.spec.ts — Playwright E2E tests
// Requires the extension to be built first: npm run build
// Run with: npm run test:e2e

import { test, expect, chromium, type BrowserContext, type Route } from "@playwright/test"
import http from "http"
import path from "path"

const EXTENSION_PATH = path.join(process.cwd(), "build/chrome-mv3-dev")

// On Mac the manifest registers Command+Shift+K; elsewhere Ctrl+Shift+K
const SHORTCUT = process.platform === "darwin" ? "Meta+Shift+K" : "Control+Shift+K"

// Serve the test page from a real HTTP server so the extension injects its content script.
// (Content scripts do NOT inject into about:blank / page.setContent() pages.)
const TEST_PORT = 9999
const TEST_URL = `http://localhost:${TEST_PORT}/test`

let context: BrowserContext
let testServer: http.Server
let serviceWorker: Awaited<ReturnType<typeof context.serviceWorkers>>[0]

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

// ─── Browser setup ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Start a local HTTP server — content scripts only inject into real http:// pages
  await new Promise<void>(resolve => {
    testServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(TEST_PAGE_HTML)
    })
    testServer.listen(TEST_PORT, resolve)
  })

  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      `--disable-extensions-except=${EXTENSION_PATH}`
    ]
  })

  // Wait for the extension service worker to register
  serviceWorker = context.serviceWorkers()[0]
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 })
  }
  // Give it a moment to fully initialize
  await new Promise(r => setTimeout(r, 500))

  // Configure extension storage: use OpenAI provider with a placeholder key.
  // The actual API call is intercepted per-test via context.route(), so the key
  // value doesn't matter — it just needs to be non-empty to pass the apiKey guard.
  await serviceWorker.evaluate(async () => {
    await Promise.all([
      new Promise<void>(r => chrome.storage.sync.set({ provider: "openai", nativeLanguage: "spanish" }, r)),
      new Promise<void>(r => chrome.storage.local.set({ apiKey: "test-api-key-placeholder" }, r))
    ])
  })
})

test.afterAll(async () => {
  await context.close()
  await new Promise<void>(resolve => testServer.close(resolve))
})

// ─── Helpers ───────────────────────────────────────────────────────────────

async function openTestPage() {
  const page = await context.newPage()
  await page.goto(TEST_URL)
  return page
}

// Trigger the WriteAI fix via the service worker — more reliable than keyboard shortcuts
// in automated testing since CDP key events don't always fire Chrome extension commands.
async function triggerFix(page: Awaited<ReturnType<typeof context.newPage>>) {
  await page.bringToFront()
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_FIX" }).catch(() => {})
    }
  })
}

// Build a mock route handler that returns specific corrections via OpenAI response shape
function buildOpenAIMock(corrections: { original: string; replacement: string; reason: string }[]) {
  return (route: Route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      choices: [{ message: { content: JSON.stringify(corrections) } }]
    })
  })
}

// ─── 1. Full happy path ────────────────────────────────────────────────────

test("happy path: overlay appears → Accept All → text corrected", async () => {
  const handler = buildOpenAIMock([
    { original: "since 3 years", replacement: "for 3 years", reason: "Duration uses 'for', not 'since'." }
  ])
  await context.route("https://api.openai.com/**", handler)

  const page = await openTestPage()
  await page.fill("#test-area", "I am working since 3 years at this company.")
  await page.focus("#test-area")
  await triggerFix(page)

  // Wait for the action bar to appear (inline diff mode: "N corrections found")
  await page.waitForFunction(() => {
    return !!document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar")
  }, { timeout: 5000 })

  // Verify the action bar label says "1 correction found"
  const labelText = await page.evaluate(() => {
    return document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  })
  expect(labelText).toContain("1 correction")

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

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

// ─── 2. Dismiss path ──────────────────────────────────────────────────────

test("dismiss: text unchanged, overlay removed", async () => {
  const handler = buildOpenAIMock([
    { original: "have presented", replacement: "presented", reason: "Past perfect overuse." }
  ])
  await context.route("https://api.openai.com/**", handler)

  const originalText = "We have presented the results last week."
  const page = await openTestPage()
  await page.fill("#test-area", originalText)
  await page.focus("#test-area")
  await triggerFix(page)

  await page.waitForFunction(() => !!document.getElementById("writeai-overlay-host"), { timeout: 5000 })

  // Dismiss
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-ghost") as HTMLButtonElement
    btn?.click()
  })

  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  const value = await page.inputValue("#test-area")
  expect(value).toBe(originalText)

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

// ─── 3. Element lock safety ───────────────────────────────────────────────
// HIGHEST PRIORITY: textarea must NOT be readOnly after error state dismissed

test("element lock released after network error", async () => {
  // Simulate a network failure by aborting the request
  const handler = (route: Route) => route.abort("failed")
  await context.route("https://api.openai.com/**", handler)

  const page = await openTestPage()
  await page.fill("#test-area", "Some text to check.")
  await page.focus("#test-area")

  const beforeLock = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(beforeLock).toBe(false)

  await triggerFix(page)

  // Wait for error overlay (network failure surfaces as "No internet connection.")
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("No internet") ?? false
  }, { timeout: 5000 })

  // Dismiss the error
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-ghost") as HTMLButtonElement
    btn?.click()
  })

  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  // Critical: readOnly must be false after error dismissal
  const afterError = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(afterError).toBe(false)

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

// ─── 4. Empty field ───────────────────────────────────────────────────────

test("empty textarea: shows no-text error, no element lock", async () => {
  const page = await openTestPage()

  await page.focus("#test-area")
  // Leave textarea empty
  await triggerFix(page)

  // Should show "No text found" without locking
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("No text found") ?? false
  }, { timeout: 5000 })

  const isLocked = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(isLocked).toBe(false)

  await page.close()
})

// ─── 5. Non-text element ──────────────────────────────────────────────────

test("non-editable div: silent no-op, no overlay", async () => {
  const page = await openTestPage()

  await page.click("#non-editable")
  await triggerFix(page)

  // Wait a bit — no overlay should appear
  await page.waitForTimeout(800)

  const hasOverlay = await page.evaluate(() => !!document.getElementById("writeai-overlay-host"))
  expect(hasOverlay).toBe(false)

  await page.close()
})

// ─── 6. Cancel cancels the request ────────────────────────────────────────

test("cancel button closes overlay and releases element lock", async () => {
  // Slow response so the user can cancel before it resolves
  const handler = (route: Route) => new Promise<void>(resolve => setTimeout(() => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: "[]" } }] })
    })
    resolve()
  }, 10000))
  await context.route("https://api.openai.com/**", handler)

  const page = await openTestPage()
  await page.fill("#test-area", "Some text.")
  await page.focus("#test-area")
  await triggerFix(page)

  // Wait for loading overlay (spinner)
  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return !!host?.shadowRoot?.querySelector(".spinner")
  }, { timeout: 5000 })

  // Click cancel (loading state uses .btn-close, not .btn-ghost)
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-close") as HTMLButtonElement
    btn?.click()
  })

  // Overlay gone
  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 2000 })

  // Element unlocked
  const isLocked = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(isLocked).toBe(false)

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

// ─── 7. "Looks good" state ────────────────────────────────────────────────

test("no corrections returned: shows Looks good overlay", async () => {
  const handler = buildOpenAIMock([])
  await context.route("https://api.openai.com/**", handler)

  const page = await openTestPage()
  await page.fill("#test-area", "This sentence is perfectly written.")
  await page.focus("#test-area")
  await triggerFix(page)

  await page.waitForFunction(() => {
    const host = document.getElementById("writeai-overlay-host")
    return host?.shadowRoot?.textContent?.includes("Looks good") ?? false
  }, { timeout: 5000 })

  const isLocked = await page.evaluate(() => {
    return (document.getElementById("test-area") as HTMLTextAreaElement).readOnly
  })
  expect(isLocked).toBe(false)

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})
