/**
 * Pure planning for tool description overrides, so the Host's actions only apply what is decided here.
 *
 * An override replaces the `description` string of one tool in one mode. It never changes the tool's
 * definition: removing the override gives back the built-in text exactly. The Host stores overrides per mode as
 * `{ text, base }`, where `base` is the built-in text at the time of the edit; a later built-in text that differs
 * marks the override as outdated.
 */

/** Longest accepted description, in characters; matches the prompt limit. */
export const TOOL_DESCRIPTION_MAX_CHARS = 20000
/** Changes kept per mode in the stored history. */
export const TOOL_HISTORY_LIMIT = 100
/** Earlier versions listed per tool and mode. */
export const PREVIOUS_VERSIONS = 5
/** The tool names the Host accepts: the model-facing name syntax of the shipped tools. */
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/

/**
 * @typedef {{ text: string, base?: string }} Override
 * @typedef {{ editable: boolean, ptc: boolean, tools: Map<string, string | undefined> }} ModeTools
 *   One mode's tools: each name maps to its built-in text, or `undefined` when only an override remembers it.
 * @typedef {{ preset: string, tool: string, status: string }} Result
 */

/**
 * Check one description text.
 * @param {unknown} text - the proposed description.
 * @returns {{ ok: true, text: string } | { ok: false, code: string, max?: number }} the text with line breaks normalized, or why it is refused.
 */
export function checkText(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, code: 'tool-text-empty' }
  const normalized = text.replace(/\r\n?/g, '\n')
  if (normalized.length > TOOL_DESCRIPTION_MAX_CHARS) return { ok: false, code: 'tool-text-too-long', max: TOOL_DESCRIPTION_MAX_CHARS }
  return { ok: true, text: normalized }
}

/**
 * Decide a batch of description edits across modes.
 * @param {object} input - the batch and the state it is judged against.
 * @param {unknown} input.edits - `{ preset, tool, text, expected? }` items; `expected` is the override text the editor
 *   saw for that mode (`null` for none), and a stored override that differs refuses the item as `conflict`.
 * @param {Map<string, ModeTools>} input.presets - the catalog of every mode.
 * @param {Map<string, Map<string, Override>>} input.overrides - the stored overrides per mode.
 * @returns {{ results: Result[], writes: Map<string, Map<string, Override | null>> }} one result per item, and the
 *   changes to store: `null` removes an override. Statuses: `saved`, `unchanged`, `restored` (the text equals the
 *   built-in text, so the override is dropped), `conflict`, `unknown-preset`, `unknown-tool`, `ptc`, `not-editable`, `invalid`.
 */
export function planEdits({ edits, presets, overrides }) {
  const results = []
  const writes = new Map()
  const working = new Map()
  const current = (preset, tool) => (working.get(preset)?.has(tool) ? working.get(preset).get(tool) : overrides.get(preset)?.get(tool)) ?? undefined
  for (const edit of Array.isArray(edits) ? edits : []) {
    const preset = String(edit?.preset)
    const tool = String(edit?.tool)
    const done = (status, extra) => results.push({ preset, tool, status, ...extra })
    const mode = presets.get(preset)
    if (mode === undefined) { done('unknown-preset'); continue }
    if (!TOOL_NAME.test(tool)) { done('invalid', { code: 'tool-name-invalid' }); continue }
    if (mode.ptc) { done('ptc'); continue }
    if (!mode.editable) { done('not-editable'); continue }
    if (!mode.tools.has(tool)) { done('unknown-tool'); continue }
    const checked = checkText(edit?.text)
    if (!checked.ok) { done('invalid', { code: checked.code, ...checked.max === undefined ? {} : { max: checked.max } }); continue }
    const stored = current(preset, tool)
    if (edit?.expected !== undefined && (edit.expected ?? null) !== (stored?.text ?? null) && stored?.text !== checked.text) {
      done('conflict', { current: stored?.text ?? null })
      continue
    }
    const original = mode.tools.get(tool)
    let next
    let status
    if (original !== undefined && checked.text === original) {
      if (stored === undefined) status = 'unchanged'
      else {
        next = null
        status = 'restored'
      }
    } else if (stored !== undefined && stored.text === checked.text && stored.base === original) {
      status = 'unchanged'
    } else {
      next = { text: checked.text, ...original === undefined ? {} : { base: original } }
      status = 'saved'
    }
    if (next !== undefined) {
      if (!working.has(preset)) working.set(preset, new Map())
      working.get(preset).set(tool, next)
      if (!writes.has(preset)) writes.set(preset, new Map())
      writes.get(preset).set(tool, next)
    }
    done(status)
  }
  return { results, writes }
}

