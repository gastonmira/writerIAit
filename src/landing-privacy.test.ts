// landing-privacy.test.ts — assertions on landing/privacy.html
//
// Validates the privacy policy page that we link from the Chrome Web Store
// Developer Dashboard. The CWS reviewer needs:
//  - the file to parse as valid HTML
//  - clear disclosure of which data is sent to which third party
//  - a contact channel
//  - a "last updated" date

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { JSDOM } from "jsdom"

const html = readFileSync(resolve(__dirname, "..", "landing", "privacy.html"), "utf-8")

describe("landing/privacy.html", () => {
  it("parses as valid HTML without throwing", () => {
    expect(() => new JSDOM(html)).not.toThrow()
  })

  it("has a <title> mentioning Privacy Policy", () => {
    const dom = new JSDOM(html)
    expect(dom.window.document.title.toLowerCase()).toMatch(/privacy/)
    expect(dom.window.document.title.toLowerCase()).toMatch(/writeriait/i)
  })

  it("has a meta description tag", () => {
    const dom = new JSDOM(html)
    const meta = dom.window.document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute("content")?.length ?? 0).toBeGreaterThan(20)
  })

  it("links back to the landing index.html", () => {
    const dom = new JSDOM(html)
    const links = dom.window.document.querySelectorAll("a")
    const hasBack = Array.from(links as unknown as ArrayLike<HTMLAnchorElement>).some(
      (a) => a.getAttribute("href") === "index.html"
    )
    expect(hasBack).toBe(true)
  })

  it("includes the H1 'Privacy Policy'", () => {
    const dom = new JSDOM(html)
    const h1 = dom.window.document.querySelector("h1")
    expect(h1?.textContent?.toLowerCase()).toContain("privacy policy")
  })

  it("includes a 'Last updated' date", () => {
    expect(html).toMatch(/Last updated:\s*[A-Z][a-z]+ \d{1,2},\s*\d{4}/)
  })

  it("names every supported LLM provider so users know who receives their text", () => {
    expect(html).toContain("OpenAI")
    expect(html).toContain("Anthropic")
    expect(html).toContain("Google")
    expect(html).toContain("Groq")
  })

  it("links to each provider's privacy policy", () => {
    expect(html).toMatch(/openai\.com\/policies\/privacy/i)
    expect(html).toMatch(/anthropic\.com\/legal\/privacy/i)
    expect(html).toMatch(/policies\.google\.com\/privacy/i)
    expect(html).toMatch(/groq\.com\/privacy/i)
  })

  it("discloses the local storage of the API key", () => {
    expect(html).toMatch(/chrome\.storage\.local/i)
    expect(html).toMatch(/api key/i)
  })

  it("provides a contact channel (GitHub issues)", () => {
    expect(html).toMatch(/github\.com\/gastonmira\/writeriait/i)
    expect(html.toLowerCase()).toMatch(/contact|issues/)
  })

  it("explicitly states no analytics or tracking", () => {
    expect(html.toLowerCase()).toMatch(/(no|do not).*(analytics|telemetry|track)/)
  })
})
