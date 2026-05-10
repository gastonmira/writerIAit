// storage-schema.test.ts — schema, migration, and pure insights helpers.
// The chrome.storage stub from src/test-setup.ts gives us an in-memory
// store with the same get/set/remove signatures. Stores reset between tests.

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  recordCorrection,
  updateEntryCategory,
  migrateLegacyReasons,
  computeInsights,
  getEntries,
  incrementAutoFix,
  getAutoFixesCount,
  type CorrectionEntry,
} from "./storage-schema"

// Helpers: read storage directly
async function getStored(key: string): Promise<unknown> {
  const out = await chrome.storage.local.get(key)
  return out[key]
}

const DAY = 24 * 60 * 60 * 1000

// Build CorrectionEntry fixtures
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

// ─── recordCorrection ──────────────────────────────────────────────────────

describe("recordCorrection", () => {
  it("writes a CorrectionEntry with id, ts, regex category, mode, and host", async () => {
    const before = Date.now()
    const e = await recordCorrection("Missing article 'the'", "correct", "mail.google.com")
    const after = Date.now()

    expect(typeof e.id).toBe("string")
    expect(e.id.length).toBeGreaterThan(0)
    expect(e.ts).toBeGreaterThanOrEqual(before)
    expect(e.ts).toBeLessThanOrEqual(after)
    expect(e.reason).toBe("Missing article 'the'")
    expect(e.category).toBe("articles")
    expect(e.mode).toBe("correct")
    expect(e.host).toBe("mail.google.com")

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(e.id)
  })

  it("appends to an existing array of entries", async () => {
    await recordCorrection("Missing article", "correct")
    await recordCorrection("Wrong tense", "improve")
    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(2)
    expect(stored.map(e => e.category)).toEqual(["articles", "tense"])
  })

  it("omits host when not provided", async () => {
    const e = await recordCorrection("typo", "correct")
    expect(e.host).toBeUndefined()
    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect("host" in stored[0]).toBe(false)
  })

  it("trims to MAX_ENTRIES (1000) — keeps the most recent", async () => {
    // Pre-seed with 1000 entries; insert 2 more; oldest 2 get dropped.
    const seed: CorrectionEntry[] = Array.from({ length: 1000 }, (_, i) =>
      entry({ id: `seed-${i}`, ts: i, reason: `seed reason ${i}` })
    )
    await chrome.storage.local.set({ corrections: seed })

    await recordCorrection("first new", "correct")
    await recordCorrection("second new", "correct")

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(1000)
    // The oldest two seed entries should have been dropped.
    expect(stored.find(e => e.id === "seed-0")).toBeUndefined()
    expect(stored.find(e => e.id === "seed-1")).toBeUndefined()
    // seed-2 is the new oldest.
    expect(stored[0].id).toBe("seed-2")
    // The newest two are the ones we just inserted.
    expect(stored[stored.length - 2].reason).toBe("first new")
    expect(stored[stored.length - 1].reason).toBe("second new")
  })
})

// ─── updateEntryCategory ───────────────────────────────────────────────────

describe("updateEntryCategory", () => {
  it("updates the matching entry's category in place", async () => {
    const e = await recordCorrection("Missing article", "correct")
    expect(e.category).toBe("articles")

    await updateEntryCategory(e.id, "spelling")

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(1)
    expect(stored[0].category).toBe("spelling")
    // Other fields preserved.
    expect(stored[0].id).toBe(e.id)
    expect(stored[0].reason).toBe("Missing article")
  })

  it("is a no-op when the id is not found (no error, no write)", async () => {
    await recordCorrection("Missing article", "correct")
    await updateEntryCategory("nonexistent-id", "spelling")
    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(1)
    expect(stored[0].category).toBe("articles") // unchanged
  })
})

// ─── migrateLegacyReasons ──────────────────────────────────────────────────

