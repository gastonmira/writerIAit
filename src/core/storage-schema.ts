import { type Category } from "./categories"
import { categorizeLocally } from "./categorization"

export interface CorrectionEntry {
  id: string
  ts: number
  reason: string
  category: Category
  mode: "correct" | "improve" | "rewrite"
  host?: string
}

export type InsightsWindow = "week" | "month" | "all"

export interface Insights {
  total: number
  topCategories: Array<{ category: Category; count: number; pct: number }>
  weekDelta: number
  streakDays: number
  mostMissed: Category | null
}

const STORAGE_KEY = "corrections"
const MAX_ENTRIES = 1000

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS

// ─── Read / write entries ───────────────────────────────────────────────────

async function readEntries(): Promise<CorrectionEntry[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const arr = stored[STORAGE_KEY]
  return Array.isArray(arr) ? (arr as CorrectionEntry[]) : []
}

async function writeEntries(entries: CorrectionEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: entries.slice(-MAX_ENTRIES) })
}

export async function recordCorrection(
  reason: string,
  mode: CorrectionEntry["mode"],
  host?: string,
): Promise<CorrectionEntry> {
  await migrateLegacyReasons()
  const entry: CorrectionEntry = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    reason,
    category: categorizeLocally(reason),
    mode,
    ...(host ? { host } : {}),
  }
  const existing = await readEntries()
  await writeEntries([...existing, entry])
  return entry
}

export async function updateEntryCategory(id: string, category: Category): Promise<void> {
  const entries = await readEntries()
  const idx = entries.findIndex(e => e.id === id)
  if (idx === -1) return
  entries[idx] = { ...entries[idx], category }
  await writeEntries(entries)
}

export async function getEntries(): Promise<CorrectionEntry[]> {
  return readEntries()
}

// ─── Migration from legacy schema ───────────────────────────────────────────
// Legacy keys: reasons[], correctionsThisWeek, weekStart.
// Idempotent — safe to call from multiple entry points.

export async function migrateLegacyReasons(): Promise<void> {
  const stored = await chrome.storage.local.get([
    "reasons",
    "weekStart",
    "correctionsThisWeek",
    STORAGE_KEY,
  ])
  const legacyReasons = (stored.reasons as string[] | undefined) ?? []
  const hasAnyLegacyKey =
    "reasons" in stored || "weekStart" in stored || "correctionsThisWeek" in stored

  if (legacyReasons.length === 0) {
    if (hasAnyLegacyKey) {
      await chrome.storage.local.remove(["reasons", "weekStart", "correctionsThisWeek"])
    }
    return
  }

  const ts = (stored.weekStart as number | undefined) ?? Date.now()
  const existing =
    (stored[STORAGE_KEY] as CorrectionEntry[] | undefined) ?? []
  const migrated: CorrectionEntry[] = legacyReasons.map(reason => ({
    id: crypto.randomUUID(),
    ts,
    reason,
    category: categorizeLocally(reason),
    mode: "correct",
  }))
  await writeEntries([...existing, ...migrated])
  await chrome.storage.local.remove(["reasons", "weekStart", "correctionsThisWeek"])
}

// ─── Insights computation (pure) ────────────────────────────────────────────

export function computeInsights(
  entries: CorrectionEntry[],
  window: InsightsWindow,
  now: number = Date.now(),
): Insights {
  const cutoff =
    window === "week" ? now - WEEK_MS : window === "month" ? now - MONTH_MS : 0
  const inWindow = entries.filter(e => e.ts >= cutoff)
  const total = inWindow.length

  // Counts per category
  const counts = new Map<Category, number>()
  for (const e of inWindow) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)

  const topCategories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({
      category,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

  const mostMissed = topCategories.length > 0 ? topCategories[0].category : null

  // Week delta = thisWeek - previousWeek (only meaningful for the "week" window)
  const thisWeekCount = entries.filter(e => e.ts >= now - WEEK_MS).length
  const lastWeekCount = entries.filter(
    e => e.ts >= now - 2 * WEEK_MS && e.ts < now - WEEK_MS,
  ).length
  const weekDelta = thisWeekCount - lastWeekCount

  // Streak: consecutive days ending today (local time) with ≥1 correction.
  const streakDays = computeStreak(entries, now)

  return { total, topCategories, weekDelta, streakDays, mostMissed }
}

function computeStreak(entries: CorrectionEntry[], now: number): number {
  if (entries.length === 0) return 0
  const days = new Set<string>()
  for (const e of entries) days.add(new Date(e.ts).toDateString())
  let streak = 0
  const cursor = new Date(now)
  while (days.has(cursor.toDateString())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