/**
 * Decide which overrides a restore removes.
 * @param {object} input - what to restore and the state it is judged against.
 * @param {unknown} input.selector - `{ items: [{ preset, tool }] }` for single tools, `{ presets: [id] }` for every
 *   override of those modes, or `{ all: true }` for every override of every mode.
 * @param {Map<string, Map<string, Override>>} input.overrides - the stored overrides per mode.
 * @returns {{ results: Result[], writes: Map<string, Map<string, null>> }} one result per addressed override
 *   (`restored`) or addressed tool without one (`unchanged`), and the removals to store.
 */
export function planRestore({ selector, overrides }) {
  const targets = []
  if (selector?.all === true) {
    for (const [preset, tools] of overrides) for (const tool of tools.keys()) targets.push([preset, tool])
  } else if (Array.isArray(selector?.presets)) {
    for (const preset of selector.presets.map(String)) for (const tool of overrides.get(preset)?.keys() ?? []) targets.push([preset, tool])
  } else if (Array.isArray(selector?.items)) {
    for (const item of selector.items) targets.push([String(item?.preset), String(item?.tool)])
  }
  const results = []
  const writes = new Map()
  for (const [preset, tool] of targets) {
    if (!overrides.get(preset)?.has(tool) || writes.get(preset)?.has(tool)) {
      if (!writes.get(preset)?.has(tool)) results.push({ preset, tool, status: 'unchanged' })
      continue
    }
    if (!writes.has(preset)) writes.set(preset, new Map())
    writes.get(preset).set(tool, null)
    results.push({ preset, tool, status: 'restored' })
  }
  return { results, writes }
}

/**
 * Apply planned writes to the parsed content of the overrides file, in place, and record them in the history.
 * @param {{ presets: Record<string, { tools: Record<string, Override>, history?: object[] }> }} content - the parsed file.
 * @param {Map<string, Map<string, Override | null>>} writes - the changes from {@link planEdits} or {@link planRestore}.
 * @param {string} source - who made them: `page`, `restore`, or `copy`.
 * @param {number} now - the time recorded with each history entry.
 */
export function applyWrites(content, writes, source, now) {
  for (const [preset, changes] of writes) {
    const record = content.presets[preset] ??= { tools: {} }
    record.tools ??= {}
    const history = record.history ??= []
    for (const [tool, next] of changes) {
      const before = record.tools[tool]?.text ?? null
      const after = next?.text ?? null
      if (next === null) delete record.tools[tool]
      else record.tools[tool] = next
      if (before !== after) history.push({ at: now, tool, before, after, source })
    }
    if (history.length > TOOL_HISTORY_LIMIT) history.splice(0, history.length - TOOL_HISTORY_LIMIT)
    if (Object.keys(record.tools).length === 0 && history.length === 0) delete content.presets[preset]
  }
}

/**
 * The stored overrides of every mode as maps.
 * @param {{ presets: Record<string, { tools?: Record<string, Override> }> }} content - the parsed file.
 * @returns {Map<string, Map<string, Override>>} modes with at least one override.
 */
export function overridesOf(content) {
  const found = new Map()
  for (const [preset, record] of Object.entries(content.presets ?? {})) {
    const tools = Object.entries(record?.tools ?? {}).filter(([, value]) => typeof value?.text === 'string')
    if (tools.length > 0) found.set(preset, new Map(tools))
  }
  return found
}

/**
 * Build one mode's catalog entries from the registry scan, the tools seen in real requests, and the stored overrides.
 * @param {object} input - the mode's sources.
 * @param {Map<string, string>} input.scanned - tool name → built-in description from the registry scan.
 * @param {Map<string, string> | undefined} input.seen - tool name → description observed when a request was assembled.
 * @param {Map<string, Override> | undefined} input.overrides - the mode's stored overrides.
 * @param {object[] | undefined} input.history - the mode's stored history entries, oldest first.
 * @returns {object[]} one `{ name, original?, text?, base?, outdated?, missing?, seen?, previous }` per tool, sorted by name.
 */
export function catalogEntries({ scanned, seen, overrides, history }) {
  const names = new Set([...scanned.keys(), ...seen?.keys() ?? [], ...overrides?.keys() ?? []])
  return [...names].sort().map((name) => {
    const fromScan = scanned.has(name)
    const original = scanned.get(name) ?? seen?.get(name)
    const stored = overrides?.get(name)
    const previous = []
    for (const entry of [...history ?? []].reverse()) {
      if (entry.tool !== name) continue
      for (const text of [entry.after, entry.before]) {
        if (typeof text === 'string' && text !== stored?.text && !previous.includes(text)) previous.push(text)
      }
    }
    return {
      name,
      ...original === undefined ? {} : { original },
      ...stored === undefined ? {} : { text: stored.text },
      ...stored?.base === undefined ? {} : { base: stored.base },
      ...stored !== undefined && stored.base !== undefined && original !== undefined && stored.base !== original ? { outdated: true } : {},
      ...stored !== undefined && original === undefined ? { missing: true } : {},
      ...!fromScan && original !== undefined ? { seen: true } : {},
      previous: previous.slice(0, PREVIOUS_VERSIONS),
    }
  })
}