describe("migrateLegacyReasons", () => {
  it("migrates legacy reasons[] into corrections[] with regex categories", async () => {
    const weekStart = Date.now() - 3 * DAY
    await chrome.storage.local.set({
      reasons: ["Missing article", "Wrong tense", "Spelling: typo"],
      weekStart,
      correctionsThisWeek: 3,
    })

    await migrateLegacyReasons()

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(3)
    expect(stored.map(e => e.category)).toEqual(["articles", "tense", "spelling"])
    expect(stored.every(e => e.ts === weekStart)).toBe(true)
    expect(stored.every(e => e.mode === "correct")).toBe(true)
    expect(stored.every(e => typeof e.id === "string")).toBe(true)
  })

  it("removes the 3 legacy keys after migration", async () => {
    await chrome.storage.local.set({
      reasons: ["Missing article"],
      weekStart: 1000,
      correctionsThisWeek: 1,
    })

    await migrateLegacyReasons()

    const after = await chrome.storage.local.get([
      "reasons", "weekStart", "correctionsThisWeek",
    ])
    expect(after.reasons).toBeUndefined()
    expect(after.weekStart).toBeUndefined()
    expect(after.correctionsThisWeek).toBeUndefined()
  })

  it("is idempotent — second call is a pure no-op", async () => {
    await chrome.storage.local.set({
      reasons: ["Missing article"],
      weekStart: 1000,
    })

    await migrateLegacyReasons()
    const afterFirst = (await getStored("corrections")) as CorrectionEntry[]
    expect(afterFirst).toHaveLength(1)

    await migrateLegacyReasons()
    const afterSecond = (await getStored("corrections")) as CorrectionEntry[]
    expect(afterSecond).toHaveLength(1)
    expect(afterSecond[0].id).toBe(afterFirst[0].id) // not duplicated
  })

  it("cleans up scalar legacy keys when reasons[] is empty/missing", async () => {
    await chrome.storage.local.set({
      weekStart: 1000,
      correctionsThisWeek: 0,
    })

    await migrateLegacyReasons()

    const after = await chrome.storage.local.get(["weekStart", "correctionsThisWeek"])
    expect(after.weekStart).toBeUndefined()
    expect(after.correctionsThisWeek).toBeUndefined()
    // No corrections written either.
    expect(await getStored("corrections")).toBeUndefined()
  })

  it("preserves existing corrections[] entries when migrating", async () => {
    const existingId = "existing-1"
    await chrome.storage.local.set({
      corrections: [entry({ id: existingId, ts: 9000, reason: "existing", category: "spelling" })],
      reasons: ["Missing article"],
      weekStart: 1000,
    })

    await migrateLegacyReasons()

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(2)
    expect(stored.find(e => e.id === existingId)).toBeDefined()
  })

  it("falls back to Date.now() for ts when weekStart is missing", async () => {
    const before = Date.now()
    await chrome.storage.local.set({ reasons: ["Missing article"] })
    await migrateLegacyReasons()
    const after = Date.now()

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored[0].ts).toBeGreaterThanOrEqual(before)
    expect(stored[0].ts).toBeLessThanOrEqual(after)
  })

  it("sequential migration calls do not duplicate after the first run", async () => {
    // The race window flagged by QA (popup + overlay calling concurrently on
    // first upgrade) cannot be reproduced in this synchronous in-memory stub —
    // both calls run effectively serialized. This test pins the SEQUENTIAL
    // behavior we depend on: after the first call removes the legacy keys,
    // any later call is a no-op. The real race (concurrent reads against
    // chrome IPC) is documented in gastflow_state.json `coverage_notes`.
    await chrome.storage.local.set({
      reasons: ["Missing article", "Wrong tense"],
      weekStart: 1000,
    })

    await migrateLegacyReasons()
    await migrateLegacyReasons()
    await migrateLegacyReasons()

    const stored = (await getStored("corrections")) as CorrectionEntry[]
    expect(stored).toHaveLength(2)
  })
})

// ─── computeInsights ───────────────────────────────────────────────────────

