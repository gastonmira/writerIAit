// popup/insights.tsx — Insights tab
// Reads corrections[] from chrome.storage.local; live-updates on storage.onChanged.

import { useEffect, useState } from "react"
import { CATEGORY_LABEL } from "../core/categories"
import {
  computeInsights,
  getEntries,
  type CorrectionEntry,
  type Insights as InsightsData,
  type InsightsWindow,
} from "../core/storage-schema"

const WINDOW_LABEL: Record<InsightsWindow, string> = {
  week: "Week",
  month: "30 days",
  all: "All time",
}

const WINDOWS: InsightsWindow[] = ["week", "month", "all"]

const MIN_ENTRIES_FOR_PATTERNS = 5

export default function Insights() {
  const [entries, setEntries] = useState<CorrectionEntry[] | null>(null)
  const [window, setWindow] = useState<InsightsWindow>("week")

  useEffect(() => {
    let mounted = true
    getEntries().then(e => { if (mounted) setEntries(e) })

    const onChanged = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== "local" || !("corrections" in changes)) return
      const next = changes.corrections.newValue
      if (Array.isArray(next)) setEntries(next as CorrectionEntry[])
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  if (entries === null) {
    return <div className="insights-wrap" />
  }

  const insights = computeInsights(entries, window)

  return (
    <div className="insights-wrap">

      {/* Window toggle */}
      <div>
        <label>Time window</label>
        <div className="mode-strip">
          {WINDOWS.map(w => (
            <button
              key={w}
              className={`mode-btn${window === w ? " selected" : ""}`}
              onClick={() => setWindow(w)}
            >
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>
      </div>

      {insights.total < MIN_ENTRIES_FOR_PATTERNS ? (
        <EmptyState window={window} total={insights.total} />
      ) : (
        <Populated insights={insights} window={window} />
      )}

      <InsightsStyles />
    </div>
  )
}

// ─── Populated view ────────────────────────────────────────────────────────

function Populated({
  insights,
  window,
}: {
  insights: InsightsData
  window: InsightsWindow
}) {
  const { total, topCategories, weekDelta, streakDays, mostMissed } = insights

  return (
    <>
      <div className="insights-stats-row">
        <div className="insights-stat">
          <div className="insights-stat-num">{total}</div>
          <div className="insights-stat-lbl">
            {window === "week"
              ? "Corrections this week"
              : window === "month"
              ? "Corrections, last 30 days"
              : "Corrections all-time"}
          </div>
        </div>

        <div className="insights-stat">
          <div className="insights-stat-num">
            {streakDays}<span className="insights-stat-unit">d</span>
          </div>
          <div className="insights-stat-lbl">Current streak</div>
        </div>
      </div>

      {window === "week" && weekDelta !== 0 && (
        <div className={`insights-delta ${weekDelta > 0 ? "up" : "down"}`}>
          {weekDelta > 0 ? "↑" : "↓"} {Math.abs(weekDelta)} vs last week
        </div>
      )}

      {mostMissed && (
        <div className="insights-callout">
          <div className="insights-callout-label">Most-missed rule</div>
          <div className="insights-callout-body">{CATEGORY_LABEL[mostMissed]}</div>
        </div>
      )}

      <div>
        <label>Top patterns</label>
        <div className="insights-bars">
          {topCategories.map(c => (
            <div key={c.category} className="insights-bar">
              <div className="insights-bar-head">
                <span className="insights-bar-label">{CATEGORY_LABEL[c.category]}</span>
                <span className="insights-bar-count">{c.count} · {c.pct}%</span>
              </div>
              <div className="insights-bar-track">
                <div className="insights-bar-fill" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ window, total }: { window: InsightsWindow; total: number }) {
  return (
    <div className="insights-empty">
      <div className="insights-empty-icon">📊</div>
      <div className="insights-empty-title">
        {total === 0 ? "No corrections yet" : "Need a few more"}
      </div>
      <div className="insights-empty-body">
        {window === "week"
          ? "Keep using writerIAit. Your patterns will appear here once you have a few corrections this week."
          : window === "month"
          ? "Patterns appear once you have at least five corrections in this window."
          : "Make a few corrections and your insights will start to take shape here."}
      </div>
    </div>
  )
}

// ─── Styles (scoped to popup CSS variables) ────────────────────────────────

function InsightsStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .insights-wrap {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .insights-stats-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .insights-stat {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 10px 12px;
      }

      .insights-stat-num {
        font-size: 22px;
        font-weight: 600;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .insights-stat-unit {
        font-size: 13px;
        color: var(--text-secondary);
        font-weight: 500;
        margin-left: 2px;
      }

      .insights-stat-lbl {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 6px;
      }

      .insights-delta {
        font-size: 12px;
        color: var(--text-secondary);
      }
      .insights-delta.up   { color: var(--success); }
      .insights-delta.down { color: var(--error); }

      .insights-callout {
        background: var(--surface);
        border: 1px solid var(--border);
        border-left: 3px solid var(--accent);
        border-radius: var(--radius-md);
        padding: 10px 12px;
      }

      .insights-callout-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
        font-weight: 500;
      }

      .insights-callout-body {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        margin-top: 4px;
      }

      .insights-bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .insights-bar-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }

      .insights-bar-label {
        font-size: 12px;
        color: var(--text-primary);
        font-weight: 500;
      }

      .insights-bar-count {
        font-size: 11px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .insights-bar-track {
        height: 6px;
        background: var(--border);
        border-radius: 999px;
        overflow: hidden;
      }

      .insights-bar-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 999px;
        transition: width 200ms ease;
      }

      .insights-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 20px 8px 8px;
        text-align: center;
      }

      .insights-empty-icon {
        font-size: 28px;
      }

      .insights-empty-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .insights-empty-body {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
        max-width: 280px;
      }
    ` }} />
  )
}
