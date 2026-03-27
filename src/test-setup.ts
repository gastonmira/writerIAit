import "@testing-library/jest-dom"

// ─── Chrome API mock ──────────────────────────────────────────────────────
// Minimal stub that covers what the Popup component uses.

const localStore: Record<string, unknown> = {}
const syncStore: Record<string, unknown> = {}

const makeStorage = (store: Record<string, unknown>) => ({
  get: (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys]
    const result: Record<string, unknown> = {}
    for (const k of ks) result[k] = store[k]
    return Promise.resolve(result)
  },
  set: (items: Record<string, unknown>) => {
    Object.assign(store, items)
    return Promise.resolve()
  },
})

;(globalThis as unknown as Record<string, unknown>).chrome = {
  storage: {
    local: makeStorage(localStore),
    sync: makeStorage(syncStore),
  },
  runtime: {
    getManifest: () => ({ version: "0.1.0" }),
  },
}

// Reset stores between tests
beforeEach(() => {
  for (const k of Object.keys(localStore)) delete localStore[k]
  for (const k of Object.keys(syncStore)) delete syncStore[k]
})
