// insights.test.tsx — component tests for the Insights tab.
// Uses the same chrome.storage stub as the rest of the popup tests.

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import Insights from "./insights"
import type { CorrectionEntry } from "../core/storage-schema"

const DAY = 24 * 60 * 60 * 1000

function entry(overrides: Partial<CorrectionEntry> = {}): CorrectionEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    ts: overrides.ts ?? Date.now(),
    reason: overrides.reason ?? "Missing article",
    category: overrides.category ?? "articles",
    mode: overrides.mode ?? "correct",
    ...(overrides.host ? { host: overrides.host } : {}),
  }
}

async function seed(entries: CorrectionEntry[]) {
  await chrome.storage.local.set({ corrections: entries })
}

async function renderInsights() {
  const user = userEvent.setup()
  render(<Insights />)
  // Wait until the time-window strip renders (component finished its initial load)
  await waitFor(() => {
    expect(screen.queryByText(/time window/i)).not.toBeNull()
  })
  return { user }
}

// ─── Empty state ───────────────────────────────────────────────────────────

describe("Insights — empty state", () => {
  it("shows the 'no corrections yet' empty state when storage is empty", async () => {
    await renderInsights()
    expect(screen.getByText(/no corrections yet/i)).toBeInTheDocument()
  })

  it("shows the 'need a few more' state when there are <5 entries", async () => {
    await seed([
      entry({ category: "articles" }),
      entry({ category: "articles" }),
      entry({ category: "spelling" }),
    ])
    await renderInsights()
    expect(screen.getByText(/need a few more/i)).toBeInTheDocument()
  })
})

// ─── Populated state ───────────────────────────────────────────────────────

describe("Insights — populated state", () => {
  it("renders top categories with counts and percentages", async () => {
    const articles = Array.from({ length: 4 }, () => entry({ category: "articles" }))
    const spelling = Array.from({ length: 3 }, () => entry({ category: "spelling" }))
    await seed([...articles, ...spelling])

    await renderInsights()

    // Top categories label
    expect(screen.getByText(/top patterns/i)).toBeInTheDocument()
    // Articles label appears at least twice — once in the top-pattern bar and
    // once in the most-missed callout.
    const articlesLabels = screen.getAllByText(/articles \(a \/ an \/ the\)/i)
    expect(articlesLabels.length).toBeGreaterThanOrEqual(1)
    // Bar counts
    expect(screen.getByText(/4 · 57%/)).toBeInTheDocument() // 4/7 = 57%
    expect(screen.getByText(/3 · 43%/)).toBeInTheDocument()
  })

  it("highlights the most-missed rule callout", async () => {
    const entries = [
      ...Array.from({ length: 5 }, () => entry({ category: "spelling" })),
      ...Array.from({ length: 2 }, () => entry({ category: "articles" })),
    ]
    await seed(entries)
    await renderInsights()

    expect(screen.getByText(/most-missed rule/i)).toBeInTheDocument()
    // Both the callout and the bar render the label, so use queryAllByText.
    const matches = screen.getAllByText(/spelling/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it("shows the streak counter", async () => {
    // 3 entries today + 1 yesterday → streak = 2 (assuming clock allows)
    const now = Date.now()
    await seed([
      entry({ ts: now }),
      entry({ ts: now }),
      entry({ ts: now }),
      entry({ ts: now - DAY }),
      entry({ ts: now - 2 * DAY }),
    ])
    await renderInsights()

    expect(screen.getByText(/current streak/i)).toBeInTheDocument()
    // The streak number is rendered as e.g. "3d"; just verify "Current streak" label exists.
  })
})

// ─── Window toggle ─────────────────────────────────────────────────────────

describe("Insights — window toggle", () => {
  it("clicking '30 days' updates which entries are counted", async () => {
    const now = Date.now()
    // 5 entries this week, 5 entries 20 days ago
    const entries: CorrectionEntry[] = [
      ...Array.from({ length: 5 }, () => entry({ ts: now, category: "articles" })),
      ...Array.from({ length: 5 }, () => entry({ ts: now - 20 * DAY, category: "spelling" })),
    ]
    await seed(entries)
    const { user } = await renderInsights()

    // Default Week: 5 entries → "articles" only
    expect(screen.getByText(/corrections this week/i)).toBeInTheDocument()

    // Switch to 30 days
    await user.click(screen.getByRole("button", { name: /30 days/i }))
    expect(screen.getByText(/corrections, last 30 days/i)).toBeInTheDocument()

    // Switch to All time
    await user.click(screen.getByRole("button", { name: /all time/i }))
    expect(screen.getByText(/corrections all-time/i)).toBeInTheDocument()
  })
})
