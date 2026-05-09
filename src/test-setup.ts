import "@testing-library/jest-dom"
import { vi } from "vitest"

// ─── Chrome API mock ──────────────────────────────────────────────────────
// Minimal stub that covers what the Popup component and content script use.

const localStore: Record<string, unknown> = {}
const syncStore: Record<string, unknown> = {}

const makeStorage = (store: Record<string, unknown>) => ({
  get: (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys]
    const result: Record<string, unknown> = {}
    // Match real chrome.storage behavior: only include keys that are present.
    for (const k of ks) if (k in store) result[k] = store[k]
    return Promise.resolve(result)
  },
  set: (items: Record<string, unknown>) => {
    Object.assign(store, items)
    return Promise.resolve()
  },
  remove: (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys]
    for (const k of ks) delete store[k]
    return Promise.resolve()
  },
})

;(globalThis as unknown as Record<string, unknown>).chrome = {
  storage: {
    local: makeStorage(localStore),
    sync: makeStorage(syncStore),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    getManifest: () => ({ version: "0.1.0" }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn().mockResolvedValue({ corrections: [] }),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  action: {
    setIcon: vi.fn().mockResolvedValue(undefined),
  },
  commands: {
    onCommand: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}

// Reset stores between tests
beforeEach(() => {
  for (const k of Object.keys(localStore)) delete localStore[k]
  for (const k of Object.keys(syncStore)) delete syncStore[k]
})
