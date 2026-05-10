// popup/index.test.tsx — component tests for the onboarding wizard
// Uses React Testing Library + jsdom + chrome API mock (see src/test-setup.ts)

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import Popup from "./index"

// Helper: render and wait for the storage check to resolve
async function renderPopup() {
  const user = userEvent.setup()
  render(<Popup />)
  // Wait for the hasOnboarded check to resolve (useEffect + chrome.storage.local.get)
  await waitFor(() => {
    expect(screen.queryByText(/choose your ai provider/i) ?? screen.queryByText(/native language/i)).not.toBeNull()
  })
  return { user }
}

// ─── First-run: wizard is shown ────────────────────────────────────────────

describe("onboarding wizard", () => {
  it("shows Step 1 on first run (no hasOnboarded in storage)", async () => {
    await renderPopup()
    expect(screen.getByText(/choose your ai provider/i)).toBeInTheDocument()
    expect(screen.getByText(/gemini and groq are free/i)).toBeInTheDocument()
  })

  it("renders all 4 provider cards on Step 1", async () => {
    await renderPopup()
    expect(screen.getByText("Google Gemini")).toBeInTheDocument()
    expect(screen.getByText("Groq")).toBeInTheDocument()
    expect(screen.getByText("OpenAI")).toBeInTheDocument()
    expect(screen.getByText("Anthropic")).toBeInTheDocument()
  })

  it("shows free badges on Gemini and Groq", async () => {
    await renderPopup()
    const freeBadges = document.querySelectorAll(".badge-free")
    expect(freeBadges).toHaveLength(2)
  })

  it("shows 3 progress dots on Step 1, first dot active", async () => {
    render(<Popup />)
    await waitFor(() => screen.getByText(/choose your ai provider/i))
    const dots = document.querySelectorAll(".progress-dot")
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveClass("active")
    expect(dots[1]).not.toHaveClass("active")
    expect(dots[2]).not.toHaveClass("active")
  })

  it("advances to Step 2 when a provider card is clicked", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Google Gemini"))
    expect(screen.getByText(/add your api key/i)).toBeInTheDocument()
    expect(screen.getByText(/keys are stored locally/i)).toBeInTheDocument()
  })

  it("shows the correct provider chip and key link on Step 2", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Google Gemini"))
    expect(screen.getByText("Google Gemini", { selector: ".provider-chip" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /get your google gemini key/i })).toHaveAttribute(
      "href",
      "https://aistudio.google.com/apikey"
    )
  })

  it("shows Groq key link when Groq is selected", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    expect(screen.getByRole("link", { name: /get your groq key/i })).toHaveAttribute(
      "href",
      "https://console.groq.com/keys"
    )
  })

  it("shows validation error when trying to advance from Step 2 with empty key", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Google Gemini"))
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.getByText(/please paste your api key/i)).toBeInTheDocument()
  })

  it("does not advance to Step 3 when key is empty", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.queryByText(/you're all set/i)).toBeNull()
    expect(screen.getByText(/add your api key/i)).toBeInTheDocument()
  })

  it("clears validation error when user starts typing", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.getByText(/please paste your api key/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/api key/i), "gsk_test")
    expect(screen.queryByText(/please paste your api key/i)).toBeNull()
  })

  it("advances to Step 3 after entering a key", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.getByText(/you're all set/i)).toBeInTheDocument()
  })

  it("shows keyboard shortcut on Step 3", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.getByText(/focus any text field/i)).toBeInTheDocument()
  })

  it("shows Teaching Mode note on Step 3", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    expect(screen.getByText(/teaching mode is always on/i)).toBeInTheDocument()
  })

  it("switches to normal settings view after clicking Start Writing", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    await user.click(screen.getByText(/start writing/i))
    expect(screen.getByText(/native language/i)).toBeInTheDocument()
    expect(screen.queryByText(/choose your ai provider/i)).toBeNull()
  })

  it("Back link returns to Step 1 without losing provider selection", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("OpenAI"))
    expect(screen.getByText(/add your api key/i)).toBeInTheDocument()
    await user.click(screen.getByText(/← back/i))
    expect(screen.getByText(/choose your ai provider/i)).toBeInTheDocument()
  })

  it("Skip goes directly to normal settings view", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText(/already set up\? skip/i))
    expect(screen.getByText(/native language/i)).toBeInTheDocument()
    expect(screen.queryByText(/choose your ai provider/i)).toBeNull()
  })

  it("all 3 progress dots active on Step 3", async () => {
    const { user } = await renderPopup()
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    const dots = document.querySelectorAll(".progress-dot")
    expect(dots).toHaveLength(3)
    dots.forEach(dot => expect(dot).toHaveClass("active"))
  })

  it("finish writes checkMode and rewriteIntent defaults to sync storage", async () => {
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText(/choose your ai provider/i))
    await user.click(screen.getByText("Groq"))
    await user.type(screen.getByLabelText(/api key/i), "gsk_testkey")
    await user.click(screen.getByText(/save & continue/i))
    await user.click(screen.getByText(/start writing/i))
    const sync = await chrome.storage.sync.get(["checkMode", "rewriteIntent"])
    expect(sync.checkMode).toBe("correct")
    expect(sync.rewriteIntent).toBe("professional")
  })
})

