// e2e/cross-site-agent.spec.ts — Cross-site happy path agent
// Tests WriteAI on realistic simulations of GitHub, Gmail, contact form,
// Twitter/X, LinkedIn, and Notion. Pages run on a local HTTP server.
// LLM responses are mocked for reliability.
//
// Run: pnpm test:e2e:cross

import { test, expect, chromium, type BrowserContext, type Route } from "@playwright/test"
import * as fs from "fs"
import * as http from "http"
import * as path from "path"

const EXTENSION_PATH = path.join(process.cwd(), "build/chrome-mv3-dev")
const SCREENSHOTS_DIR = path.join(process.cwd(), "test-results", "cross-site")
const TEST_PORT = 9998

let context: BrowserContext
let testServer: http.Server
let serviceWorker: Awaited<ReturnType<typeof context.serviceWorkers>>[0]

// ─── Simulated site pages ─────────────────────────────────────────────────────

const PAGES: Record<string, string> = {
  "/github": `<!DOCTYPE html>
<html>
<head>
  <title>gastonmira/writeAIit — Pull Request #5</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d1117; color: #e6edf3; margin: 0; padding: 24px; }
    .pr-title { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
    .pr-meta { color: #7d8590; font-size: 14px; margin-bottom: 24px; }
    .comment-box { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; max-width: 800px; }
    .comment-box h3 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
    textarea { width: 100%; box-sizing: border-box; background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; padding: 10px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 100px; outline: none; }
    textarea:focus { border-color: #388bfd; box-shadow: 0 0 0 3px rgba(56,139,253,0.3); }
    .btn { margin-top: 12px; background: #238636; color: #fff; border: none; border-radius: 6px; padding: 6px 16px; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="pr-title">chore: alpha release — VERSION, CHANGELOG, TODOS (v0.1.0.0) <span style="color:#7d8590">#5</span></div>
  <div class="pr-meta">gastonmira wants to merge 1 commit into main from alpha-release</div>
  <div class="comment-box">
    <h3>Leave a comment</h3>
    <textarea id="comment-body" placeholder="Leave a comment"></textarea>
    <button class="btn">Comment</button>
  </div>
</body>
</html>`,

  "/gmail": `<!DOCTYPE html>
<html>
<head>
  <title>Gmail — Compose</title>
  <style>
    body { font-family: "Google Sans", Roboto, sans-serif; background: #f6f8fc; margin: 0; padding: 24px; }
    .compose { background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,.2); width: 560px; overflow: hidden; }
    .compose-header { background: #404040; color: #fff; padding: 10px 16px; font-size: 14px; font-weight: 500; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; }
    .compose-field { padding: 8px 16px; border-bottom: 1px solid #e0e0e0; font-size: 14px; color: #202124; }
    .compose-field span { color: #5f6368; margin-right: 8px; }
    .compose-body { padding: 12px 16px; min-height: 200px; outline: none; font-size: 14px; color: #202124; }
    .compose-footer { padding: 10px 16px; border-top: 1px solid #e0e0e0; }
    .btn-send { background: #1a73e8; color: #fff; border: none; border-radius: 4px; padding: 8px 24px; font-size: 14px; font-weight: 500; cursor: pointer; }
  </style>
</head>
<body>
  <div class="compose">
    <div class="compose-header"><span>New Message</span></div>
    <div class="compose-field"><span>To</span> recruiter@company.com</div>
    <div class="compose-field"><span>Subject</span> Application for Software Engineer role</div>
    <div id="compose-body" class="compose-body" contenteditable="true" aria-label="Message Body" role="textbox"></div>
    <div class="compose-footer"><button class="btn-send">Send</button></div>
  </div>
</body>
</html>`,

  "/contact": `<!DOCTYPE html>
<html>
<head>
  <title>Contact Us — Acme Corp</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f9fafb; margin: 0; padding: 48px 24px; }
    .form-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; max-width: 480px; margin: 0 auto; }
    h2 { font-size: 22px; font-weight: 700; margin: 0 0 24px; color: #111827; }
    label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 16px; }
    input:focus, textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
    textarea { resize: vertical; min-height: 120px; margin-bottom: 60px; }
    .btn { width: 100%; background: #6366f1; color: #fff; border: none; border-radius: 8px; padding: 10px; font-size: 15px; font-weight: 500; cursor: pointer; }
  </style>
</head>
<body>
  <div class="form-card">
    <h2>Contact Us</h2>
    <label>Name</label>
    <input id="name" type="text" placeholder="Your name" />
    <label>Message</label>
    <textarea id="message" placeholder="Write your message here..."></textarea>
    <button class="btn">Send Message</button>
  </div>
</body>
</html>`,

  "/twitter": `<!DOCTYPE html>
<html>
<head>
  <title>X (Twitter)</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: "TwitterChirp", -apple-system, sans-serif; background: #000; color: #e7e9ea; margin: 0; padding: 0; }
    .sidebar { width: 275px; height: 100vh; border-right: 1px solid #2f3336; position: fixed; left: 0; top: 0; padding: 12px; }
    .logo { font-size: 28px; padding: 12px; margin-bottom: 8px; }
    .nav-item { display: flex; align-items: center; gap: 20px; padding: 12px; border-radius: 9999px; font-size: 20px; cursor: pointer; margin-bottom: 4px; }
    .nav-item:hover { background: #1d1f23; }
    .nav-icon { font-size: 24px; }
    .main { margin-left: 275px; max-width: 600px; border-right: 1px solid #2f3336; min-height: 100vh; }
    .composer { display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #2f3336; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #1d9bf0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; }
    .composer-right { flex: 1; }
    .tweet-box { width: 100%; background: transparent; border: none; outline: none; color: #e7e9ea; font-size: 20px; font-family: inherit; resize: none; min-height: 80px; padding: 8px 0; }
    .tweet-box::placeholder { color: #5b7083; }
    .composer-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #2f3336; margin-top: 8px; }
    .char-count { color: #1d9bf0; font-size: 14px; }
    .btn-tweet { background: #1d9bf0; color: #fff; border: none; border-radius: 9999px; padding: 8px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .tweet { padding: 12px 16px; border-bottom: 1px solid #2f3336; display: flex; gap: 12px; }
    .tweet-content { font-size: 15px; line-height: 1.5; }
    .tweet-meta { color: #5b7083; font-size: 14px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="logo">𝕏</div>
    <div class="nav-item"><span class="nav-icon">🏠</span> Home</div>
    <div class="nav-item"><span class="nav-icon">🔍</span> Explore</div>
    <div class="nav-item"><span class="nav-icon">🔔</span> Notifications</div>
    <div class="nav-item"><span class="nav-icon">✉️</span> Messages</div>
  </div>
  <div class="main">
    <div class="composer">
      <div class="avatar">G</div>
      <div class="composer-right">
        <textarea id="tweet-box" class="tweet-box" placeholder="What is happening?!" rows="3"></textarea>
        <div class="composer-footer">
          <span class="char-count">280</span>
          <button class="btn-tweet">Post</button>
        </div>
      </div>
    </div>
    <div class="tweet">
      <div class="avatar" style="background:#e1306c">M</div>
      <div>
        <div class="tweet-content">Just shipped a new feature 🚀 Really excited about this one!</div>
        <div class="tweet-meta">2h · 142 Likes</div>
      </div>
    </div>
  </div>
</body>
</html>`,

  "/linkedin": `<!DOCTYPE html>
<html>
<head>
  <title>LinkedIn</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #f3f2ef; margin: 0; }
    .topbar { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 0 24px; display: flex; align-items: center; gap: 24px; height: 52px; position: sticky; top: 0; z-index: 10; }
    .topbar-logo { color: #0a66c2; font-size: 28px; font-weight: 900; }
    .layout { max-width: 1128px; margin: 24px auto; padding: 0 16px; display: grid; grid-template-columns: 225px 1fr; gap: 24px; }
    .sidebar-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; padding: 16px; }
    .profile-banner { background: linear-gradient(135deg, #0a66c2, #004182); height: 56px; border-radius: 8px 8px 0 0; margin: -16px -16px 0; }
    .profile-avatar { width: 56px; height: 56px; border-radius: 50%; background: #0a66c2; border: 2px solid #fff; margin: -28px 0 8px 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
    .profile-name { font-weight: 600; font-size: 15px; }
    .profile-sub { color: #666; font-size: 13px; margin-top: 2px; }
    .feed { display: flex; flex-direction: column; gap: 8px; }
    .post-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
    .post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .post-avatar { width: 40px; height: 40px; border-radius: 50%; background: #0a66c2; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; flex-shrink: 0; }
    .post-name { font-weight: 600; font-size: 14px; }
    .post-title { color: #666; font-size: 13px; }
    .post-body [contenteditable] { border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 12px; min-height: 80px; font-size: 14px; outline: none; color: #191919; margin-bottom: 8px; }
    .post-body [contenteditable]:focus { border-color: #0a66c2; }
    .post-body [contenteditable]:empty::before { content: attr(placeholder); color: #aaa; }
    .btn-post { background: #0a66c2; color: #fff; border: none; border-radius: 9999px; padding: 6px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-post:disabled { opacity: 0.5; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-logo">in</div>
  </div>
  <div class="layout">
    <div>
      <div class="sidebar-card">
        <div class="profile-banner"></div>
        <div class="profile-avatar">G</div>
        <div class="profile-name">Gastón Mira</div>
        <div class="profile-sub">Software Engineer</div>
      </div>
    </div>
    <div class="feed">
      <div class="post-card">
        <div class="post-header">
          <div class="post-avatar">G</div>
          <div>
            <div class="post-name">Gastón Mira</div>
            <div class="post-title">Software Engineer</div>
          </div>
        </div>
        <div class="post-body">
          <div id="post-editor" contenteditable="true" placeholder="Write something..." role="textbox" aria-label="Post text editor" style="min-height:100px;margin-bottom:60px;"></div>
          <div style="display:flex;justify-content:flex-end;">
            <button class="btn-post">Post</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,

  "/notion": `<!DOCTYPE html>
<html>
<head>
  <title>Notion — My notes</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: ui-sans-serif, -apple-system, sans-serif; background: #fff; margin: 0; display: flex; }
    .sidebar { width: 240px; background: #f7f7f5; border-right: 1px solid #e8e8e5; height: 100vh; padding: 12px 8px; flex-shrink: 0; }
    .sidebar-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #37352f; cursor: pointer; }
    .sidebar-item:hover { background: #ebebea; }
    .sidebar-item.active { background: #e8e8e5; }
    .page { flex: 1; max-width: 900px; margin: 0 auto; padding: 96px 96px 200px; }
    .page-icon { font-size: 64px; margin-bottom: 12px; }
    .page-title { font-size: 40px; font-weight: 700; color: #37352f; margin-bottom: 8px; border: none; outline: none; width: 100%; font-family: inherit; padding: 0; }
    .block { min-height: 30px; padding: 3px 2px; font-size: 16px; color: #37352f; line-height: 1.6; outline: none; border: none; }
    .block:focus { outline: none; }
    .block[contenteditable]:empty::before { content: attr(placeholder); color: #c1c1c1; }
    .block-p { margin: 2px 0; }
    .block-h2 { font-size: 24px; font-weight: 600; margin: 16px 0 4px; }
    .divider { border: none; border-top: 1px solid #e8e8e5; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-item active">📝 My notes</div>
    <div class="sidebar-item">📋 Tasks</div>
    <div class="sidebar-item">📚 Reading list</div>
  </div>
  <div class="page">
    <div class="page-icon">📝</div>
    <input class="page-title" value="Weekly standup notes" readonly />
    <hr class="divider" />
    <div class="block block-h2 block-p" contenteditable="true" placeholder="Heading...">What I did this week</div>
    <div id="notion-block" class="block block-p" contenteditable="true" placeholder="Write something, or press '/' for commands..." role="textbox" style="margin-bottom:80px;"></div>
  </div>
</body>
</html>`,
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  testServer = http.createServer((req, res) => {
    const url = req.url?.split("?")[0] ?? ""
    const page = PAGES[url] ?? "<h1>Not found</h1>"
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(page)
  })
  await new Promise<void>(r => testServer.listen(TEST_PORT, r))

  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      `--disable-extensions-except=${EXTENSION_PATH}`,
    ],
  })

  serviceWorker = context.serviceWorkers()[0]
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 })
  }
  await new Promise(r => setTimeout(r, 500))

  await serviceWorker.evaluate(async () => {
    await Promise.all([
      new Promise<void>(r => chrome.storage.sync.set({ provider: "openai", nativeLanguage: "spanish" }, r)),
      new Promise<void>(r => chrome.storage.local.set({ apiKey: "test-key" }, r)),
    ])
  })
})

test.afterAll(async () => {
  await context.close()
  await new Promise<void>(r => testServer.close(r))
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockOpenAI(corrections: { original: string; replacement: string; reason: string }[]) {
  return (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(corrections) } }],
      }),
    })
}

async function triggerFix(page: Awaited<ReturnType<typeof context.newPage>>) {
  await page.bringToFront()
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_FIX" }).catch(() => {})
  })
}

async function screenshot(page: Awaited<ReturnType<typeof context.newPage>>, name: string) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function waitForOverlay(page: Awaited<ReturnType<typeof context.newPage>>) {
  await page.waitForFunction(
    () => !!document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar"),
    { timeout: 6000 }
  )
}

async function acceptAll(page: Awaited<ReturnType<typeof context.newPage>>) {
  await page.evaluate(() => {
    const host = document.getElementById("writeai-overlay-host")
    const btn = host?.shadowRoot?.querySelector(".btn-primary") as HTMLButtonElement
    btn?.click()
  })
  await page.waitForFunction(() => !document.getElementById("writeai-overlay-host"), { timeout: 3000 })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("GitHub PR — textarea comment box", async () => {
  const corrections = [
    { original: "is well thinked", replacement: "is well thought out", reason: "'Think' is irregular — past participle is 'thought out'." },
    { original: "decision that was maked", replacement: "decisions that were made", reason: "'Make' is irregular — past tense is 'made'." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/github`)
  await page.fill("#comment-body", "i think this PR is very good, the changes is well thinked and i agree with all the decision that was maked here")
  await page.focus("#comment-body")

  await screenshot(page, "github-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "github-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "github-after")

  const value = await page.inputValue("#comment-body")
  expect(value).toContain("is well thought out")
  expect(value).toContain("decisions that were made")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

test("Gmail compose — contenteditable body", async () => {
  const corrections = [
    { original: "I writed", replacement: "I wrote", reason: "'Write' is irregular — past tense is 'wrote'." },
    { original: "since 2 years", replacement: "for 2 years", reason: "Use 'for' with durations, not 'since'." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/gmail`)
  await page.click("#compose-body")
  await page.type("#compose-body", "Hello, I writed to you last week about the position. I have been working in this field since 2 years.")
  await page.focus("#compose-body")

  await screenshot(page, "gmail-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "gmail-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "gmail-after")

  const bodyText = await page.evaluate(() => document.getElementById("compose-body")?.innerText ?? "")
  expect(bodyText).toContain("I wrote")
  expect(bodyText).toContain("for 2 years")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

test("Contact form — textarea message field", async () => {
  const corrections = [
    { original: "I am interest", replacement: "I am interested", reason: "Adjective form needed: 'interested'." },
    { original: "can you send me more informations", replacement: "can you send me more information", reason: "'Information' is uncountable — no plural form." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/contact`)
  await page.fill("#name", "Gastón Mira")
  await page.fill("#message", "Hello, I am interest in your product. can you send me more informations about the pricing?")
  await page.focus("#message")

  await screenshot(page, "contact-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "contact-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "contact-after")

  const value = await page.inputValue("#message")
  expect(value).toContain("I am interested")
  expect(value).toContain("more information")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

test("Twitter/X — tweet compose box", async () => {
  const corrections = [
    { original: "Very excited of", replacement: "Very excited about", reason: "Use 'excited about', not 'excited of'." },
    { original: "we builded", replacement: "we built", reason: "'Build' is irregular — past tense is 'built'." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/twitter`)
  await page.fill("#tweet-box", "Very excited of sharing what we builded this month. Stay tuned!")
  await page.focus("#tweet-box")

  await screenshot(page, "twitter-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "twitter-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "twitter-after")

  const value = await page.inputValue("#tweet-box")
  expect(value).toContain("Very excited about")
  expect(value).toContain("we built")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

test("LinkedIn — post contenteditable editor", async () => {
  const corrections = [
    { original: "I am very happy to announce", replacement: "I am happy to announce", reason: "'Very happy' is redundant in formal professional posts." },
    { original: "I learned a lot of things", replacement: "I learned a great deal", reason: "'A lot of things' is informal — 'a great deal' fits LinkedIn tone." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/linkedin`)
  await page.click("#post-editor")
  await page.type("#post-editor", "I am very happy to announce that I just finished a big project. I learned a lot of things from this experience.")
  await page.focus("#post-editor")

  await screenshot(page, "linkedin-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "linkedin-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "linkedin-after")

  const bodyText = await page.evaluate(() => document.getElementById("post-editor")?.innerText ?? "")
  expect(bodyText).toContain("I am happy to announce")
  expect(bodyText).toContain("a great deal")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})

test("Notion — block contenteditable editor", async () => {
  const corrections = [
    { original: "we have went", replacement: "we have gone", reason: "'Go' is irregular — past participle is 'gone', not 'went'." },
    { original: "the team is agree", replacement: "the team agrees", reason: "'Agree' is a verb, not an adjective — use 'the team agrees'." },
  ]
  const handler = mockOpenAI(corrections)
  await context.route("https://api.openai.com/**", handler)

  const page = await context.newPage()
  await page.goto(`http://localhost:${TEST_PORT}/notion`)
  await page.click("#notion-block")
  await page.type("#notion-block", "This week we have went through all the open issues. the team is agree that we should ship by Friday.")
  await page.focus("#notion-block")

  await screenshot(page, "notion-before")
  await triggerFix(page)
  await waitForOverlay(page)
  await screenshot(page, "notion-overlay")

  const label = await page.evaluate(() =>
    document.getElementById("writeai-overlay-host")?.shadowRoot?.querySelector(".action-bar-label")?.textContent ?? ""
  )
  expect(label).toContain("2 correction")

  await acceptAll(page)
  await screenshot(page, "notion-after")

  const bodyText = await page.evaluate(() => document.getElementById("notion-block")?.innerText ?? "")
  expect(bodyText).toContain("we have gone")
  expect(bodyText).toContain("the team agrees")

  await context.unroute("https://api.openai.com/**", handler)
  await page.close()
})
