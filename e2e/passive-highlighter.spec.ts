// e2e/passive-highlighter.spec.ts — Playwright E2E for the passive highlighter.
// Requires the extension to be built first: pnpm build
// Run with: pnpm exec playwright test passive-highlighter
//
// Covers the critical path from gastflow_spec.json AC1/AC4/AC5/AC6/AC7:
//   1. Toggle passiveMode=true via the service worker.
//   2. Type a sentence with an intentional typo in a textarea.
//   3. Assert a red dotted decoration appears over the typo.
//   4. Click the decoration → suggestion popover renders with 3 rows.
//   5. Click the "receive" suggestion → textarea text is corrected.
//   6. Assert chrome.storage.local.autoFixesCount === 1 (stats isolation).
//   7. Assert chrome.storage.local.corrections is untouched.

import { test, expect, chromium, type BrowserContext } from "@playwright/test"
import http from "http"
import path from "path"

const EXTENSION_PATH = path.join(process.cwd(), "build/chrome-mv3-prod")
const TEST_PORT = 9998
const TEST_URL = `http://localhost:${TEST_PORT}/test`

let context: BrowserContext
let testServer: http.Server
let serviceWorker: Awaited<ReturnType<typeof context.serviceWorkers>>[0]

const TEST_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>WriteAI Passive Test</title>
  <style>
    body { font-family: system-ui; padding: 24px; }
    textarea { width: 480px; height: 140px; font-size: 16px; padding: 8px; }
  </style>
</head>
<body>
  <h1>Passive highlighter test</h1>
  <textarea id="ta" aria-label="test textarea"></textarea>
</body>
</html>
`

test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
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

  serviceWorker = context.serviceWorkers()[0]
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 })
  }
  // Let the SW initialize, then flip passiveMode on for the whole test session.
  await new Promise((r) => setTimeout(r, 500))
  await serviceWorker.evaluate(async () => {
    await new Promise<void>((r) => chrome.storage.sync.set({ passiveMode: true }, r))
    // Ensure a clean stats baseline for the autoFixesCount / corrections asserts.
    await new Promise<void>((r) =>
      chrome.storage.local.remove(["autoFixesCount", "corrections"], r)
    )
  })
})

test.afterAll(async () => {
  await context.close()
  await new Promise<void>((resolve) => testServer.close(resolve))
})

test("passive highlighter critical path: type → underline → suggest → accept → autoFix++", async () => {
  const page = await context.newPage()
  await page.goto(TEST_URL)
  await page.bringToFront()

  // Step 1 — type a sentence with an intentional typo.
  const ta = page.locator("#ta")
  await ta.focus()
  await ta.type("I recieve emails")

  // Step 2 — wait for the debounce (300ms) + dictionary fetch (~50ms cold).
  // The decoration overlay is appended to <body> with class .writeai-passive-typo.
  const typoSpan = page.locator(".writeai-passive-typo").first()
  await expect(typoSpan).toBeVisible({ timeout: 5000 })
  await expect(typoSpan).toHaveAttribute("data-word", "recieve")

  // Step 3 — click the decoration to open the popover.
  await typoSpan.click()
  const popover = page.locator("#writeai-passive-popover")
  await expect(popover).toBeVisible({ timeout: 1000 })

  // Step 4 — assert 3 suggestion rows + 1 disabled "Add to allowlist" row.
  const rows = popover.locator(".writeai-passive-popover-row")
  await expect(rows).toHaveCount(4) // 3 suggestions + 1 disabled allowlist row

  // Step 5 — click the "receive" suggestion.
  await popover.getByRole("button", { name: "receive" }).click()

  // Step 6 — textarea text was corrected.
  await expect(ta).toHaveValue("I receive emails")

  // Step 7 — autoFixesCount incremented, corrections untouched (AC7).
  const stats = await serviceWorker.evaluate(async () => {
    return new Promise<{ autoFixesCount: unknown; corrections: unknown }>((r) =>
      chrome.storage.local.get(["autoFixesCount", "corrections"], (s) =>
        r({ autoFixesCount: s.autoFixesCount, corrections: s.corrections })
      )
    )
  })
  expect(stats.autoFixesCount).toBe(1)
  // corrections is either undefined or an empty array — both prove isolation.
  expect(stats.corrections === undefined || (stats.corrections as unknown[]).length === 0).toBe(true)

  await page.close()
})
