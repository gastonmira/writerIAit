// Loads en.aff + en.dic from the bundled extension assets and memoizes the
// resulting nspell instance for the content-script lifetime. 100% local — no
// network — no LLM. Dictionary files live in public/dictionaries/ and are
// declared in web_accessible_resources so the content script can fetch them
// from the extension origin via chrome.runtime.getURL.

import nspell from "nspell"

type NSpell = ReturnType<typeof nspell>

let cached: Promise<NSpell> | null = null

export function getSpell(): Promise<NSpell> {
  if (cached) return cached
  cached = (async () => {
    const affUrl = chrome.runtime.getURL("dictionaries/en.aff")
    const dicUrl = chrome.runtime.getURL("dictionaries/en.dic")
    const [aff, dic] = await Promise.all([
      fetch(affUrl).then((r) => r.text()),
      fetch(dicUrl).then((r) => r.text())
    ])
    return nspell(aff, dic)
  })()
  return cached
}

export function _resetSpellCache(): void {
  cached = null
}