describe("computeInsights", () => {
  const NOW = Date.parse("2026-05-09T12:00:00Z")

  function ts(daysAgo: number): number {
    return NOW - daysAgo * DAY
  }

  it("returns zeroes on an empty entry list", () => {
    const out = computeInsights([], "week", NOW)
    expect(out).toEqual({
      total: 0,
      topCategories: [],
      weekDelta: 0,
      streakDays: 0,
      mostMissed: null,
    })
  })

  it("week window only counts entries from the last 7 days", () => {
    const entries: CorrectionEntry[] = [
      entry({ ts: ts(1), category: "articles" }),
      entry({ ts: ts(3), category: "articles" }),
      entry({ ts: ts(10), category: "spelling" }), // outside week
    ]
    const out = computeInsights(entries, "week", NOW)
    expect(out.total).toBe(2)
    expect(out.topCategories).toEqual([{ category: "articles", count: 2, pct: 100 }])
  })

  it("month window counts entries from the last 30 days", () => {
    const entries: CorrectionEntry[] = [
      entry({ ts: ts(1), category: "articles" }),
      entry({ ts: ts(20), category: "spelling" }),
      entry({ ts: ts(40), category: "tense" }), // outside 30d
    ]
    const out = computeInsights(entries, "month", NOW)
    expect(out.total).toBe(2)
  })

  it("all window has no cutoff", () => {
    const entries: CorrectionEntry[] = [
      entry({ ts: ts(1) }),
      entry({ ts: ts(60) }),
      entry({ ts: ts(365) }),
    ]
    const out = computeInsights(entries, "all", NOW)
    expect(out.total).toBe(3)
  })

  it("topCategories is sorted by count desc, sliced to 3", () => {
    const entries: CorrectionEntry[] = [
      ...Array.from({ length: 5 }, () => entry({ ts: ts(1), category: "articles" })),
      ...Array.from({ length: 3 }, () => entry({ ts: ts(1), category: "spelling" })),
      ...Array.from({ length: 2 }, () => entry({ ts: ts(1), category: "tense" })),
      entry({ ts: ts(1), category: "punctuation" }),
    ]
    const out = computeInsights(entries, "week", NOW)
    expect(out.topCategories.map(c => c.category)).toEqual(["articles", "spelling", "tense"])
    expect(out.topCategories[0].pct).toBe(45) // 5/11 ≈ 0.4545 → 45 (rounded)
  })

  it("mostMissed is the top category in the window", () => {
    const entries: CorrectionEntry[] = [
      ...Array.from({ length: 4 }, () => entry({ ts: ts(1), category: "spelling" })),
      ...Array.from({ length: 2 }, () => entry({ ts: ts(1), category: "articles" })),
    ]
    const out = computeInsights(entries, "week", NOW)
    expect(out.mostMissed).toBe("spelling")
  })

  it("weekDelta = thisWeek - lastWeek", () => {
    const entries: CorrectionEntry[] = [
      // This week: 5 entries
      ...Array.from({ length: 5 }, (_, i) => entry({ ts: ts(i % 7), category: "articles" })),
      // Last week: 2 entries (between 7 and 14 days ago)
      entry({ ts: ts(8), category: "articles" }),
      entry({ ts: ts(10), category: "articles" }),
    ]
    const out = computeInsights(entries, "week", NOW)
    expect(out.weekDelta).toBe(3)
  })
})

// ─── computeStreak (via computeInsights — module-private otherwise) ────────

describe("streak (computed via computeInsights)", () => {
  it("returns 0 when there are no entries today", () => {
    const NOW = Date.parse("2026-05-09T12:00:00Z")
    const entries = [entry({ ts: NOW - DAY })] // yesterday only
    const out = computeInsights(entries, "all", NOW)
    expect(out.streakDays).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    const NOW = Date.parse("2026-05-09T12:00:00Z")
    const entries: CorrectionEntry[] = [
      entry({ ts: NOW }),
      entry({ ts: NOW - DAY }),
      entry({ ts: NOW - 2 * DAY }),
    ]
    const out = computeInsights(entries, "all", NOW)
    expect(out.streakDays).toBe(3)
  })

  it("breaks at the first day without entries", () => {
    const NOW = Date.parse("2026-05-09T12:00:00Z")
    const entries: CorrectionEntry[] = [
      entry({ ts: NOW }),
      entry({ ts: NOW - DAY }),
      // Gap: nothing on NOW - 2*DAY
      entry({ ts: NOW - 3 * DAY }),
    ]
    const out = computeInsights(entries, "all", NOW)
    expect(out.streakDays).toBe(2)
  })

  it("returns 0 on empty entries", () => {
    expect(computeInsights([], "all", Date.now()).streakDays).toBe(0)
  })
})

// ─── getEntries — sanity ───────────────────────────────────────────────────

describe("getEntries", () => {
  it("returns [] when nothing is stored", async () => {
    expect(await getEntries()).toEqual([])
  })

  it("returns the stored array", async () => {
    const e = await recordCorrection("Missing article", "correct")
    const all = await getEntries()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(e.id)
  })
})

// ─── incrementAutoFix / getAutoFixesCount (AC7 stats isolation) ────────────

describe("incrementAutoFix", () => {
  it("returns 1 when the counter is absent", async () => {
    expect(await incrementAutoFix()).toBe(1)
  })

  it("bumps by 1 on each call", async () => {
    expect(await incrementAutoFix()).toBe(1)
    expect(await incrementAutoFix()).toBe(2)
    expect(await incrementAutoFix()).toBe(3)
  })

  it("persists to chrome.storage.local under the autoFixesCount key", async () => {
    await incrementAutoFix()
    await incrementAutoFix()
    const stored = await chrome.storage.local.get("autoFixesCount")
    expect(stored.autoFixesCount).toBe(2)
  })

  it("does NOT touch the corrections array (AC7 stats isolation)", async () => {
    await recordCorrection("Missing article", "correct")
    const before = await getEntries()
    await incrementAutoFix()
    await incrementAutoFix()
    const after = await getEntries()
    expect(after).toEqual(before)
  })
})

describe("getAutoFixesCount", () => {
  it("returns 0 when the counter is absent", async () => {
    expect(await getAutoFixesCount()).toBe(0)
  })

  it("returns the stored value", async () => {
    await chrome.storage.local.set({ autoFixesCount: 42 })
    expect(await getAutoFixesCount()).toBe(42)
  })
})