// ─── Returning user: normal view shown ─────────────────────────────────────

describe("normal settings view", () => {
  it("shows normal popup when hasOnboarded is true", async () => {
    // Pre-set the flag in storage before rendering
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByText(/native language/i))
    expect(screen.queryByText(/choose your ai provider/i)).toBeNull()
    expect(screen.getByText(/native language/i)).toBeInTheDocument()
  })

  it("shows provider selector in normal view", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByLabelText(/provider/i))
    expect(screen.getByLabelText(/provider/i)).toBeInTheDocument()
  })

  it("shows API key input in normal view", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByLabelText(/api key/i))
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it("shows version badge in normal view", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByText(/v0\.1\.0/i))
    expect(screen.getByText(/v0\.1\.0/i)).toBeInTheDocument()
  })

  it("saves API key on Save button click", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByLabelText(/api key/i))
    await user.type(screen.getByLabelText(/api key/i), "sk-test123")
    await user.click(screen.getByText("Save"))
    expect(await screen.findByText("Saved!")).toBeInTheDocument()
  })

  it("renders 3 mode buttons", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByText(/native language/i))
    expect(screen.getByText("Correct")).toBeInTheDocument()
    expect(screen.getByText("Improve")).toBeInTheDocument()
    expect(screen.getByText("Rewrite")).toBeInTheDocument()
  })

  it("Correct mode button is selected by default", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByText("Correct"))
    expect(screen.getByText("Correct").closest("button")).toHaveClass("selected")
    expect(screen.getByText("Improve").closest("button")).not.toHaveClass("selected")
  })

  it("clicking Improve selects it and saves to sync storage", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText("Improve"))
    await user.click(screen.getByText("Improve"))
    expect(screen.getByText("Improve").closest("button")).toHaveClass("selected")
    const sync = await chrome.storage.sync.get(["checkMode"])
    expect(sync.checkMode).toBe("improve")
  })

  it("clicking Rewrite reveals sub-intent select", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText("Rewrite"))
    expect(screen.queryByRole("combobox", { name: /rewrite-intent/i })).toBeNull()
    await user.click(screen.getByText("Rewrite"))
    expect(screen.getByRole("combobox", { name: /rewrite-intent/i })).toBeInTheDocument()
  })

  it("clicking Correct hides the sub-intent select", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ checkMode: "rewrite" })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText("Correct"))
    await user.click(screen.getByText("Correct"))
    expect(screen.queryByDisplayValue(/professional/i)).toBeNull()
  })

  it("sub-intent select has Professional/Friendly/Concise options", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText("Rewrite"))
    await user.click(screen.getByText("Rewrite"))
    const select = screen.getByRole("combobox", { name: /rewrite-intent/i })
    expect(select).toContainHTML("Professional")
    expect(select).toContainHTML("Friendly")
    expect(select).toContainHTML("Concise")
  })

  it("changing sub-intent saves rewriteIntent to sync storage", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText("Rewrite"))
    await user.click(screen.getByText("Rewrite"))
    await user.selectOptions(screen.getByRole("combobox", { name: /rewrite-intent/i }), "concise")
    const sync = await chrome.storage.sync.get(["rewriteIntent"])
    expect(sync.rewriteIntent).toBe("concise")
  })

  it("loads checkMode from sync storage on mount", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ checkMode: "improve" })
    render(<Popup />)
    await waitFor(() => screen.getByText("Improve"))
    expect(screen.getByText("Improve").closest("button")).toHaveClass("selected")
  })

  it("loads rewriteIntent from sync storage and shows sub-intent select", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ checkMode: "rewrite", rewriteIntent: "friendly" })
    render(<Popup />)
    await waitFor(() => screen.getByDisplayValue("Friendly"))
    expect(screen.getByDisplayValue("Friendly")).toBeInTheDocument()
  })
})

// ─── Floating button toggle ────────────────────────────────────────────────

describe("floating button toggle", () => {
  // Scope queries to the floating-button row — passive mode adds another
  // On/Off mode-strip with the same accessible names.
  function floatingRow(): HTMLElement {
    const label = screen.getByText(/floating button/i)
    const row = label.parentElement
    if (!row) throw new Error("floating button row not found")
    return row
  }

  it("renders the toggle in the normal settings view, defaulting to On", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByText(/floating button/i))

    const onBtn = within(floatingRow()).getByRole("button", { name: "On" })
    const offBtn = within(floatingRow()).getByRole("button", { name: "Off" })
    expect(onBtn).toHaveClass("selected")
    expect(offBtn).not.toHaveClass("selected")
  })

  it("clicking Off saves showFloatingButton: false to sync storage", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText(/floating button/i))

    await user.click(within(floatingRow()).getByRole("button", { name: "Off" }))

    const sync = await chrome.storage.sync.get(["showFloatingButton"])
    expect(sync.showFloatingButton).toBe(false)
    expect(within(floatingRow()).getByRole("button", { name: "Off" })).toHaveClass("selected")
  })

  it("loads showFloatingButton from sync storage on mount", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ showFloatingButton: false })
    render(<Popup />)
    await waitFor(() => screen.getByText(/floating button/i))

    expect(within(floatingRow()).getByRole("button", { name: "Off" })).toHaveClass("selected")
    expect(within(floatingRow()).getByRole("button", { name: "On" })).not.toHaveClass("selected")
  })

  it("clicking On after Off restores the preference", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ showFloatingButton: false })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByText(/floating button/i))

    await user.click(within(floatingRow()).getByRole("button", { name: "On" }))

    const sync = await chrome.storage.sync.get(["showFloatingButton"])
    expect(sync.showFloatingButton).toBe(true)
  })
})

// ─── Tab nav (Settings / Insights) ─────────────────────────────────────────

describe("popup tab nav", () => {
  it("renders both tabs in the normal view", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByRole("button", { name: /^settings$/i }))

    expect(screen.getByRole("button", { name: /^settings$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^insights$/i })).toBeInTheDocument()
  })

  it("defaults to the Settings tab on first load", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    render(<Popup />)
    await waitFor(() => screen.getByRole("button", { name: /^settings$/i }))

    expect(screen.getByRole("button", { name: /^settings$/i })).toHaveClass("selected")
    expect(screen.getByRole("button", { name: /^insights$/i })).not.toHaveClass("selected")
    // Settings content visible
    expect(screen.getByText(/native language/i)).toBeInTheDocument()
  })

  it("restores the last-selected tab from chrome.storage.sync on mount", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ popupTab: "insights" })
    render(<Popup />)
    await waitFor(() => screen.getByRole("button", { name: /^insights$/i }))

    expect(screen.getByRole("button", { name: /^insights$/i })).toHaveClass("selected")
    // Insights content visible (window-toggle label)
    expect(screen.getByText(/time window/i)).toBeInTheDocument()
  })

  it("clicking a tab persists the choice to chrome.storage.sync", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    const user = userEvent.setup()
    render(<Popup />)
    await waitFor(() => screen.getByRole("button", { name: /^insights$/i }))

    await user.click(screen.getByRole("button", { name: /^insights$/i }))

    const sync = await chrome.storage.sync.get(["popupTab"])
    expect(sync.popupTab).toBe("insights")
    expect(screen.getByRole("button", { name: /^insights$/i })).toHaveClass("selected")
  })

  it("ignores invalid popupTab values in storage and falls back to Settings", async () => {
    await chrome.storage.local.set({ hasOnboarded: true })
    await chrome.storage.sync.set({ popupTab: "garbage-tab-name" })
    render(<Popup />)
    await waitFor(() => screen.getByRole("button", { name: /^settings$/i }))

    expect(screen.getByRole("button", { name: /^settings$/i })).toHaveClass("selected")
  })
})
